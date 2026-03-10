"""Серверные раунды crash-игры: генерация, синхронизация, история"""
import json
import math
import os
import random
import time
import psycopg2

ROUND_WAIT_SEC = 5

def generate_crash_point_fair():
    r = random.random()
    if r < 0.35:
        return round(1 + random.random() * 0.5, 2)
    if r < 0.6:
        return round(1.5 + random.random() * 1.5, 2)
    if r < 0.8:
        return round(3 + random.random() * 5, 2)
    if r < 0.95:
        return round(8 + random.random() * 15, 2)
    return round(23 + random.random() * 80, 2)

def generate_crash_point_rigged(win_chance):
    if win_chance <= 10:
        return round(1.00 + random.random() * 0.60, 2)
    if win_chance <= 30:
        r = random.random()
        if r < 0.55:
            return round(1.02 + random.random() * 1.5, 2)
        if r < 0.80:
            return round(2.5 + random.random() * 2.5, 2)
        if r < 0.95:
            return round(5 + random.random() * 5, 2)
        return round(10 + random.random() * 20, 2)
    return generate_crash_point_fair()

def get_crash_point(conn):
    cur = conn.cursor()
    cur.execute("SELECT force_crash FROM crash_game_state WHERE id = 1")
    row = cur.fetchone()
    force = float(row[0]) if row and row[0] else 0

    if force > 0:
        cur.execute("UPDATE crash_game_state SET force_crash = 0 WHERE id = 1")
        conn.commit()
        return force

    cur.execute("SELECT win_chance FROM game_settings WHERE game_name = 'crash'")
    row = cur.fetchone()
    win_chance = int(row[0]) if row else 50

    if win_chance >= 50:
        return generate_crash_point_fair()
    return generate_crash_point_rigged(win_chance)

def handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if method == 'GET' and action == 'state':
        cur.execute("SELECT round_id, crash_point, phase, EXTRACT(EPOCH FROM started_at), EXTRACT(EPOCH FROM updated_at) FROM crash_game_state WHERE id = 1")
        row = cur.fetchone()
        if not row:
            conn.close()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'phase': 'waiting', 'round_id': 0})}

        round_id, crash_point, phase, started_at, updated_at = row
        now = time.time()
        elapsed = now - float(started_at)

        if phase == 'waiting' and elapsed >= ROUND_WAIT_SEC:
            cp = get_crash_point(conn)
            cur.execute("UPDATE crash_game_state SET phase = 'flying', crash_point = %s, started_at = NOW(), updated_at = NOW() WHERE id = 1" % cp)
            conn.commit()
            cur.execute("SELECT round_id, crash_point, phase, EXTRACT(EPOCH FROM started_at) FROM crash_game_state WHERE id = 1")
            row = cur.fetchone()
            round_id, crash_point, phase, started_at = row
            elapsed = 0

        if phase == 'flying':
            threshold = math.log(50) / 0.15
            try:
                m = round(math.pow(math.e, elapsed * 0.15) if elapsed <= threshold else 50 * math.pow(math.e, (elapsed - threshold) * 0.35), 2)
            except OverflowError:
                m = float(crash_point) + 1
            if m >= float(crash_point):
                cur.execute("INSERT INTO crash_rounds (crash_point) VALUES (%s)" % float(crash_point))
                cur.execute("UPDATE crash_game_state SET phase = 'crashed', updated_at = NOW() WHERE id = 1")
                conn.commit()
                phase = 'crashed'
                updated_at = now

        if phase == 'crashed':
            crashed_elapsed = now - float(updated_at) if updated_at else 0
            if crashed_elapsed >= 2:
                cur.execute("UPDATE crash_game_state SET phase = 'waiting', round_id = round_id + 1, started_at = NOW(), updated_at = NOW() WHERE id = 1")
                conn.commit()
                phase = 'waiting'
                elapsed = 0
                cur.execute("SELECT round_id FROM crash_game_state WHERE id = 1")
                round_id = cur.fetchone()[0]

        cur.execute("SELECT crash_point FROM crash_rounds ORDER BY created_at DESC LIMIT 30")
        history = [float(r[0]) for r in cur.fetchall()]
        conn.close()

        server_time = time.time()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({
            'round_id': int(round_id),
            'crash_point': float(crash_point),
            'phase': phase,
            'started_at': float(started_at),
            'server_time': server_time,
            'elapsed': round(elapsed, 3),
            'history': history
        })}

    if method == 'GET':
        cur.execute("SELECT crash_point FROM crash_rounds ORDER BY created_at DESC LIMIT 30")
        rows = cur.fetchall()
        conn.close()
        history = [float(r[0]) for r in rows]
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'history': history})}

    conn.close()
    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'unknown action'})}
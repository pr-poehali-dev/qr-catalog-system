import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";

const MIN_BET_USDT = 0.5;
const MIN_BET_STARS = 10;
const GAME_API = "https://functions.poehali.dev/64bf4a3e-c7fb-44f5-a1a9-b70cae660400";
const INFLATE_INTERVAL = 400;
const BASE_MULT_STEP = 0.3;

type Phase = "loading" | "idle" | "inflating" | "won" | "popped";
type Cur = "usdt" | "stars";

async function apiBalance(userId: string, action: "bet" | "win", amount: number, currency: Cur) {
  try {
    const res = await fetch(GAME_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, action, amount, currency }),
    });
    return await res.json();
  } catch { return null; }
}

interface Props {
  onClose: () => void;
  userId: string;
  usdtBalance: number;
  starsBalance: number;
  onBalanceChange: (c: Cur, d: number) => void;
  onRefreshBalance: () => void;
}

export default function JaguarBalloon({ onClose, userId, usdtBalance, starsBalance, onBalanceChange, onRefreshBalance }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [loadProg, setLoadProg] = useState(0);
  const [cur, setCur] = useState<Cur>("usdt");
  const [betInput, setBetInput] = useState("0.50");
  const [bet, setBet] = useState(0);
  const [mult, setMult] = useState(1);
  const [balloonScale, setBalloonScale] = useState(1);
  const [winChance, setWinChance] = useState(50);
  const [popParticles, setPopParticles] = useState(false);
  const [wobble, setWobble] = useState(false);

  const inflateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepsRef = useRef(0);
  const multRef = useRef(1);
  const isHoldingRef = useRef(false);

  const bal = cur === "usdt" ? usdtBalance : starsBalance;
  const betVal = parseFloat(betInput) || 0;
  const sym = cur === "usdt" ? "$" : "★";
  const minBet = cur === "usdt" ? MIN_BET_USDT : MIN_BET_STARS;
  const winAmount = bet * mult;

  useEffect(() => {
    fetch(`${GAME_API}?game=balloon`).then(r => r.json()).then(d => {
      if (d.win_chance != null) setWinChance(d.win_chance);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "loading") return;
    const t = setInterval(() => {
      setLoadProg(p => {
        if (p >= 100) { clearInterval(t); setTimeout(() => setPhase("idle"), 200); return 100; }
        return p + Math.random() * 10 + 3;
      });
    }, 60);
    return () => clearInterval(t);
  }, [phase]);

  const stopInflate = useCallback(() => {
    isHoldingRef.current = false;
    if (inflateRef.current) {
      clearInterval(inflateRef.current);
      inflateRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopInflate();
  }, [stopInflate]);

  const startGame = useCallback(async () => {
    if (betVal < minBet || betVal > bal) return;
    const res = await apiBalance(userId, "bet", betVal, cur);
    if (!res || !res.ok) return;
    onBalanceChange(cur, -betVal);
    setBet(betVal);
    setMult(1);
    multRef.current = 1;
    stepsRef.current = 0;
    setBalloonScale(1);
    setPopParticles(false);
    setPhase("idle");
  }, [betVal, minBet, bal, userId, cur, onBalanceChange]);

  const doInflateStep = useCallback(() => {
    const popsNow = Math.random() * 100 >= winChance;

    if (popsNow) {
      stopInflate();
      setPopParticles(true);
      setPhase("popped");
      onRefreshBalance();
      return;
    }

    stepsRef.current += 1;
    const step = stepsRef.current;
    const newMult = 1 + BASE_MULT_STEP * step * (step + 1) / 2;
    multRef.current = newMult;
    setMult(newMult);
    setBalloonScale(1 + step * 0.08);

    setWobble(true);
    setTimeout(() => setWobble(false), 150);
  }, [winChance, stopInflate, onRefreshBalance]);

  const handleHoldStart = useCallback(() => {
    if (phase === "idle" && bet === 0) {
      startGame().then(() => {});
      return;
    }
    if (phase !== "idle" && phase !== "inflating") return;
    if (bet === 0) return;

    isHoldingRef.current = true;
    setPhase("inflating");

    doInflateStep();

    inflateRef.current = setInterval(() => {
      if (!isHoldingRef.current) return;
      doInflateStep();
    }, INFLATE_INTERVAL);
  }, [phase, bet, startGame, doInflateStep]);

  const handleHoldEnd = useCallback(async () => {
    stopInflate();
    if (phase !== "inflating" || stepsRef.current === 0) return;

    const winnings = bet * multRef.current;
    await apiBalance(userId, "win", winnings, cur);
    onBalanceChange(cur, winnings);
    onRefreshBalance();
    setPhase("won");
  }, [phase, bet, cur, userId, onBalanceChange, onRefreshBalance, stopInflate]);

  const resetGame = useCallback(() => {
    setBet(0);
    setMult(1);
    multRef.current = 1;
    stepsRef.current = 0;
    setBalloonScale(1);
    setPopParticles(false);
    setPhase("idle");
  }, []);

  const handleStartBet = useCallback(async () => {
    if (betVal < minBet || betVal > bal) return;
    const res = await apiBalance(userId, "bet", betVal, cur);
    if (!res || !res.ok) return;
    onBalanceChange(cur, -betVal);
    setBet(betVal);
    setMult(1);
    multRef.current = 1;
    stepsRef.current = 0;
    setBalloonScale(1);
    setPopParticles(false);
    setPhase("idle");
  }, [betVal, minBet, bal, userId, cur, onBalanceChange]);

  const canHold = (phase === "idle" && bet > 0) || phase === "inflating";
  const isGameActive = bet > 0 && (phase === "idle" || phase === "inflating");

  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0a0e14] flex flex-col items-center justify-center">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
          <Icon name="X" size={20} className="text-white/60" />
        </button>
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4ade80] to-[#22c55e] flex items-center justify-center shadow-lg shadow-[#4ade80]/20">
              <span className="text-4xl">🎈</span>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4ade80] animate-ping" />
          </div>
          <h1 className="text-[#4ade80] text-2xl font-bold tracking-wide">Jaguar Gems</h1>
          <div className="w-56 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-gradient-to-r from-[#4ade80] to-[#22c55e] rounded-full transition-all duration-200" style={{ width: `${Math.min(loadProg, 100)}%` }} />
          </div>
          <span className="text-white/30 text-xs">{Math.min(Math.round(loadProg), 100)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0e14] flex flex-col overflow-auto">
      <style>{`
        @keyframes balloonWobble { 0% { transform: scale(var(--bs)) rotate(0deg); } 25% { transform: scale(var(--bs)) rotate(-2deg); } 50% { transform: scale(var(--bs)) rotate(2deg); } 75% { transform: scale(var(--bs)) rotate(-1deg); } 100% { transform: scale(var(--bs)) rotate(0deg); } }
        @keyframes balloonPop { 0% { transform: scale(var(--bs)); opacity: 1; } 30% { transform: scale(calc(var(--bs) * 1.3)); opacity: 0.7; } 100% { transform: scale(0); opacity: 0; } }
        @keyframes particleBurst { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; } }
        @keyframes floatUp { 0% { transform: translateY(0); } 100% { transform: translateY(-8px); } }
        @keyframes pulseBtn { 0%,100% { box-shadow: 0 0 0 0 rgba(236,72,153,0.4); } 50% { box-shadow: 0 0 20px 8px rgba(236,72,153,0.15); } }
        @keyframes ropeSwing { 0%,100% { d: path("M 50 100 Q 40 130 50 160"); } 50% { d: path("M 50 100 Q 60 130 50 160"); } }
        .balloon-wobble { animation: balloonWobble 0.2s ease; }
        .balloon-pop { animation: balloonPop 0.4s ease-out forwards; }
        .particle { animation: particleBurst 0.6s ease-out forwards; }
        .float-anim { animation: floatUp 2s ease-in-out infinite alternate; }
        .pulse-btn { animation: pulseBtn 1.5s ease-in-out infinite; }
      `}</style>

      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d1117]/80 backdrop-blur-lg border-b border-white/5 shrink-0">
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon name="ArrowLeft" size={16} className="text-white/60" />
        </button>
        <div className="flex bg-white/[0.04] rounded-full p-0.5 border border-white/[0.06]">
          <button
            onClick={() => { if (!isGameActive) { setCur("usdt"); setBetInput(MIN_BET_USDT.toFixed(2)); } }}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${cur === "usdt" ? "bg-[#4ade80] text-[#0a0e14]" : "text-white/40"}`}
          >USDT</button>
          <button
            onClick={() => { if (!isGameActive) { setCur("stars"); setBetInput(MIN_BET_STARS.toFixed(2)); } }}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${cur === "stars" ? "bg-[#4ade80] text-[#0a0e14]" : "text-white/40"}`}
          >Stars ★</button>
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-xl px-2.5 py-1.5">
          <Icon name="Wallet" size={12} className="text-[#4ade80]" />
          <span className="text-white text-xs font-semibold">{bal.toFixed(2)} {sym}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-3 py-3 gap-2.5 max-w-md mx-auto w-full">
        <div className="relative flex-1 min-h-[280px] bg-gradient-to-b from-[#0e4a6e]/30 via-[#0a0e14] to-[#0a0e14] rounded-2xl border border-white/5 flex flex-col items-center justify-center overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1/2 opacity-20">
            <div className="absolute top-[15%] left-[20%] w-12 h-6 bg-white/30 rounded-full blur-md" />
            <div className="absolute top-[30%] right-[15%] w-16 h-5 bg-white/20 rounded-full blur-lg" />
            <div className="absolute top-[10%] right-[35%] w-8 h-4 bg-white/25 rounded-full blur-sm" />
          </div>

          {phase === "popped" && popParticles && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const dist = 60 + Math.random() * 40;
                return (
                  <div
                    key={i}
                    className="particle absolute w-3 h-3 rounded-full"
                    style={{
                      "--px": `${Math.cos(angle) * dist}px`,
                      "--py": `${Math.sin(angle) * dist}px`,
                      backgroundColor: ["#ec4899", "#f97316", "#facc15", "#4ade80", "#3b82f6", "#a855f7"][i % 6],
                      top: "50%",
                      left: "50%",
                      marginTop: "-6px",
                      marginLeft: "-6px",
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center">
            {phase !== "popped" && (
              <div
                className={`relative transition-transform duration-300 ${wobble ? "balloon-wobble" : ""} ${phase === "inflating" ? "float-anim" : ""}`}
                style={{ "--bs": balloonScale, transform: `scale(${balloonScale})` } as React.CSSProperties}
              >
                <div className="relative">
                  <div
                    className="w-24 h-28 rounded-[50%] relative"
                    style={{
                      background: "radial-gradient(circle at 35% 30%, #ff9a56, #f97316 40%, #ea580c 80%)",
                      boxShadow: "inset -8px -8px 20px rgba(0,0,0,0.2), inset 5px 5px 15px rgba(255,255,255,0.15), 0 8px 32px rgba(249,115,22,0.3)",
                    }}
                  >
                    <div className="absolute top-[18%] left-[28%] w-6 h-4 bg-white/30 rounded-full blur-[3px] rotate-[-20deg]" />
                    <div className="absolute top-[10%] left-[22%] w-3 h-2 bg-white/40 rounded-full blur-[1px] rotate-[-25deg]" />
                  </div>
                  <div className="w-4 h-3 mx-auto -mt-0.5 relative">
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, #ea580c, #c2410c)", clipPath: "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)" }} />
                  </div>
                  <div className="w-px h-16 bg-white/20 mx-auto" />
                </div>
              </div>
            )}

            {phase === "popped" && (
              <div className="balloon-pop flex items-center justify-center" style={{ "--bs": balloonScale } as React.CSSProperties}>
                <span className="text-5xl">💥</span>
              </div>
            )}

            {isGameActive && (
              <div className="mt-3 bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
                <p className="text-white/50 text-[10px] text-center">Множитель</p>
                <p className="text-[#4ade80] font-bold text-xl text-center">x{mult.toFixed(1)}</p>
                <p className="text-white font-semibold text-sm text-center">{winAmount.toFixed(2)} {sym}</p>
              </div>
            )}
          </div>
        </div>

        {phase === "popped" && (
          <div className="bg-red-500/8 border border-red-500/15 rounded-xl px-3 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <span className="text-sm">💥</span>
            </div>
            <div>
              <p className="text-red-400 font-semibold text-xs">Шар лопнул!</p>
              <p className="text-red-400/50 text-[10px]">-{bet.toFixed(2)} {sym}</p>
            </div>
            <button
              onClick={resetGame}
              className="ml-auto px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-[11px] font-semibold active:bg-white/10"
            >Заново</button>
          </div>
        )}

        {phase === "won" && (
          <div className="bg-[#4ade80]/8 border border-[#4ade80]/15 rounded-xl px-3 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4ade80]/15 flex items-center justify-center shrink-0">
              <span className="text-sm">🏆</span>
            </div>
            <div>
              <p className="text-[#4ade80] font-semibold text-xs">Выигрыш!</p>
              <p className="text-[#4ade80]/60 text-[10px]">+{winAmount.toFixed(2)} {sym} (x{mult.toFixed(1)})</p>
            </div>
            <button
              onClick={resetGame}
              className="ml-auto px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-[11px] font-semibold active:bg-white/10"
            >Заново</button>
          </div>
        )}

        {isGameActive && (
          <div className="flex flex-col items-center gap-2">
            <button
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              onTouchStart={(e) => { e.preventDefault(); handleHoldStart(); }}
              onTouchEnd={(e) => { e.preventDefault(); handleHoldEnd(); }}
              onTouchCancel={handleHoldEnd}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90
                bg-gradient-to-br from-[#ec4899] to-[#db2777] shadow-lg shadow-pink-500/30
                ${phase === "inflating" ? "scale-95 shadow-pink-500/50" : "pulse-btn"}`}
            >
              <span className="text-3xl">👆</span>
            </button>
            <p className="text-white/30 text-[10px]">
              {phase === "inflating" ? "Отпустите чтобы забрать" : "Удерживайте чтобы надувать"}
            </p>
          </div>
        )}

        {(phase === "idle" && bet === 0) || phase === "won" || phase === "popped" ? (
          <>
            {(phase === "idle" && bet === 0) && (
              <>
                <div className="bg-[#111820] border border-white/5 rounded-xl px-2.5 py-2 flex items-center gap-2">
                  <button
                    onClick={() => setBetInput(Math.max(minBet, betVal - (cur === "stars" ? 10 : 0.5)).toFixed(2))}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 active:bg-white/10 text-base font-bold shrink-0"
                  >-</button>
                  <div className="flex-1 flex items-center justify-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={betInput}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        if (v.split(".").length <= 2) setBetInput(v);
                      }}
                      onBlur={() => {
                        const v = parseFloat(betInput);
                        setBetInput(isNaN(v) || v < minBet ? minBet.toFixed(2) : v.toFixed(2));
                      }}
                      className="bg-transparent text-center text-white text-lg font-bold outline-none w-full"
                    />
                    <span className="text-white/30 text-sm">{sym}</span>
                  </div>
                  <button
                    onClick={() => setBetInput((betVal + (cur === "stars" ? 10 : 0.5)).toFixed(2))}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 active:bg-white/10 text-base font-bold shrink-0"
                  >+</button>
                </div>

                <div className="flex gap-1.5">
                  {[
                    { l: "MIN", fn: () => setBetInput(minBet.toFixed(2)) },
                    { l: "x2", fn: () => setBetInput((betVal * 2).toFixed(2)) },
                    { l: "½", fn: () => setBetInput(Math.max(minBet, betVal / 2).toFixed(2)) },
                    { l: "MAX", fn: () => setBetInput(bal.toFixed(2)) },
                  ].map(b => (
                    <button key={b.l} onClick={b.fn} className="flex-1 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-white/25 text-[10px] font-medium active:bg-white/[0.06]">{b.l}</button>
                  ))}
                </div>

                <button
                  onClick={handleStartBet}
                  disabled={betVal < minBet || betVal > bal}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4ade80] to-[#22c55e] text-[#0a0e14] font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-25"
                >
                  {betVal > bal ? "Недостаточно средств" : betVal < minBet ? `Мин. ${minBet} ${sym}` : "Играть"}
                </button>
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

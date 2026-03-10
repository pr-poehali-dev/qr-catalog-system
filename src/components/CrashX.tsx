import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

const GAME_API = "https://functions.poehali.dev/64bf4a3e-c7fb-44f5-a1a9-b70cae660400";
const ROUNDS_API = "https://functions.poehali.dev/5aa25d9b-d82f-49a4-85e2-db53e46f9461";
const MIN_BET_USDT = 1;
const MIN_BET_STARS = 5;
const QUICK_BETS_USDT = [1, 5, 10, 50];
const QUICK_BETS_STARS = [5, 25, 50, 100];
const ROUND_WAIT = 5000;

type Cur = "usdt" | "stars";
type Phase = "loading" | "roundWait" | "flying" | "crashed" | "cashedOut";

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

async function pollServerState() {
  try {
    const res = await fetch(ROUNDS_API + "?action=state");
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
  initialCurrency: Cur;
}

function BetPanel({
  betInput, setBetInput, minBet, bal, quickBets, sym, isFlying, hasBet, isCashedOut, cashOut, placeBet, betVal, currentWin, step,
  autoBet, setAutoBet, autoCashoutOn, setAutoCashoutOn, autoCashout, setAutoCashout, multiplier, isCrashed, cashoutLocked,
}: {
  betInput: string; setBetInput: (v: string) => void; minBet: number; bal: number; quickBets: number[]; sym: string;
  isFlying: boolean; hasBet: boolean; isCashedOut: boolean; cashOut: () => void; placeBet: () => void; betVal: number;
  currentWin: number; step: number;
  autoBet: boolean; setAutoBet: (v: boolean) => void;
  autoCashoutOn: boolean; setAutoCashoutOn: (v: boolean) => void;
  autoCashout: string; setAutoCashout: (v: string) => void;
  multiplier: number; isCrashed: boolean; cashoutLocked: boolean;
}) {
  const blocked = isFlying && !hasBet;

  return (
    <div className="bg-[#0d1a0d] border border-[#1a3a1a] rounded-2xl p-3 space-y-2.5">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => setAutoBet(!autoBet)}>
          {autoBet ? (
            <div className="w-8 h-4 bg-green-600 rounded-full relative">
              <div className="w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 right-0.5" />
            </div>
          ) : (
            <div className="w-8 h-4 bg-[#1a3a1a] rounded-full relative">
              <div className="w-3.5 h-3.5 bg-[#2a4a2a] rounded-full absolute top-0.5 left-0.5" />
            </div>
          )}
          <span className={`text-xs font-medium ${autoBet ? "text-white" : "text-white/60"}`}>Автоставка</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => setAutoCashoutOn(!autoCashoutOn)}>
          {autoCashoutOn ? (
            <div className="w-8 h-4 bg-green-600 rounded-full relative">
              <div className="w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 right-0.5" />
            </div>
          ) : (
            <div className="w-8 h-4 bg-[#1a3a1a] rounded-full relative">
              <div className="w-3.5 h-3.5 bg-[#2a4a2a] rounded-full absolute top-0.5 left-0.5" />
            </div>
          )}
          <span className={`text-xs font-medium ${autoCashoutOn ? "text-white" : "text-white/60"}`}>Автовывод</span>
        </label>
        <div className="ml-auto flex items-center bg-[#1a3a1a] rounded-lg px-2.5 py-1.5">
          <span className="text-white/40 text-xs mr-1">x</span>
          <input
            type="text"
            value={autoCashout}
            onChange={e => setAutoCashout(e.target.value)}
            className="bg-transparent text-white font-bold text-sm w-10 outline-none text-center"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 min-w-0 space-y-2">
          <div className={`flex items-center bg-[#080e08] border border-[#1a3a1a] rounded-xl overflow-hidden h-12 ${blocked ? "opacity-40 pointer-events-none" : ""}`}>
            <button
              onClick={() => setBetInput(String(Math.max(minBet, +(parseFloat(betInput) || 0) - step)))}
              className="w-12 h-full flex items-center justify-center text-white/50 active:text-white transition border-r border-[#1a3a1a]"
            >
              <Icon name="Minus" size={18} />
            </button>
            <input
              type="number"
              value={betInput}
              onChange={e => setBetInput(e.target.value)}
              className="flex-1 bg-transparent text-white text-center font-extrabold text-xl outline-none min-w-0 [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
              min={minBet}
            />
            <button
              onClick={() => setBetInput(String(Math.min(bal, +(parseFloat(betInput) || 0) + step)))}
              className="w-12 h-full flex items-center justify-center text-white/50 active:text-white transition border-l border-[#1a3a1a]"
            >
              <Icon name="Plus" size={18} />
            </button>
          </div>
          <div className={`flex gap-1.5 ${blocked ? "opacity-40 pointer-events-none" : ""}`}>
            {quickBets.map(q => (
              <button
                key={q}
                onClick={() => setBetInput(String(q))}
                className="flex-1 py-1.5 rounded-lg bg-[#1a3a1a] text-white/60 text-xs font-bold active:bg-[#2a4a2a] transition"
              >
                {q >= 1000 ? `${q / 1000}K` : q}
              </button>
            ))}
          </div>
        </div>
        {isFlying && hasBet && !isCashedOut && !isCrashed ? (
          <button
            onClick={cashOut}
            disabled={cashoutLocked}
            className={`w-[120px] shrink-0 rounded-xl bg-gradient-to-b from-green-400 to-green-600 text-black font-extrabold text-lg active:scale-[0.97] transition-all flex flex-col items-center justify-center shadow-lg shadow-green-500/20 ${cashoutLocked ? "opacity-50 pointer-events-none" : ""}`}
          >
            <span>ЗАБРАТЬ</span>
            <span className="text-sm font-bold opacity-80">{currentWin.toFixed(2)} {sym}</span>
          </button>
        ) : isFlying && hasBet && isCashedOut ? (
          <button disabled className="w-[120px] shrink-0 rounded-xl bg-[#0a1f0a] border border-green-500/30 text-green-400 font-extrabold text-sm flex flex-col items-center justify-center">
            <span>ЗАБРАНО</span>
            <span className="text-xs font-bold opacity-80">+{currentWin.toFixed(2)} {sym}</span>
          </button>
        ) : blocked ? (
          <button disabled className="w-[120px] shrink-0 rounded-xl bg-[#1a3a1a] text-white/30 font-bold text-sm">
            ЖДИТЕ...
          </button>
        ) : !hasBet ? (
          <button
            onClick={placeBet}
            disabled={betVal < minBet || betVal > bal}
            className="w-[120px] shrink-0 rounded-xl bg-gradient-to-r from-[#16a34a] to-[#22c55e] text-white font-extrabold text-lg active:scale-[0.97] transition-transform disabled:opacity-40 shadow-lg shadow-green-500/20"
          >
            СТАВКА
          </button>
        ) : (
          <button disabled className="w-[120px] shrink-0 rounded-xl bg-[#1a3a1a] text-white/30 font-bold text-sm">
            ЖДИТЕ...
          </button>
        )}
      </div>
      <div className="h-1 rounded-full bg-gradient-to-r from-[#16a34a] to-[#22c55e] opacity-60" />
    </div>
  );
}

export default function CrashX({ onClose, userId, usdtBalance, starsBalance, onBalanceChange, onRefreshBalance, initialCurrency }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [loadProg, setLoadProg] = useState(0);
  const [cur, setCur] = useState<Cur>(initialCurrency);
  const [betInput1, setBetInput1] = useState(initialCurrency === "usdt" ? "1" : "5");
  const [betInput2, setBetInput2] = useState(initialCurrency === "usdt" ? "1" : "5");
  const [multiplier, setMultiplier] = useState(1.0);
  const [history, setHistory] = useState<number[]>([]);
  const [bet1Placed, setBet1Placed] = useState(0);
  const [bet2Placed, setBet2Placed] = useState(0);
  const [roundProgress, setRoundProgress] = useState(0);
  const [rocketPos, setRocketPos] = useState({ x: 0, y: 100 });
  const [flyAway, setFlyAway] = useState(false);
  const [currentWin1, setCurrentWin1] = useState(0);
  const [currentWin2, setCurrentWin2] = useState(0);
  const [cashedOut1, setCashedOut1] = useState(false);
  const [cashedOut2, setCashedOut2] = useState(false);
  const [loadingDone, setLoadingDone] = useState(false);
  const [waitingVisible, setWaitingVisible] = useState(false);
  const [autoBet1, setAutoBet1] = useState(false);
  const [autoBet2, setAutoBet2] = useState(false);
  const [autoCashoutOn1, setAutoCashoutOn1] = useState(false);
  const [autoCashoutOn2, setAutoCashoutOn2] = useState(false);
  const [autoCashout1, setAutoCashout1] = useState("2.00");
  const [autoCashout2, setAutoCashout2] = useState("2.00");
  const [cashoutLocked, setCashoutLocked] = useState(false);

  const onRefreshBalanceRef = useRef(onRefreshBalance);
  useEffect(() => { onRefreshBalanceRef.current = onRefreshBalance; }, [onRefreshBalance]);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const crashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const betResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crashRef = useRef(0);
  const serverPhaseRef = useRef("");
  const localMultRef = useRef(1.0);
  const localStartRef = useRef(0);
  const serverElapsedOffsetRef = useRef(0);
  const bet1Ref = useRef(0);
  const bet2Ref = useRef(0);
  const cashedOut1Ref = useRef(false);
  const cashedOut2Ref = useRef(false);
  const betInput1Ref = useRef(betInput1);
  const betInput2Ref = useRef(betInput2);
  const autoBet1Ref = useRef(autoBet1);
  const autoBet2Ref = useRef(autoBet2);
  const autoCashoutOn1Ref = useRef(autoCashoutOn1);
  const autoCashoutOn2Ref = useRef(autoCashoutOn2);
  const autoCashout1Ref = useRef(autoCashout1);
  const autoCashout2Ref = useRef(autoCashout2);

  useEffect(() => { betInput1Ref.current = betInput1; }, [betInput1]);
  useEffect(() => { betInput2Ref.current = betInput2; }, [betInput2]);
  useEffect(() => { autoBet1Ref.current = autoBet1; }, [autoBet1]);
  useEffect(() => { autoBet2Ref.current = autoBet2; }, [autoBet2]);
  useEffect(() => { autoCashoutOn1Ref.current = autoCashoutOn1; }, [autoCashoutOn1]);
  useEffect(() => { autoCashoutOn2Ref.current = autoCashoutOn2; }, [autoCashoutOn2]);
  useEffect(() => { autoCashout1Ref.current = autoCashout1; }, [autoCashout1]);
  useEffect(() => { autoCashout2Ref.current = autoCashout2; }, [autoCashout2]);

  useEffect(() => {
    if (loadingDone) return;
    const t = setInterval(() => {
      setLoadProg(p => {
        if (p >= 100) {
          clearInterval(t);
          setTimeout(() => {
            setLoadingDone(true);
            setPhase("roundWait");
          }, 300);
          return 100;
        }
        return p + Math.random() * 12 + 4;
      });
    }, 50);
    return () => clearInterval(t);
  }, [loadingDone]);

  const placeBet1 = useCallback(async () => {
    const bv = parseFloat(betInput1Ref.current) || 0;
    const b = cur === "usdt" ? usdtBalance : starsBalance;
    const mb = cur === "usdt" ? MIN_BET_USDT : MIN_BET_STARS;
    if (bv < mb || bv > b) return;
    const res = await apiBalance(userId, "bet", bv, cur);
    if (!res || !res.ok) return;
    onBalanceChange(cur, -bv);
    setBet1Placed(bv);
    bet1Ref.current = bv;
  }, [cur, usdtBalance, starsBalance, userId, onBalanceChange]);

  const placeBet2 = useCallback(async () => {
    const bv = parseFloat(betInput2Ref.current) || 0;
    const b = cur === "usdt" ? usdtBalance : starsBalance;
    const mb = cur === "usdt" ? MIN_BET_USDT : MIN_BET_STARS;
    if (bv < mb || bv > b) return;
    const res = await apiBalance(userId, "bet", bv, cur);
    if (!res || !res.ok) return;
    onBalanceChange(cur, -bv);
    setBet2Placed(bv);
    bet2Ref.current = bv;
  }, [cur, usdtBalance, starsBalance, userId, onBalanceChange]);

  const cashOut1 = useCallback(() => {
    if (cashedOut1Ref.current || bet1Ref.current <= 0) return;
    cashedOut1Ref.current = true;
    setCashedOut1(true);
    const w = +(bet1Ref.current * localMultRef.current).toFixed(2);
    setCurrentWin1(w);
    onBalanceChange(cur, w);
    apiBalance(userId, "win", w, cur);
  }, [userId, cur, onBalanceChange]);

  const cashOut2 = useCallback(() => {
    if (cashedOut2Ref.current || bet2Ref.current <= 0) return;
    cashedOut2Ref.current = true;
    setCashedOut2(true);
    const w = +(bet2Ref.current * localMultRef.current).toFixed(2);
    setCurrentWin2(w);
    onBalanceChange(cur, w);
    apiBalance(userId, "win", w, cur);
  }, [userId, cur, onBalanceChange]);

  const placeBet1Ref = useRef(placeBet1);
  const placeBet2Ref = useRef(placeBet2);
  const cashOut1Ref_fn = useRef(cashOut1);
  const cashOut2Ref_fn = useRef(cashOut2);
  useEffect(() => { placeBet1Ref.current = placeBet1; }, [placeBet1]);
  useEffect(() => { placeBet2Ref.current = placeBet2; }, [placeBet2]);
  useEffect(() => { cashOut1Ref_fn.current = cashOut1; }, [cashOut1]);
  useEffect(() => { cashOut2Ref_fn.current = cashOut2; }, [cashOut2]);

  const bal = cur === "usdt" ? usdtBalance : starsBalance;
  const sym = cur === "usdt" ? "$" : "★";
  const minBet = cur === "usdt" ? MIN_BET_USDT : MIN_BET_STARS;
  const quickBets = cur === "usdt" ? QUICK_BETS_USDT : QUICK_BETS_STARS;
  const step = cur === "usdt" ? 1 : 5;
  const betVal1 = parseFloat(betInput1) || 0;
  const betVal2 = parseFloat(betInput2) || 0;

  const stopLocalAnimation = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
  }, []);

  const calcMultiplier = useCallback((elapsed: number) => {
    const threshold = Math.log(50) / 0.15;
    if (elapsed <= threshold) {
      return Math.pow(Math.E, 0.15 * elapsed);
    }
    return 50 * Math.pow(Math.E, 0.35 * (elapsed - threshold));
  }, []);

  const startLocalAnimation = useCallback((serverElapsed?: number) => {
    stopLocalAnimation();
    localStartRef.current = Date.now();
    serverElapsedOffsetRef.current = serverElapsed || 0;
    localMultRef.current = 1.0;
    const tick = () => {
      const localElapsed = (Date.now() - localStartRef.current) / 1000;
      const elapsed = serverElapsedOffsetRef.current + localElapsed;
      const m = calcMultiplier(elapsed);
      localMultRef.current = m;
      setMultiplier(+m.toFixed(2));
      const speed = m < 10 ? 2.5 : m < 100 ? 1.5 : 0.8;
      const xProg = Math.min(elapsed * speed, 100);
      const yProg = Math.max(100 - elapsed * 6, 25);
      setRocketPos({ x: xProg, y: yProg });
      if (!cashedOut1Ref.current) setCurrentWin1(+(bet1Ref.current * m).toFixed(2));
      if (!cashedOut2Ref.current) setCurrentWin2(+(bet2Ref.current * m).toFixed(2));

      const ac1 = parseFloat(autoCashout1Ref.current) || 0;
      if (autoCashoutOn1Ref.current && ac1 > 1 && m >= ac1 && bet1Ref.current > 0 && !cashedOut1Ref.current) {
        cashOut1Ref_fn.current();
      }
      const ac2 = parseFloat(autoCashout2Ref.current) || 0;
      if (autoCashoutOn2Ref.current && ac2 > 1 && m >= ac2 && bet2Ref.current > 0 && !cashedOut2Ref.current) {
        cashOut2Ref_fn.current();
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [stopLocalAnimation, calcMultiplier]);

  useEffect(() => {
    if (!loadingDone) return;

    const poll = async () => {
      const state = await pollServerState();
      if (!state) return;

      if (state.history) setHistory(state.history);

      if (state.phase === "waiting" || state.status === "waiting") {
        if (serverPhaseRef.current !== "waiting") {
          serverPhaseRef.current = "waiting";
          stopLocalAnimation();
          setFlyAway(false);
          crashRef.current = 0;

          betResetTimeoutRef.current = setTimeout(() => {
            setBet1Placed(0); setBet2Placed(0);
            bet1Ref.current = 0; bet2Ref.current = 0;
            setCashedOut1(false); setCashedOut2(false);
            cashedOut1Ref.current = false; cashedOut2Ref.current = false;
            setCurrentWin1(0); setCurrentWin2(0);
            setRocketPos({ x: 0, y: 100 });
            setMultiplier(1.0);
            setPhase("roundWait");
            setWaitingVisible(true);

            if (autoBet1Ref.current) setTimeout(() => placeBet1Ref.current(), 200);
            if (autoBet2Ref.current) setTimeout(() => placeBet2Ref.current(), 200);
          }, 500);

          const startTime = Date.now();
          const progInterval = setInterval(() => {
            const p = Math.min(((Date.now() - startTime) / ROUND_WAIT) * 100, 100);
            setRoundProgress(p);
            if (p >= 100) clearInterval(progInterval);
          }, 50);
        }
      } else if (state.phase === "flying" || state.status === "flying") {
        if (serverPhaseRef.current !== "flying") {
          serverPhaseRef.current = "flying";
          setPhase("flying");
          setWaitingVisible(false);
          setCashoutLocked(true);
          setTimeout(() => setCashoutLocked(false), 600);
          startLocalAnimation(state.elapsed || 0);
        } else if (state.elapsed) {
          serverElapsedOffsetRef.current = state.elapsed;
          localStartRef.current = Date.now();
        }
      } else if (state.phase === "crashed" || state.status === "crashed") {
        if (serverPhaseRef.current !== "crashed") {
          serverPhaseRef.current = "crashed";
          stopLocalAnimation();
          const cp = state.crash_point;
          setMultiplier(cp);
          crashRef.current = cp;
          setFlyAway(true);
          crashTimeoutRef.current = setTimeout(() => {
            setPhase("crashed");
            onRefreshBalanceRef.current();
          }, 500);
        } else if (phase !== "crashed") {
          const cp = state.crash_point;
          setMultiplier(cp);
          crashRef.current = cp;
          setFlyAway(true);
        }
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 800);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      stopLocalAnimation();
      if (crashTimeoutRef.current) clearTimeout(crashTimeoutRef.current);
      if (betResetTimeoutRef.current) clearTimeout(betResetTimeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadingDone]);

  const renderGraph = () => {
    const w = 360;
    const h = 200;
    const rawX = (rocketPos.x / 100) * w;
    const py = (rocketPos.y / 100) * h;
    const isCrashedOrAway = phase === "crashed" || flyAway;

    const maxRocketX = w * 0.45;
    const rocketX = Math.min(rawX, maxRocketX);
    const scrollOffset = rawX > maxRocketX ? rawX - maxRocketX : 0;

    const altitude = 1 - rocketPos.y / 100;
    const starSpeed = scrollOffset * 0.8;

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" style={{ overflow: "hidden" }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="starGlow"><feGaussianBlur stdDeviation="1.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {!isCrashedOrAway && altitude > 0.3 && (
          <g>
            {[...Array(20)].map((_, i) => {
              const sx = ((i * 53 + 17) % w + w - starSpeed * (0.3 + (i % 3) * 0.3)) % (w + 40) - 20;
              const sy = (i * 37 + 11) % h;
              const size = 0.5 + (i % 4) * 0.4;
              const op = Math.min((altitude - 0.3) * 2, 1) * (0.2 + (i % 3) * 0.15);
              return <circle key={`s${i}`} cx={sx} cy={sy} r={size} fill="white" opacity={op} filter={size > 1 ? "url(#starGlow)" : undefined} />;
            })}
          </g>
        )}
        {!isCrashedOrAway && altitude > 0.5 && (
          <g>
            {[...Array(8)].map((_, i) => {
              const lx = ((i * 89 + 30) % w + w - starSpeed * (1.5 + i * 0.4)) % (w + 60) - 30;
              const ly = (i * 43 + 20) % h;
              const op = Math.min((altitude - 0.5) * 3, 1) * 0.12;
              const len = 8 + i * 3;
              return <line key={`l${i}`} x1={lx} y1={ly} x2={lx - len} y2={ly} stroke="white" strokeWidth="0.5" opacity={op} />;
            })}
          </g>
        )}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" y1={h * f} x2={w} y2={h * f} stroke="white" strokeOpacity={isCrashedOrAway ? 0.03 : Math.max(0.03 - altitude * 0.03, 0)} strokeDasharray="4 4" />
        ))}
        {!isCrashedOrAway && (
          <g style={{ transform: `translateX(${-scrollOffset}px)` }}>
            <polygon points={`0,${h} 0,${py} ${rawX},${py} ${rawX},${h}`} fill="url(#fillGrad)" />
            <path d={`M 0 ${h} Q ${rawX * 0.3} ${h - (h - py) * 0.2} ${rawX} ${py}`} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
          </g>
        )}
        {!isCrashedOrAway && (
          <g style={{ transform: `translate(${rocketX}px, ${py - 16}px)` }}>
            <text x="0" y="0" fontSize="28" textAnchor="middle" style={{ filter: "drop-shadow(0 0 8px rgba(34,197,94,0.6))" }}>🚀</text>
          </g>
        )}
      </svg>
    );
  };

  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-[200] bg-[#080e08] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl animate-bounce">🚀</div>
          <span className="text-green-400 font-extrabold text-2xl tracking-widest">JAGUAR GEMS</span>
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#16a34a] to-[#22c55e] rounded-full transition-all" style={{ width: `${Math.min(loadProg, 100)}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const isFlying = phase === "flying";
  const isCrashed = phase === "crashed";
  const isWaiting = phase === "roundWait";
  const hasBet1 = bet1Placed > 0;
  const hasBet2 = bet2Placed > 0;

  const panel1Props = {
    betInput: betInput1, setBetInput: setBetInput1, minBet, bal, quickBets, sym, isFlying, hasBet: hasBet1,
    isCashedOut: cashedOut1, cashOut: cashOut1, placeBet: placeBet1, betVal: betVal1, currentWin: currentWin1, step,
    autoBet: autoBet1, setAutoBet: setAutoBet1, autoCashoutOn: autoCashoutOn1, setAutoCashoutOn: setAutoCashoutOn1,
    autoCashout: autoCashout1, setAutoCashout: setAutoCashout1, multiplier, isCrashed, cashoutLocked,
  };
  const panel2Props = {
    betInput: betInput2, setBetInput: setBetInput2, minBet, bal, quickBets, sym, isFlying, hasBet: hasBet2,
    isCashedOut: cashedOut2, cashOut: cashOut2, placeBet: placeBet2, betVal: betVal2, currentWin: currentWin2, step,
    autoBet: autoBet2, setAutoBet: setAutoBet2, autoCashoutOn: autoCashoutOn2, setAutoCashoutOn: setAutoCashoutOn2,
    autoCashout: autoCashout2, setAutoCashout: setAutoCashout2, multiplier, isCrashed, cashoutLocked,
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#080e08] flex flex-col overflow-auto">
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
        <button onClick={onClose} className="flex items-center gap-1 text-white/60 active:scale-95">
          <Icon name="ChevronLeft" size={20} />
          <span className="text-sm font-medium">Назад</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs uppercase font-medium">{cur === "usdt" ? "USDT" : "Stars"}</span>
          <span className="text-white font-bold text-base">{bal.toFixed(2)} {sym}</span>
        </div>
        <button
          onClick={() => { setCur(c => c === "usdt" ? "stars" : "usdt"); setBetInput1(cur === "usdt" ? "5" : "1"); setBetInput2(cur === "usdt" ? "5" : "1"); }}
          className="bg-[#1a3a1a] rounded-xl px-3 py-1.5 text-xs text-white/60 font-medium active:scale-95"
        >
          {cur === "usdt" ? "★ Stars" : "$ USDT"}
        </button>
      </div>

      <div className="px-3 py-1.5 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {history.slice(0, 10).map((h, i) => (
            <span key={i} className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${
              h < 1.5 ? "bg-[#0a1f0a] text-green-300" : h < 2 ? "bg-[#1a3a1a] text-green-200" : h < 5 ? "bg-[#1a3a1a] text-emerald-300" : "bg-[#0d2a0d] text-green-400"
            }`}>
              {h.toFixed(2)}x
            </span>
          ))}
          <button className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-[#1a3a1a]">
            <Icon name="Clock" size={14} className="text-white/30" />
          </button>
        </div>
      </div>

      <div className="mx-3 mt-1 rounded-2xl border border-[#1a3a1a] relative overflow-hidden shrink-0 transition-colors duration-700" style={{ height: "30vh", minHeight: 180, maxHeight: 260, background: isFlying ? `linear-gradient(180deg, #020808 0%, #0a140a ${Math.max(100 - (1 - rocketPos.y / 100) * 80, 30)}%)` : "#0a140a" }}>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a140a] to-transparent" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute w-0.5 h-0.5 bg-white/20 rounded-full animate-pulse" style={{ left: `${15 + i * 20}%`, top: `${10 + i * 12}%`, animationDelay: `${i * 0.5}s` }} />
          ))}
        </div>

        {isWaiting && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-10 transition-all duration-500"
            style={{ opacity: waitingVisible ? 1 : 0, transform: waitingVisible ? "scale(1)" : "scale(0.95)" }}
          >
            <div className="text-5xl mb-3 animate-bounce">🚀</div>
            <span className="text-white font-extrabold text-sm tracking-wider uppercase">Ожидание раунда</span>
            <div className="w-40 h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#16a34a] to-[#22c55e] rounded-full transition-all duration-100" style={{ width: `${roundProgress}%` }} />
            </div>
          </div>
        )}
        {isFlying && (
          <div className="absolute inset-0 z-10">
            {renderGraph()}
            <div className="absolute top-4 left-4">
              <div className="text-white font-extrabold text-4xl leading-none" style={{ textShadow: "0 0 20px rgba(34,197,94,0.5)" }}>
                x{multiplier.toFixed(2)}
              </div>
            </div>
          </div>
        )}
        {isCrashed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="text-red-500 font-extrabold text-5xl leading-none animate-pulse">x{multiplier.toFixed(2)}</div>
            <div className="text-red-400 font-bold text-base mt-2 uppercase tracking-wider">Улетел!</div>
          </div>
        )}
      </div>

      <div className="px-3 pt-3 pb-4 space-y-2.5 shrink-0">
        <BetPanel {...panel1Props} />
        <BetPanel {...panel2Props} />
      </div>
    </div>
  );
}
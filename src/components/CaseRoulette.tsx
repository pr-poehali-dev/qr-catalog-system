import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import {
  COIN_SIZE, VISIBLE_COINS, TOTAL_COINS, SPIN_DURATION,
  type Rarity, type Coin, RARITY_COLORS, RARITY_LABEL,
  generateCoins, pickWinValue, apiBet, apiWin,
} from "./case-roulette/caseRouletteConfig";
import Confetti from "./case-roulette/Confetti";
import CoinVisual from "./case-roulette/CoinVisual";

interface CaseRouletteProps {
  caseValue: number;
  currency: "usdt" | "stars";
  balance: number;
  userId: string;
  onBalanceSet: (balance: number) => void;
  onClose: () => void;
}

export default function CaseRoulette({ caseValue, currency, balance, userId, onBalanceSet, onClose }: CaseRouletteProps) {
  const currencySymbol = currency === "usdt" ? "$" : "★";
  const [coins, setCoins] = useState<Coin[]>(() => generateCoins(currencySymbol, caseValue));
  const [spinning, setSpinning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [winCoin, setWinCoin] = useState<Coin | null>(null);
  const [offset, setOffset] = useState(0);
  const [notEnough, setNotEnough] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [phase, setPhase] = useState<"spin" | "result">("spin");
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const winIndexRef = useRef(0);
  const spinningRef = useRef(false);
  const finishedRef = useRef(false);
  const balanceRef = useRef(balance);

  useEffect(() => { balanceRef.current = balance; }, [balance]);

  const runSpin = useCallback(async (currentCoins: Coin[]) => {
    if (spinningRef.current || finishedRef.current) return;

    if (balanceRef.current < caseValue) {
      setNotEnough(true);
      return;
    }

    const betResult = await apiBet(userId, caseValue, currency);
    if (!betResult.ok) {
      setNotEnough(true);
      return;
    }
    if (betResult.balance !== undefined) onBalanceSet(betResult.balance);

    const win = pickWinValue(caseValue);
    const desiredWinValue = win.value;
    const desiredRarity = win.rarity;
    let targetIdx = currentCoins.findIndex((c) => c.value === desiredWinValue);
    if (targetIdx === -1 || targetIdx < VISIBLE_COINS + 5) {
      for (let i = TOTAL_COINS - 10; i >= VISIBLE_COINS + 5; i--) {
        if (currentCoins[i].value === desiredWinValue) { targetIdx = i; break; }
      }
    }
    if (targetIdx < VISIBLE_COINS + 5) {
      currentCoins[TOTAL_COINS - 8] = { value: desiredWinValue, label: `${desiredWinValue}${currencySymbol}`, rarity: desiredRarity };
      targetIdx = TOTAL_COINS - 8;
    }

    winIndexRef.current = targetIdx;
    spinningRef.current = true;
    setSpinning(true);

    const containerWidth = containerRef.current?.offsetWidth || COIN_SIZE * VISIBLE_COINS;
    const centerOffset = containerWidth / 2 - COIN_SIZE / 2;
    const targetOffset = targetIdx * (COIN_SIZE + 16) - centerOffset;
    const startTime = performance.now();

    function easeOutQuart(t: number) { return 1 - Math.pow(1 - t, 4); }

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      setOffset(targetOffset * easeOutQuart(progress));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        spinningRef.current = false;
        finishedRef.current = true;
        setSpinning(false);
        setFinished(true);
        const wc = currentCoins[targetIdx];
        setWinCoin(wc);
        apiWin(userId, wc.value, currency).then((res) => {
          if (res.balance !== undefined) onBalanceSet(res.balance);
        });
        setTimeout(() => {
          setShowResult(true);
          setPhase("result");
          setConfettiActive(true);
        }, 600);
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }, [caseValue, currencySymbol, userId, currency, onBalanceSet]);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  useEffect(() => {
    const coinsSnap = coins;
    const timer = setTimeout(() => runSpin(coinsSnap), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenAgain = async () => {
    if (balanceRef.current < caseValue) { setNotEnough(true); return; }

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const newCoins = generateCoins(currencySymbol, caseValue);
    spinningRef.current = false;
    finishedRef.current = false;

    setCoins(newCoins);
    setSpinning(false);
    setFinished(false);
    setWinCoin(null);
    setOffset(0);
    setNotEnough(false);
    setShowResult(false);
    setConfettiActive(false);
    setPhase("spin");

    setTimeout(() => runSpin(newCoins), 100);
  };

  const winRarityData = winCoin ? RARITY_COLORS[winCoin.rarity] : null;

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes spinnerGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(74,222,128,0.4); }
          50%       { box-shadow: 0 0 50px rgba(74,222,128,1), 0 0 80px rgba(74,222,128,0.5); }
        }
        @keyframes coinPulse {
          0%, 100% { transform: scale(1.08); }
          50%       { transform: scale(1.16); }
        }
        @keyframes coinSpin {
          0%   { filter: brightness(1); }
          50%  { filter: brightness(1.3); }
          100% { filter: brightness(1); }
        }
        @keyframes resultSlideUp {
          from { opacity: 0; transform: translateY(50px) scale(0.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bigCoinAppear {
          0%   { opacity: 0; transform: scale(0.2) rotate(-30deg); }
          60%  { transform: scale(1.18) rotate(6deg); }
          80%  { transform: scale(0.94) rotate(-2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes starSparkle {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          50%       { opacity: 1; transform: scale(1) rotate(180deg); }
        }
        @keyframes floatDot {
          0%   { opacity: 0; transform: translateY(0) scale(0.8); }
          30%  { opacity: 1; transform: translateY(-6px) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.6); }
        }
        @keyframes shimmerBar {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
        @keyframes rarityBadgePop {
          0%   { opacity: 0; transform: scale(0.5); }
          70%  { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[300] flex flex-col"
        style={{ background: "linear-gradient(180deg, #080812 0%, #0d0d1f 50%, #08080f 100%)" }}
      >
        {phase === "spin" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 pt-5 pb-4">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
              >
                <Icon name="ChevronLeft" size={18} />
                <span className="text-sm">Другие кейсы</span>
              </button>
              <div className="text-center">
                <div className="text-white/40 text-[10px] uppercase tracking-widest">Кейс</div>
                <div className="text-white font-bold text-base">{caseValue}{currencySymbol}</div>
              </div>
              <div className="w-20" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-4 gap-8">
              <div className="w-full relative">
                <div
                  className="absolute left-1/2 -translate-x-1/2 -top-4 z-30"
                  style={{ filter: "drop-shadow(0 0 10px #4ade80)" }}
                >
                  <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#4ade80]" />
                </div>
                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-4 z-30"
                  style={{ filter: "drop-shadow(0 0 10px #4ade80)" }}
                >
                  <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-b-[20px] border-l-transparent border-r-transparent border-b-[#4ade80]" />
                </div>

                <div
                  className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] z-20 rounded-full"
                  style={{
                    background: "linear-gradient(180deg, transparent, #4ade80 30%, #4ade80 70%, transparent)",
                    animation: spinning ? "spinnerGlow 0.7s ease-in-out infinite" : "none",
                    boxShadow: "0 0 14px rgba(74,222,128,0.8)",
                  }}
                />

                <div
                  className="overflow-hidden rounded-2xl"
                  ref={containerRef}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: spinning
                      ? "0 0 50px rgba(74,222,128,0.2), inset 0 0 40px rgba(0,0,0,0.5)"
                      : "inset 0 0 40px rgba(0,0,0,0.5)",
                  }}
                >
                  <div className="py-3 px-2">
                    <div
                      className="flex gap-4"
                      style={{ transform: `translateX(-${offset}px)`, willChange: "transform" }}
                    >
                      {coins.map((coin, i) => {
                        const isWin = finished && i === winIndexRef.current;
                        return (
                          <CoinVisual
                            key={i}
                            rarity={coin.rarity}
                            value={coin.value}
                            symbol={currencySymbol}
                            size={COIN_SIZE}
                            isWin={isWin}
                            spinning={spinning}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div
                  className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none rounded-l-2xl"
                  style={{ background: "linear-gradient(90deg, #080812, transparent)" }}
                />
                <div
                  className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none rounded-r-2xl"
                  style={{ background: "linear-gradient(270deg, #080812, transparent)" }}
                />
              </div>

              {spinning && (
                <div className="flex gap-2 items-end h-6">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: `hsl(${120 + i * 30}, 80%, 60%)`,
                        animation: `floatDot 1s ease-in-out infinite`,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {notEnough && !spinning && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Icon name="AlertCircle" size={28} className="text-red-400" />
                  </div>
                  <span className="text-red-400 font-bold text-base">Недостаточно средств</span>
                  <span className="text-white/40 text-sm text-center">
                    Нужно {caseValue}{currencySymbol} — у тебя {currency === "usdt" ? balance.toFixed(2) : Math.floor(balance)}{currencySymbol}
                  </span>
                </div>
              )}
            </div>

            <div className="px-4 pb-8 pt-4">
              <button
                onClick={onClose}
                disabled={spinning}
                className="w-full py-4 rounded-2xl text-white/60 text-sm font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {spinning ? "Крутим..." : "Закрыть"}
              </button>
            </div>
          </div>
        )}

        {phase === "result" && winCoin && winRarityData && showResult && (
          <div className="relative flex flex-col h-full items-center overflow-hidden">
            <Confetti active={confettiActive} rarity={winCoin.rarity} />

            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% 35%, ${winRarityData.glow}30 0%, transparent 65%)`,
                animation: "glowPulse 2s ease-in-out infinite",
              }}
            />

            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 relative z-10"
              style={{ animation: "resultSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
            >
              <div className="text-white/40 text-xs uppercase tracking-[0.2em] font-medium">Ты выиграл</div>

              <div className="relative" style={{ animation: "bigCoinAppear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="absolute"
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: winRarityData.border,
                      top: `${[5, 85, 50, 20][i]}%`,
                      left: `${[-8, 105, 110, -12][i]}%`,
                      animation: `starSparkle 1.5s ease-in-out infinite`,
                      animationDelay: `${i * 0.3}s`,
                    }}
                  />
                ))}
                <CoinVisual
                  rarity={winCoin.rarity}
                  value={winCoin.value}
                  symbol={currencySymbol}
                  size={160}
                  isWin
                />
              </div>

              <div className="text-center">
                <div className="font-extrabold text-4xl leading-none" style={{ color: winRarityData.text, textShadow: `0 0 24px ${winRarityData.glow}` }}>
                  {winCoin.value}{currencySymbol}
                </div>
                <div className="h-1 w-24 mx-auto mt-3 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${winRarityData.border}, transparent)`,
                    animation: "shimmerBar 2s linear infinite",
                    backgroundSize: "200% 100%",
                  }}
                />
              </div>

              <div
                className="px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{
                  background: `${winRarityData.bg2}44`,
                  color: winRarityData.text,
                  border: `1px solid ${winRarityData.border}55`,
                  animation: "rarityBadgePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both",
                  boxShadow: `0 0 16px ${winRarityData.glow}44`,
                }}
              >
                {RARITY_LABEL[winCoin.rarity]}
              </div>

              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={handleOpenAgain}
                  className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.97]"
                  style={{
                    background: `linear-gradient(135deg, ${winRarityData.bg1}, ${winRarityData.bg2})`,
                    color: winCoin.rarity === "legendary" ? "#1a0a00" : "#fff",
                    boxShadow: `0 4px 24px ${winRarityData.glow}77`,
                    border: `1px solid ${winRarityData.border}55`,
                  }}
                >
                  Открыть ещё раз за {caseValue}{currencySymbol}
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-4 rounded-2xl font-semibold text-sm text-white/70 transition-all active:scale-[0.97]"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Забрать и выйти
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

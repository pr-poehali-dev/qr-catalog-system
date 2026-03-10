import { type Rarity, RARITY_COLORS } from "./caseRouletteConfig";

export default function CoinVisual({
  rarity,
  value,
  symbol,
  size,
  isWin,
  spinning,
}: {
  rarity: Rarity;
  value: number;
  symbol: string;
  size: number;
  isWin?: boolean;
  spinning?: boolean;
}) {
  const rc = RARITY_COLORS[rarity];
  const fontSize = size < 70 ? (value >= 100 ? 11 : 13) : size < 100 ? (value >= 100 ? 13 : 16) : (value >= 1000 ? 28 : value >= 100 ? 34 : 40);
  const symSize = size < 70 ? 10 : size < 100 ? 14 : 20;

  return (
    <div
      className="relative flex-shrink-0 flex flex-col items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 28%, ${rc.bg1}, ${rc.bg2} 50%, ${rc.bg3})`,
        border: `${size >= 140 ? 3 : 2}px solid ${isWin ? rc.border : rc.border + "88"}`,
        boxShadow: isWin
          ? `0 0 30px ${rc.glow}, 0 0 60px ${rc.glow}66, inset 0 1px 0 rgba(255,255,255,0.3)`
          : `0 0 10px ${rc.glow}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
        animation: isWin ? "coinPulse 0.8s ease-in-out infinite" : spinning ? "coinSpin 0.3s linear infinite" : "none",
        transition: "box-shadow 0.3s ease",
      }}
    >
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle at 35% 25%, rgba(255,255,255,0.35), transparent 55%)" }}
      />
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle at 65% 80%, rgba(0,0,0,0.3), transparent 50%)" }}
      />
      {size >= 140 && (
        <div
          className="absolute inset-3 rounded-full pointer-events-none"
          style={{ border: `1px solid ${rc.border}44` }}
        />
      )}
      <span
        className="font-extrabold relative z-10 leading-none"
        style={{
          fontSize,
          color: "#fff",
          textShadow: `0 0 12px ${rc.glow}, 0 2px 4px rgba(0,0,0,0.9)`,
        }}
      >
        {value}
      </span>
      <span
        className="font-bold relative z-10 leading-none"
        style={{
          fontSize: symSize,
          color: rc.text,
          textShadow: `0 0 8px ${rc.glow}`,
        }}
      >
        {symbol}
      </span>
    </div>
  );
}

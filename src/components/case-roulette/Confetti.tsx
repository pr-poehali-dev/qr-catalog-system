import { useState, useEffect } from "react";
import { type Rarity, RARITY_COLORS } from "./caseRouletteConfig";

interface ConfettiParticle {
  id: number;
  x: number;
  color: string;
  rotation: number;
  scale: number;
  shape: "rect" | "circle" | "star";
  delay: number;
  duration: number;
}

export default function Confetti({ active, rarity }: { active: boolean; rarity: Rarity }) {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const colors = RARITY_COLORS[rarity].confetti;
  const count = rarity === "legendary" ? 90 : rarity === "epic" ? 70 : rarity === "rare" ? 50 : 30;

  useEffect(() => {
    if (!active) return;
    const pts: ConfettiParticle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 1.2,
      shape: (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 2,
    }));
    setParticles(pts);
    const timeout = setTimeout(() => setParticles([]), 4000);
    return () => clearTimeout(timeout);
  }, [active]);

  if (!particles.length) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
          }}
        >
          {p.shape === "rect" ? (
            <div style={{ width: 8, height: 14, background: p.color, borderRadius: 2, opacity: 0.9 }} />
          ) : p.shape === "circle" ? (
            <div style={{ width: 10, height: 10, background: p.color, borderRadius: "50%", opacity: 0.85 }} />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill={p.color} opacity={0.9}>
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

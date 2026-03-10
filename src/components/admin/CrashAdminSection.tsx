import { useState } from "react";
import Icon from "@/components/ui/icon";
import { GameSettings, ADMIN_URL } from "./types";

const CRASH_PRESETS = [
  { label: "50/50", desc: "Честная игра (ничего не меняется)", chance: 50, color: "text-[#4ade80]", bg: "bg-[#4ade80]/10", border: "border-[#4ade80]/20" },
  { label: "30/70", desc: "Небольшое преимущество казино", chance: 30, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  { label: "Тотальный слив", desc: "Краш всегда в диапазоне 1.00–1.60", chance: 5, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
];

interface Props {
  gameSettings: GameSettings[];
  adminDisplayId: number;
  onChanceChange: (chance: number) => void;
  onRefresh: () => void;
}

export default function CrashAdminSection({ gameSettings, adminDisplayId, onChanceChange, onRefresh }: Props) {
  const [forceCrashInput, setForceCrashInput] = useState("");
  const [forceStatus, setForceStatus] = useState<string>("");

  const crashSettings = gameSettings.find(g => g.game_name === "crash");
  const currentChance = crashSettings?.win_chance ?? 50;

  const handleForceCrash = async () => {
    const val = parseFloat(forceCrashInput);
    if (!val || val < 1.01) {
      setForceStatus("Минимум 1.01");
      return;
    }
    try {
      const res = await fetch(`${ADMIN_URL}?action=force_crash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: String(adminDisplayId), crash_at: val }),
      });
      const data = await res.json();
      if (data.ok) {
        setForceStatus(`Следующий краш на x${val}`);
        setForceCrashInput("");
        setTimeout(() => setForceStatus(""), 4000);
      } else {
        setForceStatus(data.error || "Ошибка");
      }
    } catch {
      setForceStatus("Ошибка сети");
    }
  };

  return (
    <div className="mt-6">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Icon name="Rocket" fallback="Zap" size={20} className="text-orange-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Crash</p>
            <p className="text-white/30 text-[11px]">Lucky Jet</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-white/50 text-[10px]">Текущий режим</p>
            <p className={`font-bold text-sm ${currentChance >= 50 ? "text-[#4ade80]" : currentChance >= 30 ? "text-yellow-400" : "text-red-400"}`}>
              {currentChance >= 50 ? "Честная" : currentChance >= 30 ? "30/70" : "Слив"}
            </p>
          </div>
        </div>

        <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${currentChance >= 50 ? "bg-[#4ade80]" : currentChance >= 30 ? "bg-yellow-400" : "bg-red-400"}`}
            style={{ width: `${currentChance}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-white/20">
          <span>Игрок проигрывает</span>
          <span>Игрок выигрывает</span>
        </div>
      </div>

      <p className="text-white/30 text-[11px] uppercase tracking-wider mb-2 px-1">Режим Crash</p>

      <div className="flex flex-col gap-2">
        {CRASH_PRESETS.map(p => {
          const isActive = currentChance === p.chance;
          return (
            <button
              key={p.chance}
              onClick={() => onChanceChange(p.chance)}
              className={`flex items-center gap-3 rounded-2xl p-3.5 border transition-all active:scale-[0.98] text-left
                ${isActive ? `${p.bg} ${p.border}` : "bg-white/[0.02] border-white/[0.05]"}`}
            >
              <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center shrink-0`}>
                <span className={`font-bold text-sm ${p.color}`}>{p.chance}%</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${isActive ? p.color : "text-white"}`}>{p.label}</p>
                <p className="text-white/30 text-[11px]">{p.desc}</p>
              </div>
              {isActive && (
                <div className={`w-6 h-6 rounded-full ${p.bg} flex items-center justify-center shrink-0`}>
                  <Icon name="Check" size={14} className={p.color} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 bg-white/[0.03] border border-purple-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Crosshair" fallback="Target" size={16} className="text-purple-400" />
          <p className="text-purple-300 font-bold text-sm">Принудительный краш</p>
        </div>
        <p className="text-white/40 text-[11px] mb-3">
          Укажи коэффициент — следующий раунд крашнется именно на нём. Работает один раз.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-[#13112a] border border-white/10 rounded-xl px-3 h-10">
            <span className="text-white/30 text-sm mr-1">x</span>
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={forceCrashInput}
              onChange={e => setForceCrashInput(e.target.value)}
              placeholder="1.50"
              className="flex-1 bg-transparent text-white font-bold text-sm outline-none min-w-0 [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
            />
          </div>
          <button
            onClick={handleForceCrash}
            disabled={!forceCrashInput}
            className="px-4 h-10 rounded-xl bg-purple-600 text-white font-bold text-sm active:scale-95 disabled:opacity-30"
          >
            Применить
          </button>
        </div>
        {forceStatus && (
          <p className={`text-xs mt-2 ${forceStatus.includes("Ошибка") || forceStatus.includes("Минимум") ? "text-red-400" : "text-green-400"}`}>
            {forceStatus}
          </p>
        )}
      </div>

      <div className="mt-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3">
        <p className="text-white/20 text-[10px] uppercase tracking-wider mb-1">Как работает Crash</p>
        <p className="text-white/40 text-[11px] leading-relaxed">
          50/50 — честная генерация. 30/70 — чаще крашится рано, но иногда улетает высоко.
          Тотальный слив — краш всегда в диапазоне 1.00–1.60. Принудительный краш — задаёшь точный коэффициент на один раунд.
        </p>
      </div>
    </div>
  );
}
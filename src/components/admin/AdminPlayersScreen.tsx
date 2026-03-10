import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Player, Stats, ADMIN_URL, formatDate } from "./types";

interface AdminPlayersScreenProps {
  players: Player[];
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onSearch: () => void;
  actionLoading: number | null;
  onBlock: (p: Player, reason: string) => void;
  onUnblock: (p: Player) => void;
  onEditBalance: (p: Player) => void;
  editingPlayer: Player | null;
  newBalance: string;
  onNewBalanceChange: (v: string) => void;
  onSetBalance: () => void;
  onCancelEdit: () => void;
  onBack: () => void;
}

export function AdminPlayersScreen({
  players, loading, search, onSearchChange, onSearch,
  actionLoading, onBlock, onUnblock, onEditBalance,
  editingPlayer, newBalance, onNewBalanceChange, onSetBalance, onCancelEdit,
  onBack,
}: AdminPlayersScreenProps) {
  const [blockingPlayer, setBlockingPlayer] = useState<Player | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockError, setBlockError] = useState("");

  const handleBlockSubmit = () => {
    if (!blockingPlayer) return;
    if (!blockReason.trim()) {
      setBlockError("Укажите причину блокировки");
      return;
    }
    onBlock(blockingPlayer, blockReason.trim());
    setBlockingPlayer(null);
    setBlockReason("");
    setBlockError("");
  };

  const handleCancelBlock = () => {
    setBlockingPlayer(null);
    setBlockReason("");
    setBlockError("");
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center active:bg-white/10 transition-colors shrink-0">
          <Icon name="ChevronLeft" size={18} className="text-white/60" />
        </button>
        <h2 className="text-white font-bold text-[18px]">Игроки</h2>
      </div>

      <div className="px-4 py-3">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 gap-2">
            <Icon name="Search" size={15} className="text-white/25 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="ID, имя или Telegram..."
              className="bg-transparent text-white text-[14px] py-3 outline-none w-full placeholder:text-white/20"
            />
          </div>
          <button
            onClick={onSearch}
            className="bg-[#4ade80] text-black font-semibold text-[13px] rounded-xl px-4 active:bg-[#3ecb6e] transition-colors"
          >
            <Icon name="Search" size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Icon name="Loader2" size={30} className="text-[#4ade80] animate-spin" />
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Icon name="UserX" size={44} className="text-white/10 mb-3" />
            <span className="text-white/30 text-[14px]">Игроки не найдены</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <div key={p.id} className={`bg-white/[0.04] border rounded-2xl px-4 py-3.5 ${p.is_blocked ? "border-red-500/20" : "border-white/[0.07]"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${p.is_blocked ? "bg-red-500/10" : "bg-[#4ade80]/8"}`}>
                    <Icon name={p.is_blocked ? "Ban" : "User"} size={16} className={p.is_blocked ? "text-red-400" : "text-[#4ade80]/60"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-white font-semibold text-[14px] truncate">{p.name || "Без имени"}</span>
                      {p.is_blocked && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full shrink-0">Блок</span>}
                    </div>
                    <div className="text-white/30 text-[11px]">ID: {p.display_id} · TG: {p.telegram_id || "—"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[#4ade80] font-bold text-[14px]">{p.balance.toFixed(2)}</div>
                    <div className="text-white/20 text-[10px]">USDT</div>
                  </div>
                </div>
                {p.is_blocked && p.block_reason && (
                  <div className="mt-2 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
                    <span className="text-red-400/60 text-[11px]">Причина: </span>
                    <span className="text-red-400 text-[11px]">{p.block_reason}</span>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onEditBalance(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 text-[12px] font-semibold rounded-xl py-2 active:bg-blue-500/20 transition-colors"
                  >
                    <Icon name="Pencil" size={13} />
                    Баланс
                  </button>
                  {p.is_blocked ? (
                    <button
                      onClick={() => onUnblock(p)}
                      disabled={actionLoading === p.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#4ade80]/10 text-[#4ade80] text-[12px] font-semibold rounded-xl py-2 active:bg-[#4ade80]/20 transition-colors disabled:opacity-40"
                    >
                      {actionLoading === p.id ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Unlock" size={13} />}
                      Разблок
                    </button>
                  ) : (
                    <button
                      onClick={() => setBlockingPlayer(p)}
                      disabled={actionLoading === p.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/10 text-red-400 text-[12px] font-semibold rounded-xl py-2 active:bg-red-500/20 transition-colors disabled:opacity-40"
                    >
                      {actionLoading === p.id ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Ban" size={13} />}
                      Блок
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {blockingPlayer && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60">
          <div className="bg-[#111] border border-white/[0.08] rounded-t-3xl p-5 w-full">
            <div className="w-8 h-1 bg-white/10 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Icon name="Ban" size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-[16px]">Заблокировать</h3>
                <p className="text-white/35 text-[12px]">{blockingPlayer.name || "Игрок"} · ID {blockingPlayer.display_id}</p>
              </div>
            </div>
            <textarea
              value={blockReason}
              onChange={(e) => { setBlockReason(e.target.value); setBlockError(""); }}
              placeholder="Причина блокировки..."
              rows={3}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-[14px] outline-none focus:border-red-500/40 mb-1 placeholder:text-white/20 resize-none"
            />
            {blockError && <p className="text-red-400 text-[12px] mb-3">{blockError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={handleCancelBlock} className="flex-1 bg-white/[0.06] text-white/50 font-semibold text-[14px] rounded-xl py-3">Отмена</button>
              <button
                onClick={handleBlockSubmit}
                disabled={actionLoading === blockingPlayer.id}
                className="flex-1 bg-red-500 text-white font-bold text-[14px] rounded-xl py-3 disabled:opacity-50"
              >
                {actionLoading === blockingPlayer.id ? "..." : "Заблокировать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPlayer && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60">
          <div className="bg-[#111] border border-white/[0.08] rounded-t-3xl p-5 w-full">
            <div className="w-8 h-1 bg-white/10 rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-[16px] mb-1">Изменить баланс</h3>
            <p className="text-white/35 text-[12px] mb-4">{editingPlayer.name || "Игрок"} · ID {editingPlayer.display_id}</p>
            <input
              type="number"
              value={newBalance}
              onChange={(e) => onNewBalanceChange(e.target.value)}
              placeholder="Новый баланс USDT"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-[15px] outline-none focus:border-[#4ade80]/40 mb-4 placeholder:text-white/20"
            />
            <div className="flex gap-2">
              <button onClick={onCancelEdit} className="flex-1 bg-white/[0.06] text-white/50 font-semibold text-[14px] rounded-xl py-3">Отмена</button>
              <button onClick={onSetBalance} disabled={actionLoading === editingPlayer.id} className="flex-1 bg-[#4ade80] text-black font-bold text-[14px] rounded-xl py-3 disabled:opacity-50">
                {actionLoading === editingPlayer.id ? "..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Аналитика ────────────────────────────────────────────────────────────────

interface AdminStatsScreenProps {
  stats: Stats | null;
  loading: boolean;
  onBack: () => void;
}

export function AdminStatsScreen({ stats, loading, onBack }: AdminStatsScreenProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center active:bg-white/10 transition-colors shrink-0">
          <Icon name="ChevronLeft" size={18} className="text-white/60" />
        </button>
        <h2 className="text-white font-bold text-[18px]">Аналитика</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading || !stats ? (
          <div className="flex items-center justify-center h-48">
            <Icon name="Loader2" size={30} className="text-[#4ade80] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Игроков", value: stats.total_users, icon: "Users", color: "text-[#4ade80]", bg: "bg-[#4ade80]/10", border: "border-[#4ade80]/15" },
              { label: "Заблокировано", value: stats.blocked_users, icon: "Ban", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/15" },
              { label: "Общий баланс", value: `${stats.total_balance.toFixed(2)} USDT`, icon: "Wallet", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/15" },
              { label: "Платежей", value: stats.total_payments, icon: "CreditCard", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/15" },
            ].map((item) => (
              <div key={item.label} className={`bg-white/[0.03] border ${item.border} rounded-2xl p-4`}>
                <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
                  <Icon name={item.icon} size={18} className={item.color} />
                </div>
                <div className="text-white/40 text-[11px] mb-1">{item.label}</div>
                <div className={`font-bold text-[22px] leading-tight ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// экспорт для использования в AdminPanel
export { ADMIN_URL, formatDate };
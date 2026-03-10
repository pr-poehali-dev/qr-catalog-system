import { useState } from "react";
import Icon from "@/components/ui/icon";
import {
  AdminUser, Withdrawal, Voucher,
  ROLE_OWNER, ROLE_CHIEF, ROLE_ADMIN, ROLE_TECH,
  ROLE_NAMES, ROLE_COLORS,
  formatDate, roleDotColor,
} from "./types";

// ── Вспомогательный спиннер ───────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <Icon name="Loader2" size={30} className="text-[#4ade80] animate-spin" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ЭКРАН ADMIN
// ══════════════════════════════════════════════════════════════════════════════

interface AdminsScreenProps {
  admins: AdminUser[];
  loading: boolean;
  adminDisplayId: string | number;
  adminRole: number;
  actionLoading: number | null;
  onRemove: (a: AdminUser) => void;
  onChangeRole: (newRole: number) => void;
  onBack: () => void;
  onAddAdmin: (displayId: string, role: number) => Promise<void>;
}

export function AdminsScreen({
  admins, loading, adminDisplayId, adminRole,
  actionLoading, onRemove, onChangeRole, onBack, onAddAdmin,
}: AdminsScreenProps) {
  const canManageAdmins = adminRole <= ROLE_CHIEF;
  const isOwner = adminRole === ROLE_OWNER;

  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState("");
  const [addRole, setAddRole] = useState(ROLE_ADMIN);
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [changeRoleAdmin, setChangeRoleAdmin] = useState<AdminUser | null>(null);
  const [changeRoleValue, setChangeRoleValue] = useState(ROLE_ADMIN);

  const roleOptions = [
    { role: ROLE_CHIEF, label: "Гл.Администратор" },
    { role: ROLE_ADMIN, label: "Администратор" },
    { role: ROLE_TECH, label: "Тех.Специалист" },
  ];

  const handleAdd = async () => {
    if (!addId.trim()) { setAddError("Введите ID игрока"); return; }
    setAddError("");
    setAddLoading(true);
    await onAddAdmin(addId.trim(), addRole);
    setAddLoading(false);
    setAddOpen(false);
    setAddId("");
    setAddRole(ROLE_ADMIN);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center active:bg-white/10 transition-colors shrink-0">
          <Icon name="ChevronLeft" size={18} className="text-white/60" />
        </button>
        <h2 className="text-white font-bold text-[18px] flex-1">Админы</h2>
        {canManageAdmins && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 bg-[#4ade80] text-black font-semibold text-[12px] rounded-xl px-3 py-2 active:bg-[#3ecb6e] transition-colors"
          >
            <Icon name="Plus" size={14} />
            Добавить
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? <Spinner /> : admins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Icon name="ShieldOff" size={44} className="text-white/10 mb-3" />
            <span className="text-white/30 text-[14px]">Нет администраторов</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {admins.map((a) => {
              const rc = ROLE_COLORS[a.role] || ROLE_COLORS[ROLE_TECH];
              const isMe = a.display_id === Number(adminDisplayId);
              return (
                <div key={a.id} className={`bg-white/[0.04] border ${rc.border} rounded-2xl px-4 py-3.5`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${rc.bg}`}>
                      <Icon name="Shield" size={16} className={rc.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-white font-semibold text-[14px] truncate">{a.user_name || a.custom_name || "Администратор"}</span>
                        {isMe && <span className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded-full">Вы</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[11px] font-semibold ${rc.text}`}>{ROLE_NAMES[a.role]}</span>
                        <span className="text-white/20 text-[11px]">· ID {a.display_id}</span>
                      </div>
                    </div>
                  </div>
                  {!isMe && canManageAdmins && a.role > adminRole && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setChangeRoleAdmin(a); setChangeRoleValue(a.role); }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-400 text-[12px] font-semibold rounded-xl py-2 active:bg-blue-500/20 transition-colors"
                      >
                        <Icon name="Pencil" size={13} />
                        Роль
                      </button>
                      <button
                        onClick={() => onRemove(a)}
                        disabled={actionLoading === a.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/10 text-red-400 text-[12px] font-semibold rounded-xl py-2 active:bg-red-500/20 transition-colors disabled:opacity-40"
                      >
                        {actionLoading === a.id ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Trash2" size={13} />}
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модал: добавить */}
      {addOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/60">
          <div className="bg-[#111] border border-white/[0.08] rounded-t-3xl p-5 w-full">
            <div className="w-8 h-1 bg-white/10 rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-[16px] mb-4">Добавить администратора</h3>
            <input
              type="number"
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
              placeholder="ID игрока"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-[15px] outline-none focus:border-[#4ade80]/40 mb-3 placeholder:text-white/20"
            />
            <div className="flex flex-col gap-1.5 mb-4">
              {roleOptions.map((r) => {
                if (!isOwner && r.role === ROLE_CHIEF) return null;
                const rc = ROLE_COLORS[r.role];
                return (
                  <button key={r.role} onClick={() => setAddRole(r.role)} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${addRole === r.role ? `${rc.border} ${rc.bg}` : "border-white/[0.05] bg-white/[0.02]"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${addRole === r.role ? rc.border : "border-white/20"}`}>
                      {addRole === r.role && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: roleDotColor(r.role) }} />}
                    </div>
                    <span className={`text-[13px] font-semibold ${addRole === r.role ? rc.text : "text-white/50"}`}>{r.label}</span>
                  </button>
                );
              })}
            </div>
            {addError && <div className="text-red-400 text-[12px] mb-3">{addError}</div>}
            <div className="flex gap-2">
              <button onClick={() => { setAddOpen(false); setAddError(""); }} className="flex-1 bg-white/[0.06] text-white/50 font-semibold text-[14px] rounded-xl py-3">Отмена</button>
              <button onClick={handleAdd} disabled={addLoading} className="flex-1 bg-[#4ade80] text-black font-bold text-[14px] rounded-xl py-3 disabled:opacity-50">
                {addLoading ? "..." : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модал: изменить роль */}
      {changeRoleAdmin && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/60">
          <div className="bg-[#111] border border-white/[0.08] rounded-t-3xl p-5 w-full">
            <div className="w-8 h-1 bg-white/10 rounded-full mx-auto mb-5" />
            <h3 className="text-white font-bold text-[16px] mb-1">Изменить роль</h3>
            <p className="text-white/35 text-[12px] mb-4">{changeRoleAdmin.user_name || "Админ"} · ID {changeRoleAdmin.display_id}</p>
            <div className="flex flex-col gap-1.5 mb-4">
              {roleOptions.map((r) => {
                const rc = ROLE_COLORS[r.role];
                return (
                  <button key={r.role} onClick={() => setChangeRoleValue(r.role)} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${changeRoleValue === r.role ? `${rc.border} ${rc.bg}` : "border-white/[0.05] bg-white/[0.02]"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${changeRoleValue === r.role ? rc.border : "border-white/20"}`}>
                      {changeRoleValue === r.role && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: roleDotColor(r.role) }} />}
                    </div>
                    <span className={`text-[13px] font-semibold ${changeRoleValue === r.role ? rc.text : "text-white/50"}`}>{r.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setChangeRoleAdmin(null)} className="flex-1 bg-white/[0.06] text-white/50 font-semibold text-[14px] rounded-xl py-3">Отмена</button>
              <button
                onClick={() => { onChangeRole(changeRoleValue); setChangeRoleAdmin(null); }}
                disabled={actionLoading === changeRoleAdmin.id}
                className="flex-1 bg-[#4ade80] text-black font-bold text-[14px] rounded-xl py-3 disabled:opacity-50"
              >
                {actionLoading === changeRoleAdmin.id ? "..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ЭКРАН ВЫВОДЫ
// ══════════════════════════════════════════════════════════════════════════════

interface WithdrawalsScreenProps {
  withdrawals: Withdrawal[];
  withdrawalsLoading: boolean;
  wdFilter: "all" | "pending" | "approved" | "rejected";
  pendingCount: number;
  actionLoading: number | null;
  onFilterChange: (f: "all" | "pending" | "approved" | "rejected") => void;
  onApprove: (w: Withdrawal) => void;
  onReject: (w: Withdrawal) => void;
  onBack: () => void;
}

export function WithdrawalsScreen({
  withdrawals, withdrawalsLoading, wdFilter, pendingCount,
  actionLoading, onFilterChange, onApprove, onReject, onBack,
}: WithdrawalsScreenProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center active:bg-white/10 transition-colors shrink-0">
          <Icon name="ChevronLeft" size={18} className="text-white/60" />
        </button>
        <h2 className="text-white font-bold text-[18px]">Выводы</h2>
      </div>

      <div className="px-4 pt-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => {
          const labels = { pending: "Ожидают", approved: "Одобрены", rejected: "Отклонены", all: "Все" };
          return (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${wdFilter === f ? "bg-[#4ade80] text-black" : "bg-white/[0.05] text-white/40"}`}
            >
              {labels[f]}
              {f === "pending" && pendingCount > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${wdFilter === "pending" ? "bg-black/20 text-black" : "bg-red-500 text-white"}`}>{pendingCount}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {withdrawalsLoading ? <Spinner /> : withdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Icon name="Inbox" size={44} className="text-white/10 mb-3" />
            <span className="text-white/30 text-[14px]">Заявок нет</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            {withdrawals.map((w) => (
              <div key={w.id} className={`bg-white/[0.04] border rounded-2xl px-4 py-3.5 ${w.status === "pending" ? "border-yellow-500/20" : w.status === "approved" ? "border-[#4ade80]/15" : "border-white/[0.07]"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-semibold text-[14px]">{w.user_name || "Игрок"}</span>
                      <span className="text-[10px] font-mono text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded-full">{w.network}</span>
                      {w.status === "pending" && <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">Ожидает</span>}
                      {w.status === "approved" && <span className="text-[10px] text-[#4ade80] bg-[#4ade80]/10 px-1.5 py-0.5 rounded-full">Одобрен</span>}
                      {w.status === "rejected" && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">Отклонён</span>}
                    </div>
                    <div className="text-white/20 text-[11px] font-mono truncate">{w.address}</div>
                    <div className="text-white/20 text-[11px] mt-0.5">ID: {w.display_id} · {formatDate(w.created_at)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-yellow-400 font-bold text-[16px]">{w.amount.toFixed(2)}</div>
                    <div className="text-white/20 text-[10px]">USDT</div>
                  </div>
                </div>
                {w.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onApprove(w)}
                      disabled={actionLoading === w.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#4ade80]/10 text-[#4ade80] text-[12px] font-semibold rounded-xl py-2.5 active:bg-[#4ade80]/20 transition-colors disabled:opacity-40"
                    >
                      {actionLoading === w.id ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
                      Одобрить
                    </button>
                    <button
                      onClick={() => onReject(w)}
                      disabled={actionLoading === w.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/10 text-red-400 text-[12px] font-semibold rounded-xl py-2.5 active:bg-red-500/20 transition-colors disabled:opacity-40"
                    >
                      <Icon name="X" size={13} />
                      Отклонить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ЭКРАН ВАУЧЕРЫ
// ══════════════════════════════════════════════════════════════════════════════

interface VouchersScreenProps {
  vouchers: Voucher[];
  vouchersLoading: boolean;
  actionLoading: number | null;
  onDeactivate: (v: Voucher) => void;
  onCreate: (code: string, amount: string, expiresHours: string, maxUses: string) => Promise<void>;
  onBack: () => void;
}

export function VouchersScreen({
  vouchers, vouchersLoading, actionLoading, onDeactivate, onCreate, onBack,
}: VouchersScreenProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [expiresHours, setExpiresHours] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!amount) { setError("Укажите сумму"); return; }
    if (!maxUses || parseInt(maxUses) < 1) { setError("Укажите количество активаций (min 1)"); return; }
    setError("");
    setCreating(true);
    await onCreate(code, amount, expiresHours, maxUses);
    setCreating(false);
    setModalOpen(false);
    setCode("");
    setAmount("");
    setExpiresHours("");
    setMaxUses("1");
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center active:bg-white/10 transition-colors shrink-0">
          <Icon name="ChevronLeft" size={18} className="text-white/60" />
        </button>
        <h2 className="text-white font-bold text-[18px] flex-1">Ваучеры</h2>
        <button
          onClick={() => { setModalOpen(true); setCode(""); setAmount(""); setExpiresHours(""); setMaxUses("1"); setError(""); }}
          className="flex items-center gap-1.5 bg-[#4ade80] text-black font-semibold text-[12px] rounded-xl px-3 py-2 active:bg-[#3ecb6e] transition-colors"
        >
          <Icon name="Plus" size={14} />
          Создать
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {vouchersLoading ? <Spinner /> : vouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Icon name="Ticket" size={44} className="text-white/10 mb-3" />
            <span className="text-white/30 text-[14px]">Ваучеров нет</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {vouchers.map((v) => {
              const isReallyActive = v.is_active && !v.is_expired && v.uses_count < v.max_uses;
              return (
                <div key={v.id} className={`bg-white/[0.04] border rounded-2xl px-4 py-3.5 ${isReallyActive ? "border-[#4ade80]/15" : "border-white/[0.06]"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isReallyActive ? "bg-[#4ade80]/10" : "bg-white/[0.04]"}`}>
                      <Icon name="Ticket" size={17} className={isReallyActive ? "text-[#4ade80]" : "text-white/20"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-white text-[14px] tracking-widest">{v.code}</span>
                        {isReallyActive
                          ? <span className="text-[10px] text-[#4ade80] bg-[#4ade80]/10 px-1.5 py-0.5 rounded-full">Активен</span>
                          : v.is_expired
                          ? <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">Истёк</span>
                          : <span className="text-[10px] text-white/25 bg-white/[0.05] px-1.5 py-0.5 rounded-full">Использован</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-white/25 text-[11px]">Активаций: {v.uses_count}/{v.max_uses}</span>
                        {v.expires_at && (
                          <span className={`text-[11px] ${v.is_expired ? "text-orange-400" : "text-white/25"}`}>
                            · до {formatDate(v.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <div className="text-[#4ade80] font-bold text-[15px]">{v.amount.toFixed(2)}</div>
                        <div className="text-white/20 text-[10px]">USDT</div>
                      </div>
                      {isReallyActive && (
                        <button
                          onClick={() => onDeactivate(v)}
                          disabled={actionLoading === v.id}
                          className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:bg-red-500/20 transition-colors disabled:opacity-40"
                        >
                          {actionLoading === v.id ? <Icon name="Loader2" size={13} className="text-red-400 animate-spin" /> : <Icon name="X" size={13} className="text-red-400" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модал: создать ваучер */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/60">
          <div className="bg-[#111] border border-white/[0.08] rounded-t-3xl p-5 w-full">
            <div className="w-8 h-1 bg-white/10 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#4ade80]/10 flex items-center justify-center shrink-0">
                <Icon name="Ticket" size={20} className="text-[#4ade80]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-[16px] leading-tight">Создать ваучер</h3>
                <p className="text-white/30 text-[12px]">Игрок введёт код и получит деньги</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="text-white/35 text-[11px] uppercase tracking-wide mb-1.5 block">Код (необязательно)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Авто-генерация"
                  maxLength={20}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white font-mono text-[15px] tracking-widest outline-none focus:border-[#4ade80]/40 placeholder:font-sans placeholder:tracking-normal placeholder:text-white/15"
                />
              </div>
              <div>
                <label className="text-white/35 text-[11px] uppercase tracking-wide mb-1.5 block">Сумма USDT</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Например: 100"
                  min="0.01"
                  step="0.01"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-[15px] outline-none focus:border-[#4ade80]/40 placeholder:text-white/15"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-white/35 text-[11px] uppercase tracking-wide mb-1.5 block">Активаций</label>
                  <input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="1"
                    min="1"
                    step="1"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-[15px] outline-none focus:border-[#4ade80]/40 placeholder:text-white/15"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-white/35 text-[11px] uppercase tracking-wide mb-1.5 block">Часов действия</label>
                  <input
                    type="number"
                    value={expiresHours}
                    onChange={(e) => setExpiresHours(e.target.value)}
                    placeholder="∞ бессрочно"
                    min="1"
                    step="1"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-[15px] outline-none focus:border-[#4ade80]/40 placeholder:text-white/15"
                  />
                </div>
              </div>
            </div>
            {error && <div className="text-red-400 text-[12px] mb-3">{error}</div>}
            <div className="flex gap-2">
              <button onClick={() => setModalOpen(false)} className="flex-1 bg-white/[0.06] text-white/50 font-semibold text-[14px] rounded-xl py-3">Отмена</button>
              <button onClick={handleCreate} disabled={creating} className="flex-1 bg-[#4ade80] text-black font-bold text-[14px] rounded-xl py-3 disabled:opacity-50">
                {creating ? "Создаём..." : "Применить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
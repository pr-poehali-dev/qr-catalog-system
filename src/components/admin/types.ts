export const ADMIN_URL = "https://functions.poehali.dev/6eb840f4-abc2-453e-a7d9-5f9a989722bf";
export const WITHDRAWAL_URL = "https://functions.poehali.dev/9cfe3eb3-a1dd-4e28-806b-4476909e4725";
export const VOUCHER_URL = "https://functions.poehali.dev/67465d27-c387-428b-a82c-c47b677094b2";

export const ROLE_OWNER = 0;
export const ROLE_CHIEF = 1;
export const ROLE_ADMIN = 2;
export const ROLE_TECH = 3;

export const ROLE_NAMES: Record<number, string> = {
  [ROLE_OWNER]: "Владелец",
  [ROLE_CHIEF]: "Гл.Администратор",
  [ROLE_ADMIN]: "Администратор",
  [ROLE_TECH]: "Тех.Специалист",
};

export const ROLE_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  [ROLE_OWNER]: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30" },
  [ROLE_CHIEF]: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  [ROLE_ADMIN]: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
  [ROLE_TECH]: { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30" },
};

export interface Player {
  id: number;
  display_id: number;
  name: string;
  telegram_id: string;
  is_blocked: boolean;
  block_reason: string;
  created_at: string | null;
  balance: number;
}

export interface Stats {
  total_users: number;
  blocked_users: number;
  total_balance: number;
  total_payments: number;
}

export interface AdminUser {
  id: number;
  display_id: number;
  role: number;
  role_name: string;
  created_at: string | null;
  custom_name: string;
  user_name: string;
  telegram_id: string;
}

export interface Withdrawal {
  id: number;
  user_id: number;
  display_id: number;
  user_name: string;
  network: string;
  address: string;
  amount: number;
  status: string;
  created_at: string | null;
  processed_at: string | null;
}

export interface Voucher {
  id: number;
  code: string;
  amount: number;
  is_active: boolean;
  used_by: number | null;
  used_at: string | null;
  created_at: string | null;
  expires_at: string | null;
  max_uses: number;
  uses_count: number;
  is_expired: boolean;
}

export interface GameSettings {
  game_name: string;
  win_chance: number;
  updated_at: string | null;
}

export type Screen = "home" | "players" | "stats" | "admins" | "withdrawals" | "vouchers" | "games";

export function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function roleDotColor(role: number) {
  return role === ROLE_OWNER
    ? "rgb(192 132 252)"
    : role === ROLE_CHIEF
    ? "rgb(248 113 113)"
    : role === ROLE_ADMIN
    ? "rgb(96 165 250)"
    : "rgb(250 204 21)";
}
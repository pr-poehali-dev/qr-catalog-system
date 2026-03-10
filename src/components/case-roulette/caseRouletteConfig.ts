export const COIN_SIZE = 90;
export const VISIBLE_COINS = 5;
export const TOTAL_COINS = 50;
export const SPIN_DURATION = 4500;

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Coin {
  value: number;
  label: string;
  rarity: Rarity;
}

export const RARITY_COLORS: Record<Rarity, {
  bg1: string; bg2: string; bg3: string;
  glow: string; border: string; text: string;
  confetti: string[];
}> = {
  common: {
    bg1: "#6b7280", bg2: "#4b5563", bg3: "#374151",
    glow: "rgba(156,163,175,0.7)", border: "#9ca3af", text: "#e5e7eb",
    confetti: ["#9ca3af", "#d1d5db", "#6b7280", "#f3f4f6"],
  },
  rare: {
    bg1: "#3b82f6", bg2: "#1d4ed8", bg3: "#1e3a8a",
    glow: "rgba(59,130,246,0.8)", border: "#60a5fa", text: "#bfdbfe",
    confetti: ["#3b82f6", "#60a5fa", "#93c5fd", "#1d4ed8", "#06b6d4"],
  },
  epic: {
    bg1: "#a855f7", bg2: "#7c3aed", bg3: "#581c87",
    glow: "rgba(168,85,247,0.85)", border: "#c084fc", text: "#e9d5ff",
    confetti: ["#a855f7", "#c084fc", "#d8b4fe", "#f472b6", "#ec4899", "#7c3aed"],
  },
  legendary: {
    bg1: "#f59e0b", bg2: "#d97706", bg3: "#b45309",
    glow: "rgba(251,191,36,0.95)", border: "#fbbf24", text: "#fef08a",
    confetti: ["#fbbf24", "#fde68a", "#f59e0b", "#fb923c", "#ef4444", "#a3e635", "#34d399"],
  },
};

export interface PrizeTier {
  values: number[];
  weight: number;
  rarity: Rarity;
}

export interface CaseConfig {
  tiers: PrizeTier[];
}

export function getCaseConfig(caseValue: number): CaseConfig {
  const r = (n: number) => {
    if (caseValue >= 100) return Math.round(n);
    if (caseValue >= 20) return Math.round(n * 10) / 10;
    return Math.round(n * 100) / 100;
  };

  const configs: Record<number, CaseConfig> = {
    10: {
      tiers: [
        { rarity: "common",    weight: 60, values: [r(1), r(1.5), r(2), r(2.5), r(3)] },
        { rarity: "rare",      weight: 28, values: [r(4), r(5), r(6), r(7)] },
        { rarity: "epic",      weight: 10, values: [r(10), r(12), r(15)] },
        { rarity: "legendary", weight: 2,  values: [r(20), r(25)] },
      ],
    },
    15: {
      tiers: [
        { rarity: "common",    weight: 60, values: [r(1.5), r(2), r(3), r(4)] },
        { rarity: "rare",      weight: 28, values: [r(6), r(8), r(10), r(12)] },
        { rarity: "epic",      weight: 10, values: [r(18), r(22), r(27)] },
        { rarity: "legendary", weight: 2,  values: [r(38), r(45)] },
      ],
    },
    20: {
      tiers: [
        { rarity: "common",    weight: 58, values: [r(2), r(3), r(4), r(5), r(6)] },
        { rarity: "rare",      weight: 28, values: [r(8), r(10), r(13), r(16)] },
        { rarity: "epic",      weight: 11, values: [r(25), r(32), r(40)] },
        { rarity: "legendary", weight: 3,  values: [r(60), r(80)] },
      ],
    },
    25: {
      tiers: [
        { rarity: "common",    weight: 57, values: [r(2.5), r(4), r(6), r(8)] },
        { rarity: "rare",      weight: 28, values: [r(12), r(16), r(20), r(24)] },
        { rarity: "epic",      weight: 11, values: [r(35), r(45), r(55)] },
        { rarity: "legendary", weight: 4,  values: [r(80), r(100), r(125)] },
      ],
    },
    50: {
      tiers: [
        { rarity: "common",    weight: 55, values: [r(5), r(8), r(10), r(12), r(15)] },
        { rarity: "rare",      weight: 28, values: [r(25), r(32), r(40), r(48)] },
        { rarity: "epic",      weight: 12, values: [r(70), r(90), r(115)] },
        { rarity: "legendary", weight: 5,  values: [r(180), r(250), r(300)] },
      ],
    },
    100: {
      tiers: [
        { rarity: "common",    weight: 53, values: [r(10), r(15), r(20), r(25), r(30)] },
        { rarity: "rare",      weight: 28, values: [r(50), r(65), r(80), r(95)] },
        { rarity: "epic",      weight: 13, values: [r(140), r(180), r(230)] },
        { rarity: "legendary", weight: 6,  values: [r(400), r(550), r(700)] },
      ],
    },
    260: {
      tiers: [
        { rarity: "common",    weight: 52, values: [r(25), r(40), r(55), r(70), r(85)] },
        { rarity: "rare",      weight: 28, values: [r(130), r(170), r(210), r(250)] },
        { rarity: "epic",      weight: 13, values: [r(380), r(500), r(630)] },
        { rarity: "legendary", weight: 7,  values: [r(1100), r(1500), r(2000)] },
      ],
    },
    500: {
      tiers: [
        { rarity: "common",    weight: 50, values: [r(50), r(75), r(100), r(130), r(160)] },
        { rarity: "rare",      weight: 28, values: [r(260), r(340), r(420), r(490)] },
        { rarity: "epic",      weight: 14, values: [r(750), r(1000), r(1300)] },
        { rarity: "legendary", weight: 8,  values: [r(2500), r(3500), r(5000)] },
      ],
    },
    670: {
      tiers: [
        { rarity: "common",    weight: 49, values: [r(65), r(100), r(140), r(180), r(220)] },
        { rarity: "rare",      weight: 28, values: [r(350), r(460), r(560), r(660)] },
        { rarity: "epic",      weight: 14, values: [r(1000), r(1400), r(1800)] },
        { rarity: "legendary", weight: 9,  values: [r(3500), r(5000), r(7000)] },
      ],
    },
    999: {
      tiers: [
        { rarity: "common",    weight: 48, values: [r(100), r(150), r(200), r(260), r(320)] },
        { rarity: "rare",      weight: 27, values: [r(520), r(680), r(840), r(980)] },
        { rarity: "epic",      weight: 15, values: [r(1500), r(2000), r(2700)] },
        { rarity: "legendary", weight: 10, values: [r(5000), r(7500), r(10000)] },
      ],
    },
  };

  if (configs[caseValue]) return configs[caseValue];

  const scale = caseValue / 100;
  return {
    tiers: [
      { rarity: "common",    weight: 55, values: [r(caseValue * 0.1), r(caseValue * 0.15), r(caseValue * 0.2), r(caseValue * 0.25)] },
      { rarity: "rare",      weight: 28, values: [r(caseValue * 0.5), r(caseValue * 0.65), r(caseValue * 0.8), r(caseValue * 0.95)] },
      { rarity: "epic",      weight: 12, values: [r(caseValue * 1.4), r(caseValue * 1.8), r(caseValue * 2.3)] },
      { rarity: "legendary", weight: 5,  values: [r(caseValue * 4 * scale + caseValue * 2), r(caseValue * 5.5)] },
    ],
  };
}

export function pickTier(tiers: PrizeTier[]): PrizeTier {
  const total = tiers.reduce((s, t) => s + t.weight, 0);
  let rand = Math.random() * total;
  for (const tier of tiers) {
    rand -= tier.weight;
    if (rand <= 0) return tier;
  }
  return tiers[0];
}

export function generateCoins(currencySymbol: string, caseValue: number): Coin[] {
  const { tiers } = getCaseConfig(caseValue);
  const coins: Coin[] = [];
  for (let i = 0; i < TOTAL_COINS; i++) {
    const tier = pickTier(tiers);
    const val = tier.values[Math.floor(Math.random() * tier.values.length)];
    coins.push({ value: val, label: `${val}${currencySymbol}`, rarity: tier.rarity });
  }
  return coins;
}

export function pickWinValue(caseValue: number): { value: number; rarity: Rarity } {
  const { tiers } = getCaseConfig(caseValue);
  const rand = Math.random();

  let tier: PrizeTier;
  if (rand < 0.50)      tier = tiers[0];
  else if (rand < 0.78) tier = tiers[1];
  else if (rand < 0.94) tier = tiers[2];
  else                  tier = tiers[3];

  const value = tier.values[Math.floor(Math.random() * tier.values.length)];
  return { value, rarity: tier.rarity };
}

const GAME_BALANCE_URL = "https://functions.poehali.dev/64bf4a3e-c7fb-44f5-a1a9-b70cae660400";

export async function apiBet(userId: string, amount: number, currency: string): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    const res = await fetch(GAME_BALANCE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, action: "bet", amount, currency }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, balance: data.balance };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function apiWin(userId: string, amount: number, currency: string): Promise<{ ok: boolean; balance?: number }> {
  try {
    const res = await fetch(GAME_BALANCE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, action: "win", amount, currency }),
    });
    const data = await res.json();
    return { ok: res.ok, balance: data.balance };
  } catch {
    return { ok: false };
  }
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
};

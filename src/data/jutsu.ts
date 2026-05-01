import type { JutsuSpec } from "../pipeline/challenge.js";
import type { EndlessMode } from "../pipeline/endless.js";
import { SEAL_NAMES_JP } from "./seals.js";

export interface EndlessSpec {
  id: "endless_random" | "endless_sequential";
  displayNameJp: string;
  mode: EndlessMode;
}

export type GameMode = JutsuSpec | EndlessSpec;

export function isEndless(m: GameMode): m is EndlessSpec {
  return "mode" in m;
}

export const ENDLESS_MODES: readonly EndlessSpec[] = [
  { id: "endless_random",     displayNameJp: "Endless: Random",    mode: "random" },
  { id: "endless_sequential", displayNameJp: "Endless: 1→12 Loop", mode: "sequential" },
];

export const JUTSU_LIST: readonly JutsuSpec[] = [
  {
    id: "bunshin",
    displayNameJp: "分身の術",
    level: 1,
    sequence: ["03", "06", "08"],
    effectId: "bunshin",
  },
  {
    id: "kage_shuriken",
    displayNameJp: "千手裏剣の術",
    level: 2,
    sequence: ["03", "01", "06", "03"],
    effectId: "kage_shuriken",
  },
  {
    id: "kuchiyose",
    displayNameJp: "蛙喚びの術",
    level: 3,
    sequence: ["12", "11", "10", "09", "08"],
    effectId: "kuchiyose",
  },
  {
    id: "gokakyu",
    displayNameJp: "大火球の術",
    level: 4,
    sequence: ["06", "08", "09", "12", "07", "03"],
    effectId: "gokakyu",
  },
  // --- 単印テスト (01〜12) ---
  { id: "test_01", displayNameJp: SEAL_NAMES_JP["01"], level: 0, sequence: ["01"] },
  { id: "test_02", displayNameJp: SEAL_NAMES_JP["02"], level: 0, sequence: ["02"] },
  { id: "test_03", displayNameJp: SEAL_NAMES_JP["03"], level: 0, sequence: ["03"] },
  { id: "test_04", displayNameJp: SEAL_NAMES_JP["04"], level: 0, sequence: ["04"] },
  { id: "test_05", displayNameJp: SEAL_NAMES_JP["05"], level: 0, sequence: ["05"] },
  { id: "test_06", displayNameJp: SEAL_NAMES_JP["06"], level: 0, sequence: ["06"] },
  { id: "test_07", displayNameJp: SEAL_NAMES_JP["07"], level: 0, sequence: ["07"] },
  { id: "test_08", displayNameJp: SEAL_NAMES_JP["08"], level: 0, sequence: ["08"] },
  { id: "test_09", displayNameJp: SEAL_NAMES_JP["09"], level: 0, sequence: ["09"] },
  { id: "test_10", displayNameJp: SEAL_NAMES_JP["10"], level: 0, sequence: ["10"] },
  { id: "test_11", displayNameJp: SEAL_NAMES_JP["11"], level: 0, sequence: ["11"] },
  { id: "test_12", displayNameJp: SEAL_NAMES_JP["12"], level: 0, sequence: ["12"] },
] as const;

export const MODE_LIST: readonly GameMode[] = [...JUTSU_LIST, ...ENDLESS_MODES];

export const JUTSU_BY_ID: Readonly<Record<string, JutsuSpec>> =
  Object.fromEntries(JUTSU_LIST.map(j => [j.id, j]));

export const JUTSU_DISPLAY_EN: Readonly<Record<string, string>> = {
  bunshin: "Clone-jutsu!",
  kage_shuriken: "Thousand Shuriken!",
  kuchiyose: "Summoning-jutsu!",
  gokakyu: "Great Fireball!",
  test_01: "Rat", test_02: "Ox",   test_03: "Tiger", test_04: "Hare",
  test_05: "Dragon", test_06: "Snake", test_07: "Horse", test_08: "Ram",
  test_09: "Monkey", test_10: "Bird", test_11: "Dog",   test_12: "Boar",
};

export function displayName(spec: JutsuSpec): string {
  return `${spec.displayNameJp} (${JUTSU_DISPLAY_EN[spec.id]})`;
}

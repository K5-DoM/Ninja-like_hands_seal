export const SEAL_LABELS = [
  "01", "02", "03", "04", "05", "06",
  "07", "08", "09", "10", "11", "12",
] as const;

export type SealLabel = typeof SEAL_LABELS[number] | "none";

export const SEAL_FILENAMES: Readonly<Record<string, string>> = {
  "01": "01_nezumi.png",
  "02": "02_usi.png",
  "03": "03_tora.png",
  "04": "04_usagi.png",
  "05": "05_tatsu.png",
  "06": "06_hebi.png",
  "07": "07_uma.png",
  "08": "08_hitsuzi.png",
  "09": "09_saru.png",
  "10": "10_tori.png",
  "11": "11_inu.png",
  "12": "12_inoshishi.png",
};

export const SEAL_NAMES_JP: Readonly<Record<string, string>> = {
  "01": "子 / ne",
  "02": "丑 / ushi",
  "03": "寅 / tora",
  "04": "卯 / u",
  "05": "辰 / tatsu",
  "06": "巳 / mi",
  "07": "午 / uma",
  "08": "未 / hitsuji",
  "09": "申 / saru",
  "10": "酉 / tori",
  "11": "戌 / inu",
  "12": "亥 / i",
};

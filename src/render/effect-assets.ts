const EFFECT_SPRITE_KEYS = [
  "chakra_burst",
  "japanese_smoke",
  "bunshin",
  "shuriken",
  "bom_smoke",
  "flog_magician",
  "fire_ball",
  "chakra_circle",
] as const;

export type EffectSpriteKey = typeof EFFECT_SPRITE_KEYS[number];
export type EffectSprites = Readonly<Record<EffectSpriteKey, HTMLImageElement>>;

const FILE_MAP: Readonly<Record<EffectSpriteKey, string>> = {
  chakra_burst:   "chakra_burst.webp",
  japanese_smoke: "japanese_smoke.webp",
  bunshin:        "bunshin.webp",
  shuriken:       "shuriken.webp",
  bom_smoke:      "bom_smoke.webp",
  flog_magician:  "flog_magician.webp",
  fire_ball:      "fire_ball.webp",
  chakra_circle:  "chakra_circle.webp",
};

export async function loadEffectSprites(
  baseUrl: string = "/assets/effects/",
): Promise<EffectSprites> {
  const entries = await Promise.all(
    EFFECT_SPRITE_KEYS.map(async (key) => {
      const img = new Image();
      img.src = baseUrl + FILE_MAP[key];
      await img.decode();
      return [key, img] as const;
    }),
  );
  return Object.fromEntries(entries) as EffectSprites;
}

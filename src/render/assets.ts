import { SEAL_FILENAMES, SEAL_LABELS } from "../data/seals.js";

export type SealThumbMap = Readonly<Record<string, HTMLImageElement>>;

export async function loadSealThumbnails(baseUrl = "/assets/handseal/"): Promise<SealThumbMap> {
  const entries = await Promise.all(
    SEAL_LABELS.map(async (id) => {
      const img = new Image();
      img.src = baseUrl + SEAL_FILENAMES[id];
      await img.decode();
      return [id, img] as const;
    }),
  );
  return Object.fromEntries(entries);
}

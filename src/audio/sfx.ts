export const SFX_MANIFEST = {
  seal_click:        "seal_click.mp3",
  poof:              "poof.mp3",
  fireball:          "fireball.mp3",
  bunshin_attack:    "bunshins_attack.mp3",
  shuriken_attack:   "shuriken_attack.mp3",
  shuriken_defended: "shuriken_defended.mp3",
  failure:           "failure.mp3",
} as const;

export type SfxId = keyof typeof SFX_MANIFEST;

export const JUTSU_SFX: Readonly<Record<string, SfxId>> = {
  bunshin:       "bunshin_attack",
  kage_shuriken: "shuriken_attack",
  kuchiyose:     "poof",
  gokakyu:       "fireball",
};

export class SfxPlayer {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private buffers: Map<SfxId, AudioBuffer> = new Map();
  private ready = false;

  constructor() {
    const Ctx: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);
  }

  async init(baseUrl: string = "/assets/sfx/"): Promise<void> {
    const ids = Object.keys(SFX_MANIFEST) as SfxId[];
    const entries = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(baseUrl + SFX_MANIFEST[id]);
        if (!res.ok) throw new Error(`sfx fetch failed: ${id} (${res.status})`);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr);
        return [id, buf] as const;
      }),
    );
    for (const [id, buf] of entries) this.buffers.set(id, buf);
    this.ready = true;
  }

  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  play(id: SfxId, gain: number = 1.0): void {
    if (!this.ready) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (gain === 1.0) {
      src.connect(this.masterGain);
    } else {
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(this.masterGain);
    }
    src.start(0);
  }

  setMasterVolume(v: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }
}

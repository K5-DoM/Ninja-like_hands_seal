import * as ort from "onnxruntime-web";
import { Pipeline } from "./pipeline/pipeline.js";
import { openCamera } from "./pipeline/camera.js";
import {
  initialState, selectJutsu, startGame, onProgress, onSuccess, onWrong, onTimeout,
  selectEndlessMode, startEndlessGame, onEndlessAdvance, onEndlessGameover,
} from "./state/game.js";
import type { GameState } from "./state/game.js";
import { isEndless } from "./data/jutsu.js";
import { EndlessChallenge } from "./pipeline/endless.js";
import type { GameMode, EndlessSpec } from "./data/jutsu.js";
import { loadSealThumbnails } from "./render/assets.js";
import type { SealThumbMap } from "./render/assets.js";
import { Renderer } from "./render/canvas.js";
import { loadEffectSprites } from "./render/effect-assets.js";
import type { EffectSprites } from "./render/effect-assets.js";
import { EffectsRenderer } from "./render/effects.js";
import { buildControls } from "./ui/controls.js";
import { buildMuteToggle } from "./ui/mute.js";
import { DebugHud } from "./ui/debug-hud.js";
import { ChakraOverlay } from "./render/chakra-overlay.js";
// import { InferHud } from "./ui/infer-hud.js";  // debug only — re-enable with ?debug InferHud
import { buildResultOverlay } from "./ui/result.js";
import { buildFlash } from "./ui/flash.js";
import { SfxPlayer, JUTSU_SFX } from "./audio/sfx.js";

ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.numThreads = 1;

let state: GameState = initialState;
let selectedMode: GameMode | null = null;

function endlessLabel(spec: EndlessSpec): string {
  return spec.mode === "random" ? "Random" : "1→12 Loop";
}

document.getElementById("start")!.addEventListener("click", () => void run(), { once: true });

async function run(): Promise<void> {
  const startBtn      = document.getElementById("start") as HTMLButtonElement;
  const overlay       = document.getElementById("overlay") as HTMLDivElement;
  const errEl         = document.getElementById("overlay__error") as HTMLParagraphElement;
  const video         = document.getElementById("video") as HTMLVideoElement;
  const hudCanvas     = document.getElementById("hud") as HTMLCanvasElement;
  const fxCanvas      = document.getElementById("effects") as HTMLCanvasElement;
  const chakraCanvas  = document.getElementById("chakra") as HTMLCanvasElement;
  const ctrlHost      = document.getElementById("controls") as HTMLDivElement;

  const descEl    = document.getElementById("overlay__desc")    as HTMLParagraphElement;
  const loadingEl = document.getElementById("overlay__loading") as HTMLDivElement;

  startBtn.style.display = "none";
  descEl.style.display = "none";
  loadingEl.classList.remove("hidden");
  errEl.textContent = "";

  const restoreOverlayUI = () => {
    loadingEl.classList.add("hidden");
    startBtn.style.display = "";
    descEl.style.display = "";
    startBtn.disabled = false;
    startBtn.textContent = "Start Camera";
  };

  const params = new URLSearchParams(location.search);
  const debugMode = params.has("debug");
  const debugHud = debugMode ? new DebugHud() : null;
  debugHud?.start();
  // InferHud is created after camera opens (needs video element)
  // let inferHud: InferHud | null = null;  // debug only

  // AudioContext は user gesture スコープ内で生成・resume する（autoplay policy）
  const sfx = new SfxPlayer();
  await sfx.resume();

  buildMuteToggle(document.body, (muted) => {
    sfx.setMasterVolume(muted ? 0 : 1);
  });

  try {
    // ?camRes=WxH forces exact resolution (e.g. ?camRes=640x480)
    const camRes = params.get("camRes");
    if (camRes) {
      const [w, h] = camRes.split("x").map(Number);
      if (w > 0 && h > 0) await openCamera(video, w, h, true);
      else await openCamera(video);
    } else {
      await openCamera(video);
    }
  } catch (e) {
    errEl.textContent = `Camera error: ${e}`;
    restoreOverlayUI();
    return;
  }
  // effects は Pipeline の callback クロージャから参照するため先に宣言
  let effects: EffectsRenderer | null = null;
  const result = buildResultOverlay();
  const flash  = buildFlash();

  const pipeline = new Pipeline(
    {
      modelUrl: "/models/model.onnx",
      idxMapUrl: "/models/idx_to_class.json",
      handLandmarkerPath: "/models/hand_landmarker.task",
      mpVisionWasmPath: "/assets/mp-vision-wasm/",
    },
    video,
    {
      onInfer: (r, accepted) => {
        if (r.inferMs !== undefined) debugHud?.recordInfer(r.inferMs);
        chakra.setBox(r.finalBox);
        // inferHud?.update(r, accepted);  // debug only
        void accepted;
      },
      onSmooth: (sm) => {
        const ch = pipeline.peekChallenge();
        const expected = ch === null ? null
          : ch instanceof EndlessChallenge ? ch.getCurrent()
          : ch.expectedNext();
        const isCorrect =
          expected !== null
          && sm.stableLabel !== "none"
          && sm.stableLabel === expected;
        chakra.setActive(isCorrect);
      },
      onChallengeEvent: (e) => {
        if (e.status === "progress") {
          state = onProgress(state, e.step);
          sfx.play("seal_click");
        } else if (e.status === "success") {
          if (state.phase.kind === "running") {
            const jutsu = state.phase.jutsu;
            state = onSuccess(state);
            if (jutsu.effectId) effects?.play(jutsu.effectId, performance.now() / 1000);
            const sfxId = JUTSU_SFX[jutsu.id];
            if (sfxId) sfx.play(sfxId);
            syncControls();
          }
        } else if (e.status === "wrong") {
          state = onWrong(state);
          pipeline.cancelJutsu();
          chakra.setActive(false);
          effects?.stop();
          sfx.play("failure");
          flash.show("Wrong seal!", 1500);
          syncControls();
        } else if (e.status === "timeout") {
          state = onTimeout(state);
          pipeline.cancelJutsu();
          chakra.setActive(false);
          effects?.stop();
          sfx.play("failure");
          flash.show("Too slow!", 1500);
          syncControls();
        } else if (e.status === "endless_advance") {
          state = onEndlessAdvance(state, e.count);
          sfx.play("seal_click");
        } else if (e.status === "endless_gameover") {
          const count = e.count;
          const reason = e.reason;
          state = onEndlessGameover(state, count, reason);
          pipeline.cancelJutsu();
          chakra.setActive(false);
          sfx.play("failure");
          const modeLabel = selectedMode && isEndless(selectedMode)
            ? endlessLabel(selectedMode) : "Endless";
          result.show(count, reason, modeLabel);
          syncControls();
        }
      },
    },
  );

  let thumbs!: SealThumbMap;
  let effectSprites!: EffectSprites;
  try {
    [thumbs, effectSprites] = await Promise.all([
      loadSealThumbnails("/assets/handseal/"),
      loadEffectSprites("/assets/effects/"),
      sfx.init("/assets/sfx/"),
      pipeline.init(),
    ]);
  } catch (e) {
    errEl.textContent = `Init failed: ${e}`;
    restoreOverlayUI();
    return;
  }

  const chakra = new ChakraOverlay(chakraCanvas, video, effectSprites.chakra_circle);
  chakra.start();

  // debug only — re-enable InferHud for ablation testing:
  // if (debugMode) {
  //   inferHud = new InferHud(video, pipeline.getFlags(), (f) => pipeline.setAblationFlags(f));
  // }

  pipeline.start();

  const renderer = new Renderer(hudCanvas, thumbs, {
    getState:     () => state,
    getChallenge: () => pipeline.peekChallenge(),
  });
  renderer.start();

  effects = new EffectsRenderer(fxCanvas, effectSprites);
  effects.start();

  const startSelected = (): void => {
    if (!selectedMode) return;
    chakra.setActive(false);
    effects?.stop();
    result.hide();
    flash.hide();
    if (isEndless(selectedMode)) {
      pipeline.startEndless(selectedMode.mode);
      state = startEndlessGame(state);
    } else {
      pipeline.startJutsu(selectedMode);
      state = startGame(state);
    }
    syncControls();
  };

  const controls = buildControls(ctrlHost, {
    onJutsuChange: (mode) => {
      selectedMode = mode;
      pipeline.cancelJutsu();
      chakra.setActive(false);
      effects?.stop();
      result.hide();
      flash.hide();
      state = isEndless(mode)
        ? selectEndlessMode(state, mode)
        : selectJutsu(state, mode);
      syncControls();
    },
    onStart: startSelected,
  });

  function syncControls(): void {
    const k = state.phase.kind;
    const playing = k === "running" || k === "endless_running";
    ctrlHost.classList.toggle("is-playing", playing);
    controls.setEnabled({
      selector: !playing,
      start:    k === "ready" || k === "success" || k === "failure"
             || k === "endless_ready" || k === "endless_gameover",
    });
  }
  syncControls();

  overlay.classList.add("hidden");
}

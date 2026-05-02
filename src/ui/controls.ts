import { MODE_LIST, JUTSU_DISPLAY_EN, isEndless } from "../data/jutsu.js";
import type { GameMode } from "../data/jutsu.js";

export interface ControlsHandlers {
  onJutsuChange: (mode: GameMode) => void;
  onStart: () => void;
}

export interface Controls {
  setEnabled: (opts: { start?: boolean; selector?: boolean }) => void;
  destroy: () => void;
}

export function buildControls(host: HTMLElement, handlers: ControlsHandlers): Controls {
  host.innerHTML = "";

  const select = document.createElement("select");
  select.classList.add("controls__select");

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— Choose Jutsu —";
  blank.disabled = true;
  blank.selected = true;
  select.appendChild(blank);

  for (const m of MODE_LIST) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = isEndless(m)
      ? `★ ${m.displayNameJp}`
      : `Lv${m.level}  ${m.displayNameJp} (${JUTSU_DISPLAY_EN[m.id]})`;
    select.appendChild(opt);
  }

  const startBtn = document.createElement("button");
  startBtn.textContent = "Start";
  startBtn.classList.add("controls__btn", "controls__btn--primary");
  startBtn.disabled = true;

  host.append(select, startBtn);

  const onChange = () => {
    const id = select.value;
    if (!id) return;
    const mode = MODE_LIST.find(m => m.id === id);
    if (mode) handlers.onJutsuChange(mode);
  };
  select.addEventListener("change", onChange);
  startBtn.addEventListener("click", handlers.onStart);

  return {
    setEnabled: ({ start, selector }) => {
      if (start    !== undefined) startBtn.disabled = !start;
      if (selector !== undefined) select.disabled   = !selector;
    },
    destroy: () => {
      select.removeEventListener("change", onChange);
      startBtn.removeEventListener("click", handlers.onStart);
      host.innerHTML = "";
    },
  };
}

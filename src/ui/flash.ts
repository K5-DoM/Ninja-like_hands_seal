export interface Flash {
  show: (text: string, durationMs?: number) => void;
  hide: () => void;
  destroy: () => void;
}

export function buildFlash(host: HTMLElement = document.body): Flash {
  const el = document.createElement("div");
  el.id = "flash";
  el.setAttribute("aria-live", "polite");
  host.appendChild(el);
  let timer: number | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    show: (text, durationMs = 1500) => {
      el.textContent = text;
      el.classList.add("flash--visible");
      clearTimer();
      timer = window.setTimeout(() => {
        el.classList.remove("flash--visible");
        timer = null;
      }, durationMs);
    },
    hide: () => {
      clearTimer();
      el.classList.remove("flash--visible");
    },
    destroy: () => {
      clearTimer();
      el.remove();
    },
  };
}

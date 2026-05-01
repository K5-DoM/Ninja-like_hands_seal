const STORAGE_KEY = "naruto_seal_muted";

export interface MuteToggle {
  isMuted: () => boolean;
  destroy: () => void;
}

export function buildMuteToggle(
  host: HTMLElement,
  onChange: (muted: boolean) => void,
): MuteToggle {
  const btn = document.createElement("button");
  btn.id = "mute";
  btn.type = "button";
  btn.setAttribute("aria-label", "Toggle sound");

  let muted = false;
  try {
    muted = localStorage.getItem(STORAGE_KEY) === "1";
  } catch { /* iOS Private mode */ }

  const render = () => {
    btn.textContent = muted ? "🔇" : "🔊";
    btn.dataset.muted = muted ? "1" : "0";
  };
  render();

  const handler = () => {
    muted = !muted;
    try { localStorage.setItem(STORAGE_KEY, muted ? "1" : "0"); } catch { /* iOS Private mode */ }
    render();
    onChange(muted);
  };
  btn.addEventListener("click", handler);
  host.appendChild(btn);

  onChange(muted);

  return {
    isMuted: () => muted,
    destroy: () => {
      btn.removeEventListener("click", handler);
      btn.remove();
    },
  };
}

export interface ResultOverlay {
  show: (count: number, reason: "timeout" | "wrong", modeLabel: string) => void;
  hide: () => void;
}

export function buildResultOverlay(onClose?: () => void): ResultOverlay {
  const root  = document.getElementById("endless-result") as HTMLDivElement | null;
  const score = document.getElementById("result-score")   as HTMLDivElement | null;
  const sub   = document.getElementById("result-sub")     as HTMLDivElement | null;
  const share = document.getElementById("result-share")   as HTMLAnchorElement | null;
  const close = document.getElementById("result-close")   as HTMLButtonElement | null;
  const back  = document.getElementById("result-back")    as HTMLButtonElement | null;
  if (!root || !score || !sub || !share || !close || !back) {
    throw new Error("result overlay DOM not found");
  }

  const hide = () => {
    root.classList.add("hidden");
    onClose?.();
  };
  close.addEventListener("click", hide);
  back.addEventListener("click", hide);

  return {
    show: (count, reason, modeLabel) => {
      score.textContent = String(count);
      sub.textContent = `seals — ${reason === "timeout" ? "Time up" : "Wrong seal"}`;
      const text = `Ninja-like Hand Seal Endless (${modeLabel}) , ${count} 印(In) Succes！🥷 #HandSealGame`;
      const url = location.origin + location.pathname;
      share.href =
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` +
        `&url=${encodeURIComponent(url)}`;
      root.classList.remove("hidden");
    },
    hide: () => { root.classList.add("hidden"); },
  };
}

export const PER_SEAL_TIMEOUT_SEC = 5.0;

// Acceptance thresholds (matches infer_webcam_rgb.py defaults)
export const ACCEPT_REJECT_THRESHOLD = 0.72;
export const ACCEPT_MARGIN_THRESHOLD = 0.15;
export const ACCEPT_SINGLE_HAND_RELAX = 0.05;
export const DEFAULT_CROP = 0.70;

// Optional per-seal reject thresholds.
// If a label is not present here, ACCEPT_REJECT_THRESHOLD is used.
export const ACCEPT_REJECT_THRESHOLD_BY_LABEL: Record<string, number> = {
  // very easy to recognise
  "02": 0.90,
  "03": 0.90,
  "05": 0.90,
  "11": 0.90,
  // easy to recognise
  "07": 0.80,
  "10": 0.80,
  
  // slightly easy
  "09": 0.70,
  "12": 0.70,
  // slightly difficult
  "08": 0.60,
  "01": 0.60,
  "04": 0.60,
  // difficult
  "06": 0.50,
};

// TemporalSmoother parameters (matches infer_webcam_rgb.py CLI defaults)
export const SMOOTHER_WINDOW_SIZE = 7;
export const SMOOTHER_MIN_COUNT = 5;
export const SMOOTHER_SCORE_THRESHOLD = 0.77;
export const SMOOTHER_REJECT_RESET_COUNT = 5;

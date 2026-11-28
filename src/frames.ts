// Pulling a few still frames out of a short video of a pile of food, on the phone, so only
// those frames are uploaded (never the video). The pure parts are tested in frames.test.ts.
import { VIDEO_FRAMES } from "./scanPrompt";

/** Longest edge of each frame. Big enough to read most best-before dates, small enough to keep cost down. */
export const FRAME_SIDE = 1280;
/** Candidate moments looked at per frame kept; the sharpest wins. */
const TRIES = 3;
/** Small greyscale copy used to judge sharpness. */
const PROBE_SIDE = 160;

/**
 * Times to look at: the video is cut into `n` equal stretches and each gets `tries` evenly
 * spaced candidates, so the kept frames spread across the whole sweep. Ends are avoided, where
 * phones often blur while the person starts and stops.
 */
export function candidateTimes(duration: number, n: number, tries = TRIES): number[][] {
  if (!Number.isFinite(duration) || duration <= 0) return [[0]];
  const start = Math.min(0.3, duration * 0.05), end = Math.max(start, duration - Math.min(0.3, duration * 0.05));
  const span = end - start;
  const count = Math.max(1, Math.min(n, Math.floor(duration / 0.5) || 1));
  const out: number[][] = [];
  for (let i = 0; i < count; i++) {
    const a = start + (span * i) / count, b = start + (span * (i + 1)) / count;
    const row: number[] = [];
    for (let j = 0; j < tries; j++) row.push(+(a + ((b - a) * (j + 0.5)) / tries).toFixed(3));
    out.push(row);
  }
  return out;
}

/** Variance of a simple edge filter over a greyscale image. Higher means sharper (less motion blur). */
export function sharpness(grey: ArrayLike<number>, w: number, h: number): number {
  let sum = 0, sq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - w] - grey[i + w];
      sum += v; sq += v * v; n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sq / n - mean * mean;
}

function greyOf(data: Uint8ClampedArray): Float32Array {
  const g = new Float32Array(data.length / 4);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return g;
}

function once(el: HTMLVideoElement, ok: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (fn: () => void) => { clearTimeout(t); el.removeEventListener(ok, onOk); el.removeEventListener("error", onErr); fn(); };
    const onOk = () => done(resolve);
    const onErr = () => done(() => reject(new Error("video")));
    const t = setTimeout(() => done(() => reject(new Error("timeout"))), ms);
    el.addEventListener(ok, onOk);
    el.addEventListener("error", onErr);
  });
}

export class FrameError extends Error {}

/**
 * Picks up to `n` sharp frames spread across the video and returns them as JPEG files.
 * Throws FrameError if this browser cannot play the video.
 */
export async function extractFrames(file: Blob, n = VIDEO_FRAMES, onProgress?: (done: number, total: number) => void): Promise<File[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto";
  v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
  try {
    const meta = once(v, "loadeddata", 15000);
    v.src = url;
    v.load();
    await meta.catch(() => { throw new FrameError("This video could not be opened. Try recording again, or take photos instead."); });
    let duration = v.duration;
    // Some phones report Infinity until the end has been seen.
    if (!Number.isFinite(duration)) {
      v.currentTime = 1e7;
      await once(v, "seeked", 5000).catch(() => {});
      duration = v.duration;
    }
    if (!(v.videoWidth > 0)) throw new FrameError("This video could not be read. Try recording again, or take photos instead.");
    const scale = Math.min(1, FRAME_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const big = document.createElement("canvas");
    big.width = Math.round(v.videoWidth * scale); big.height = Math.round(v.videoHeight * scale);
    const ps = Math.min(1, PROBE_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const probe = document.createElement("canvas");
    probe.width = Math.max(3, Math.round(v.videoWidth * ps)); probe.height = Math.max(3, Math.round(v.videoHeight * ps));
    const bctx = big.getContext("2d")!, pctx = probe.getContext("2d", { willReadFrequently: true })!;

    const times = candidateTimes(duration, n);
    const total = times.reduce((a, r) => a + r.length, 0);
    let looked = 0;
    const frames: File[] = [];
    for (const row of times) {
      let best = -1, bestT = row[0];
      for (const t of row) {
        v.currentTime = Math.min(t, Math.max(0, duration - 0.05));
        await once(v, "seeked", 5000).catch(() => {});
        pctx.drawImage(v, 0, 0, probe.width, probe.height);
        const s = sharpness(greyOf(pctx.getImageData(0, 0, probe.width, probe.height).data), probe.width, probe.height);
        if (s > best) { best = s; bestT = t; }
        onProgress?.(++looked, total);
      }
      if (row.length > 1 && v.currentTime !== bestT) {
        v.currentTime = Math.min(bestT, Math.max(0, duration - 0.05));
        await once(v, "seeked", 5000).catch(() => {});
      }
      bctx.drawImage(v, 0, 0, big.width, big.height);
      const blob: Blob | null = await new Promise((r) => big.toBlob(r, "image/jpeg", 0.82));
      if (blob) frames.push(new File([blob], `frame-${frames.length + 1}.jpg`, { type: "image/jpeg" }));
    }
    if (!frames.length) throw new FrameError("No frames could be taken from this video. Try photos instead.");
    return frames;
  } finally {
    v.removeAttribute("src"); v.load();
    URL.revokeObjectURL(url);
  }
}

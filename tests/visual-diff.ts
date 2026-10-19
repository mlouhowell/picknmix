// Pixel-diff helper for visual tests: compare a 1400x1038 screenshot with a Figma reference render.
// Both are resized to the reference size and blurred by 0.6px so glyph antialiasing / hinting
// differences between Figma and Chrome don't count; a pixel differs when any channel is off by > 32.
// Each region is aligned within +-2 reference px (Figma rounds centred boxes, e.g. hero 8:236 at x 658 vs
// 658.5 in CSS); the offset used is returned so a real layout shift still shows up in the log.
import sharp from 'sharp';

export type Region = [x: number, y: number, w: number, h: number]; // 1400-canvas px
const prep = (input: string | Buffer, w: number, h: number) =>
  sharp(input).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().blur(0.6).raw().toBuffer();

/** mask (optional): screenshot buffer; only pixels where mask differs from `maskBg` are compared. */
export async function diffPct(shot: Buffer, refPath: string, regions: Region[], mask?: { shot: Buffer; bg: [number, number, number]; minDelta?: number }) {
  const meta = await sharp(refPath).metadata();
  const W = meta.width!, H = meta.height!, s = W / 1400;
  const [R, S, M] = await Promise.all([prep(refPath, W, H), prep(shot, W, H), mask ? sharp(mask.shot).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer() : null]);
  const ch = (a: Buffer, b: Buffer, k: number, k2: number) =>
    Math.max(Math.abs(a[k]! - b[k2]!), Math.abs(a[k + 1]! - b[k2 + 1]!), Math.abs(a[k + 2]! - b[k2 + 2]!));
  let best = { pct: Infinity, compared: 0, offset: [0, 0] as [number, number] };
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      let n = 0, bad = 0;
      for (const [x, y, w, h] of regions)
        for (let j = Math.max(2, Math.round(y * s)); j < Math.min(H - 2, Math.round((y + h) * s)); j++)
          for (let i = Math.max(2, Math.round(x * s)); i < Math.min(W - 2, Math.round((x + w) * s)); i++) {
            const k = (j * W + i) * 3, k2 = ((j + dy) * W + i + dx) * 3;
            if (M && mask && ch(M, Buffer.from(mask.bg), k, 0) <= (mask.minDelta ?? 6)) continue;
            n++;
            if (ch(R, S, k, k2) > 32) bad++;
          }
      const pct = (100 * bad) / Math.max(n, 1);
      if (pct < best.pct) best = { pct, compared: n, offset: [dx, dy] };
    }
  return best;
}

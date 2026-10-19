// Decode a baked 2D silhouette SDF (scripts/bake-outline.mjs) and sample it bilinearly.
// World units: silhouette height = 1, origin at the bbox centre, y up, negative = inside.
export type OutlineFile = { cols: number; rows: number; cell: number; minX: number; maxY: number; quant: number; aspect: number; data: string };
export type Outline = { sdf(x: number, y: number): number; halfW: number; halfH: number; aspect: number };

export function decodeOutline(f: OutlineFile): Outline {
  const bin = atob(f.data), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const g = new Int16Array(bytes.buffer), inv = 1 / f.quant, { cols, rows, cell, minX, maxY } = f;
  const at = (i: number, j: number) => g[j * cols + i]! * inv;
  return {
    halfW: -minX, halfH: maxY, aspect: f.aspect,
    sdf(x, y) {
      const u = (x - minX) / cell, v = (maxY - y) / cell;
      const iu = Math.min(Math.max(Math.floor(u), 0), cols - 2), iv = Math.min(Math.max(Math.floor(v), 0), rows - 2);
      const fu = Math.min(Math.max(u - iu, 0), 1), fv = Math.min(Math.max(v - iv, 0), 1);
      const d = (at(iu, iv) * (1 - fu) + at(iu + 1, iv) * fu) * (1 - fv) + (at(iu, iv + 1) * (1 - fu) + at(iu + 1, iv + 1) * fu) * fv;
      // outside the grid: grow with the distance beyond it (keeps the field monotonic for the mesher)
      const ox = Math.max(Math.abs(x) - (-minX), 0), oy = Math.max(Math.abs(y) - maxY, 0);
      return d + Math.hypot(ox, oy);
    },
  };
}

/** Rasterise text into a soft height field in [0, 1] (for embossed lettering). Browser only. */
export function textHeightField(text: string, font: string, { w = 512, h = 160, blur = 3 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = font;
  // stretch the glyphs to fill the box (w x h): letter boxes are measured from the hero
  const m = ctx.measureText(text);
  const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.translate(w / 2, h / 2); ctx.scale((w * 0.94) / m.width, (h * 0.86) / gh);
  ctx.fillText(text, 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  const px = ctx.getImageData(0, 0, w, h).data, f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = px[i * 4]! / 255;
  /** u, v in [0, 1] (v down) -> height 0..1, bilinear; 0 outside. */
  return (u: number, v: number) => {
    if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0;
    const x = u * (w - 1), y = v * (h - 1), xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const a = (i: number, j: number) => f[Math.min(j, h - 1) * w + Math.min(i, w - 1)]!;
    return (a(xi, yi) * (1 - fx) + a(xi + 1, yi) * fx) * (1 - fy) + (a(xi, yi + 1) * (1 - fx) + a(xi + 1, yi + 1) * fx) * fy;
  };
}

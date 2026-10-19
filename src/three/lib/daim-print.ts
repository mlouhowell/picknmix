// Daim wrapper print, recreated procedurally (3D_CANDY_GUIDELINES §5 "wrapped packet": vector-like art, no
// photo pixels). Drawn on a canvas in the hero's pixel space (assets/candies/daim/hero.png, 800 x 335) so the
// planar front projection lines up with the baked outline. The brand photo is reference-only: nothing from it is
// sampled here; shapes, colours and the stand-in serif logo are hand-placed approximations for owner sign-off.
import * as THREE from 'three';

export const HERO_W = 800, HERO_H = 335;
/** canvas layout: front print in the top half, back print in the bottom half (v in [0, 1], top = 0) */
export const PRINT = { scale: 2.56, frontV: [0, 0.5] as const, backV: [0.5, 1] as const };

export type PrintColors = {
  red: string; redDark: string; redLight: string; navy: string; navyLight: string; white: string;
  yellow: string; orange: string; choc: string; chocDark: string; toffee: string; panel: string;
};

type Pt = [number, number];
const poly = (ctx: CanvasRenderingContext2D, pts: Pt[], fill: string | CanvasGradient) => {
  ctx.beginPath(); ctx.moveTo(...pts[0]!); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
};

// chocolate-covered toffee shards (hero px: centre, width, height, rotation deg)
const SHARDS: [number, number, number, number, number][] = [
  [150, 140, 86, 34, 8], [143, 207, 74, 28, 4], [128, 252, 78, 50, -22], [398, 86, 64, 42, 32],
  [562, 96, 60, 32, -28], [670, 90, 52, 28, -18], [592, 232, 66, 40, 8], [704, 178, 22, 46, 4],
];

function shard(ctx: CanvasRenderingContext2D, c: PrintColors, [x, y, w, h, r]: (typeof SHARDS)[number]) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((r * Math.PI) / 180);
  const top: Pt[] = [[-w / 2, -h * 0.1], [-w * 0.15, -h / 2], [w / 2, h * 0.05], [w * 0.3, h / 2 - 5], [-w * 0.42, h / 2 - 4]];
  poly(ctx, top.map(([a, b]) => [a, b + 5] as Pt), c.toffee); // crunchy edge underneath
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, c.choc); g.addColorStop(0.55, c.chocDark); g.addColorStop(1, c.choc);
  poly(ctx, top, g);
  ctx.strokeStyle = c.chocDark; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.1); ctx.lineTo(w * 0.2, h * 0.15); ctx.stroke();
  ctx.restore();
}

function crimpPleats(ctx: CanvasRenderingContext2D, c: PrintColors, x0: number, x1: number) {
  ctx.save(); ctx.strokeStyle = c.redLight; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.55;
  for (let y = 20; y < HERO_H - 10; y += 9) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  ctx.strokeStyle = c.redDark; ctx.globalAlpha = 0.45;
  for (let y = 24.5; y < HERO_H - 10; y += 9) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  ctx.restore();
}

function logo(ctx: CanvasRenderingContext2D, c: PrintColors, font: string, box: { x: number; y: number; w: number; h: number; rot: number }) {
  ctx.save();
  ctx.translate(box.x, box.y); ctx.rotate((box.rot * Math.PI) / 180);
  ctx.font = font; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('Daim');
  // white swoosh under the letters: deep under the D, thinning out to the right (hero)
  const sw = box.h / 140;
  poly(ctx, [[-8 * sw, -16 * sw], [box.w + 12 * sw, -16 * sw], [box.w + 12 * sw, 6 * sw], [-10 * sw, 34 * sw]], c.redDark);
  poly(ctx, [[-12 * sw, -20 * sw], [box.w + 8 * sw, -20 * sw], [box.w + 8 * sw, 2 * sw], [-14 * sw, 29 * sw]], c.white);
  ctx.scale(box.w / m.width, box.h / m.actualBoundingBoxAscent);
  ctx.lineJoin = 'round';
  // white swoosh plate + thick white outline, with a dark red drop edge
  ctx.fillStyle = c.redDark; ctx.strokeStyle = c.redDark; ctx.lineWidth = 24;
  ctx.strokeText('Daim', 4, 7);
  ctx.strokeStyle = c.white; ctx.lineWidth = 19; ctx.strokeText('Daim', 0, 0);
  const g = ctx.createLinearGradient(0, -m.actualBoundingBoxAscent, 0, 0);
  g.addColorStop(0, c.navyLight); g.addColorStop(0.45, c.navy); g.addColorStop(1, c.navy);
  ctx.fillStyle = g; ctx.fillText('Daim', 0, 0);
  ctx.restore();
}

export function createDaimPrint(c: PrintColors, font: string, maxSize = 2048): THREE.CanvasTexture {
  const k = Math.min(PRINT.scale, maxSize / HERO_W);
  const cv = document.createElement('canvas');
  cv.width = Math.round(HERO_W * k); cv.height = Math.round(HERO_H * k * 2);
  const ctx = cv.getContext('2d')!;

  // ---- front (hero px space)
  ctx.save(); ctx.scale(k, k);
  ctx.fillStyle = c.red; ctx.fillRect(0, 0, HERO_W, HERO_H);
  // dark red rays bursting from behind the logo
  ctx.globalAlpha = 0.55;
  for (const [a, b] of [[-160, -140], [-120, -104], [-60, -48], [-20, -10], [30, 44], [70, 84], [120, 134], [160, 172]]) {
    const r = 520, cx = 430, cy = 185, ra = (a! * Math.PI) / 180, rb = (b! * Math.PI) / 180;
    poly(ctx, [[cx, cy], [cx + Math.cos(ra) * r, cy + Math.sin(ra) * r], [cx + Math.cos(rb) * r, cy + Math.sin(rb) * r]], c.redDark);
  }
  ctx.globalAlpha = 1;
  // yellow / orange streaks
  poly(ctx, [[58, 112], [215, 122], [330, 160], [330, 178], [215, 176], [58, 172]], c.yellow);
  poly(ctx, [[58, 112], [110, 115], [110, 170], [58, 172]], c.orange);
  poly(ctx, [[520, 118], [720, 98], [722, 128], [600, 150], [520, 150]], c.yellow);
  poly(ctx, [[640, 160], [722, 152], [722, 160], [640, 168]], c.yellow);
  poly(ctx, [[690, 98], [722, 96], [722, 128], [690, 130]], c.orange);
  poly(ctx, [[352, 62], [372, 60], [455, 92], [445, 98]], c.orange);
  poly(ctx, [[520, 118], [568, 76], [574, 80], [532, 120]], c.orange);
  poly(ctx, [[398, 246], [470, 238], [474, 262], [404, 270]], c.yellow);
  poly(ctx, [[480, 250], [530, 244], [532, 256], [484, 262]], c.orange);
  // packet shoulders + crimped ends
  crimpPleats(ctx, c, 20, 98); crimpPleats(ctx, c, 712, 790);
  for (const s of SHARDS) shard(ctx, c, s);
  logo(ctx, c, font, { x: 205, y: 246, w: 425, h: 140, rot: -5.6 });
  // nutrition panel (stylised: rounded pale panel with dark lines, no copied text)
  ctx.fillStyle = c.white; ctx.beginPath(); ctx.roundRect(643, 140, 52, 106, 12); ctx.fill();
  ctx.fillStyle = c.panel; ctx.beginPath(); ctx.roundRect(647, 144, 44, 98, 9); ctx.fill();
  ctx.fillStyle = c.redDark;
  for (const [y, w] of [[154, 18], [165, 30], [176, 34], [194, 16], [212, 18], [223, 34], [234, 34]]) ctx.fillRect(669 - w! / 2, y!, w!, 5);
  ctx.restore();

  // ---- back (mirrored x so it reads correctly from behind): plain red, long fin seal, ingredient lines
  ctx.save(); ctx.translate(0, HERO_H * k); ctx.scale(k, k);
  ctx.fillStyle = c.red; ctx.fillRect(0, 0, HERO_W, HERO_H);
  poly(ctx, [[98, 150], [712, 140], [712, 168], [98, 178]], c.redDark); // fin seal band
  crimpPleats(ctx, c, 20, 98); crimpPleats(ctx, c, 712, 790);
  ctx.fillStyle = c.redLight; ctx.globalAlpha = 0.7;
  for (let i = 0; i < 7; i++) ctx.fillRect(150, 70 + i * 10, 240 - (i % 3) * 30, 4);
  ctx.globalAlpha = 1;
  logo(ctx, c, font, { x: 470, y: 250, w: 170, h: 56, rot: -3 });
  ctx.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 4;
  return tex;
}

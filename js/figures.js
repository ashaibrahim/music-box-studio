// Music Box Studio: little porcelain figures that twirl on a stand inside the box.
// Each figure is built from simple shapes (spheres, rods and lathe-turned profiles).
// Coordinates: y is up, the figure faces +z, (0, 0, 0) is the top of its stand.
import { mat4, cylinder, sphere, lathe } from './gl.js';

const { mul, translate: T, rotateX: RX, rotateY: RY, rotateZ: RZ, scale: S } = mat4;

const PORCELAIN = { color: [0.97, 0.95, 0.93], gloss: 0.95 };
const BLUSH = { color: [0.95, 0.76, 0.81], gloss: 0.9 };
const GOLD = { color: [0.88, 0.70, 0.40], metal: true };
const DARK = { color: [0.22, 0.16, 0.2], gloss: 0.8 };
const ROSE = { color: [0.74, 0.16, 0.29], gloss: 0.55 };
const LEAF = { color: [0.36, 0.55, 0.36], gloss: 0.5 };
const GLASS = { color: [0.92, 0.96, 1.0], gloss: 1, alpha: 0.2, doubleSided: true };
const CREAM = { color: [0.99, 0.96, 0.92], gloss: 0.7 };
const FROSTING = { color: [0.96, 0.8, 0.85], gloss: 0.7 };
const FLAME = { color: [1.0, 0.78, 0.36], glow: true };
const FLAME_CORE = { color: [1.0, 0.97, 0.85], glow: true };
const CANDLES = [
  { color: [0.82, 0.75, 0.95], gloss: 0.8 },
  { color: [0.72, 0.9, 0.82], gloss: 0.8 },
  { color: [1.0, 0.88, 0.6], gloss: 0.8 },
];

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// rotation that turns the x axis to point along `dir`
function alignX(dir) {
  const x = norm(dir);
  const up = Math.abs(x[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const z = norm(cross(x, up));
  const y = cross(z, x);
  return new Float32Array([...x, 0, ...y, 0, ...z, 0, 0, 0, 0, 1]);
}

export function createFigures(r) {
  const unitRod = r.mesh(cylinder(1, 1, 18));
  const ball = r.mesh(sphere(1, 16));
  const meshes = {
    stand: r.mesh(lathe([[0, -0.1], [0.58, -0.1], [0.62, -0.05], [0.56, 0], [0, 0]], 40)),
    tutu: r.mesh(lathe([[0, 0.98], [0.42, 0.98], [0.56, 1.03], [0.55, 1.08], [0.38, 1.13], [0.16, 1.17], [0, 1.18]], 40)),
    tutu2: r.mesh(lathe([[0, 1.06], [0.4, 1.06], [0.47, 1.1], [0.3, 1.18], [0, 1.2]], 40)),
    bodice: r.mesh(lathe([[0, 1.02], [0.16, 1.06], [0.14, 1.24], [0.19, 1.46], [0.17, 1.6], [0.08, 1.67], [0, 1.68]], 28)),
    beak: r.mesh(lathe([[0.055, 0], [0.03, 0.12], [0, 0.22]], 16)),
    crown: r.mesh(lathe([[0.075, 0], [0.085, 0.05], [0.07, 0.1]], 16)),
    plinth: r.mesh(lathe([[0, 0], [0.74, 0], [0.78, 0.07], [0.7, 0.14], [0.66, 0.2], [0, 0.2]], 40)),
    dome: r.mesh(lathe([[0.64, 0.2], [0.64, 1.55], [0.6, 1.8], [0.47, 1.97], [0.26, 2.06], [0, 2.08]], 40)),
    plate: r.mesh(lathe([[0, 0], [0.9, 0], [0.96, 0.04], [0.86, 0.09], [0, 0.09]], 40)),
    tier1: r.mesh(lathe([[0, 0.09], [0.76, 0.09], [0.79, 0.13], [0.79, 0.6], [0.76, 0.65], [0, 0.65]], 40)),
    tier2: r.mesh(lathe([[0, 0.65], [0.5, 0.65], [0.53, 0.69], [0.53, 1.06], [0.5, 1.1], [0, 1.1]], 40)),
    finial: r.mesh(lathe([[0, 0], [0.13, 0.02], [0.16, 0.08], [0.08, 0.16], [0, 0.26]], 20)),
  };

  // drawing helpers
  const rod = (base, a, b, rad, mat) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(...d);
    r.draw(unitRod, mul(base, T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), alignX(d), S(len, rad, rad)), mat);
  };
  const blob = (base, c, rx, ry, rz, mat, rot = null) => r.draw(ball, mul(base, T(...c), rot || mat4.identity(), S(rx, ry, rz)), mat);
  const chain = (base, pts, r0, r1, mat) => {
    for (let i = 0; i < pts.length - 1; i += 1) {
      const rad = r0 + ((r1 - r0) * i) / (pts.length - 1);
      rod(base, pts[i], pts[i + 1], rad, mat);
      blob(base, pts[i + 1], rad, rad, rad, mat);
    }
  };

  const draw = {
    ballerina(m) {
      // legs: one on pointe, one lifted behind (arabesque)
      rod(m, [0.04, 0.02, 0], [0.05, 1.02, 0], 0.055, PORCELAIN);
      rod(m, [-0.05, 1.0, 0], [-0.06, 1.12, -0.8], 0.05, PORCELAIN);
      blob(m, [0.04, 0.02, 0.02], 0.05, 0.035, 0.07, BLUSH);
      r.draw(meshes.tutu, m, BLUSH);
      r.draw(meshes.tutu2, m, PORCELAIN);
      r.draw(meshes.bodice, m, BLUSH);
      rod(m, [0, 1.64, 0], [0, 1.82, 0.01], 0.05, PORCELAIN);
      blob(m, [0, 1.95, 0.02], 0.155, 0.17, 0.16, PORCELAIN);
      blob(m, [0, 2.06, -0.11], 0.085, 0.085, 0.085, DARK);
      blob(m, [0, 2.05, 0.02], 0.15, 0.08, 0.15, DARK);     // hair
      // arms raised in an oval above her head
      for (const s of [-1, 1]) {
        chain(m, [[s * 0.17, 1.58, 0], [s * 0.42, 1.93, 0.04], [s * 0.13, 2.3, 0.07]], 0.042, 0.035, PORCELAIN);
      }
      blob(m, [0, 2.0, 0.2], 0.012, 0.012, 0.012, DARK);
    },

    swan(m) {
      blob(m, [0, 0.42, 0], 0.5, 0.38, 0.82, PORCELAIN);
      blob(m, [0, 0.62, -0.78], 0.17, 0.11, 0.3, PORCELAIN, RX(-0.6));
      for (const s of [-1, 1]) blob(m, [s * 0.36, 0.66, -0.12], 0.16, 0.3, 0.66, PORCELAIN, mul(RZ(s * -0.5), RX(-0.25)));
      chain(m, [[0, 0.55, 0.58], [0, 0.98, 0.76], [0, 1.4, 0.64], [0, 1.68, 0.46], [0, 1.82, 0.56]], 0.12, 0.085, PORCELAIN);
      blob(m, [0, 1.84, 0.62], 0.12, 0.12, 0.15, PORCELAIN);
      r.draw(meshes.beak, mul(m, T(0, 1.8, 0.72), RX(Math.PI / 2)), GOLD);
      for (const s of [-1, 1]) blob(m, [s * 0.09, 1.88, 0.68], 0.022, 0.022, 0.022, DARK);
      r.draw(meshes.crown, mul(m, T(0, 1.94, 0.6)), GOLD);
    },

    horse(m, t) {
      rod(m, [0, 0, 0], [0, 2.55, 0], 0.05, GOLD);
      r.draw(meshes.finial, mul(m, T(0, 2.52, 0)), GOLD);
      const h = mul(m, T(0, Math.sin(t * 2) * 0.16, 0));   // gallops up and down
      blob(h, [0, 1.2, 0], 0.27, 0.3, 0.62, PORCELAIN);
      chain(h, [[0, 1.32, 0.42], [0, 1.62, 0.62], [0, 1.82, 0.7]], 0.15, 0.12, PORCELAIN);
      blob(h, [0, 1.84, 0.86], 0.12, 0.13, 0.27, PORCELAIN, RX(0.75));
      for (const s of [-1, 1]) {
        r.draw(meshes.beak, mul(h, T(s * 0.07, 2.0, 0.72), RX(-0.3), S(0.9)), PORCELAIN);   // ears
        blob(h, [s * 0.1, 1.92, 0.9], 0.02, 0.02, 0.02, DARK);
      }
      blob(h, [0, 1.74, 0.5], 0.06, 0.24, 0.3, BLUSH, RX(-0.75));                         // mane
      blob(h, [0, 1.14, -0.7], 0.06, 0.26, 0.12, BLUSH, RX(0.55));                        // tail
      blob(h, [0, 1.47, -0.02], 0.29, 0.06, 0.3, GOLD);                                    // saddle
      blob(h, [0, 1.42, -0.02], 0.3, 0.05, 0.34, BLUSH);
      for (const s of [-1, 1]) {
        chain(h, [[s * 0.13, 1.0, 0.42], [s * 0.13, 0.86, 0.66], [s * 0.13, 0.66, 0.54]], 0.065, 0.05, PORCELAIN); // front, prancing
        chain(h, [[s * 0.13, 1.0, -0.42], [s * 0.13, 0.66, -0.58], [s * 0.13, 0.4, -0.48]], 0.065, 0.05, PORCELAIN);
        blob(h, [s * 0.13, 0.64, 0.52], 0.06, 0.05, 0.06, GOLD);
        blob(h, [s * 0.13, 0.38, -0.47], 0.06, 0.05, 0.06, GOLD);
      }
    },

    rose(m) {
      r.draw(meshes.plinth, m, GOLD);
      chain(m, [[0, 0.2, 0], [0.04, 0.7, 0.02], [0, 1.25, 0]], 0.035, 0.03, LEAF);
      blob(m, [0.15, 0.62, 0.02], 0.18, 0.035, 0.08, LEAF, RZ(0.45));
      blob(m, [-0.14, 0.88, -0.02], 0.16, 0.03, 0.07, LEAF, RZ(-0.5));
      // petals in two rings around a bud
      for (let k = 0; k < 5; k += 1) {
        const a = (k / 5) * Math.PI * 2;
        blob(m, [Math.cos(a) * 0.12, 1.36, Math.sin(a) * 0.12], 0.14, 0.18, 0.055, ROSE, mul(RY(-a + Math.PI / 2), RX(-0.3)));
        const b = a + Math.PI / 5;
        blob(m, [Math.cos(b) * 0.2, 1.3, Math.sin(b) * 0.2], 0.17, 0.19, 0.05, ROSE, mul(RY(-b + Math.PI / 2), RX(-0.75)));
      }
      blob(m, [0, 1.42, 0], 0.1, 0.16, 0.1, ROSE);
      r.draw(meshes.finial, mul(m, T(0, 2.04, 0), S(0.5)), GOLD);
    },
    roseGlass(m) { r.draw(meshes.dome, m, GLASS); },

    cake(m, t) {
      r.draw(meshes.plate, m, GOLD);
      r.draw(meshes.tier1, m, FROSTING);
      r.draw(meshes.tier2, m, CREAM);
      for (let k = 0; k < 18; k += 1) {
        const a = (k / 18) * Math.PI * 2;
        blob(m, [Math.cos(a) * 0.75, 0.66, Math.sin(a) * 0.75], 0.075, 0.06, 0.075, CREAM);   // piping
        blob(m, [Math.cos(a) * 0.79, 0.14, Math.sin(a) * 0.79], 0.06, 0.05, 0.06, CREAM);
      }
      for (let k = 0; k < 12; k += 1) {
        const a = (k / 12) * Math.PI * 2;
        blob(m, [Math.cos(a) * 0.49, 1.11, Math.sin(a) * 0.49], 0.055, 0.045, 0.055, FROSTING);
      }
      blob(m, [0, 1.14, 0], 0.09, 0.08, 0.09, ROSE);                                          // a cherry on top
      for (let k = 0; k < 3; k += 1) {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        const x = Math.cos(a) * 0.27;
        const z = Math.sin(a) * 0.27;
        rod(m, [x, 1.08, z], [x, 1.52, z], 0.045, CANDLES[k]);
        rod(m, [x, 1.52, z], [x, 1.58, z], 0.008, DARK);
        const flicker = 1 + Math.sin(t * 17 + k * 2.1) * 0.12 + Math.sin(t * 29 + k) * 0.06;
        blob(m, [x, 1.66, z], 0.045, 0.095 * flicker, 0.045, FLAME);
        blob(m, [x, 1.63, z], 0.02, 0.04, 0.02, FLAME_CORE);
      }
    },
  };

  return {
    // m = where the stand sits; spin = turn angle; t = time in seconds (for flames and galloping)
    draw(id, m, spin, t) {
      if (!draw[id]) return;
      r.draw(meshes.stand, m, GOLD);
      draw[id](mul(m, RY(spin)), id === 'horse' ? spin : t);
    },
    // see-through parts must be drawn after everything else
    drawGlass(id, m, spin) {
      if (id === 'rose') draw.roseGlass(mul(m, RY(spin)));
    },
  };
}

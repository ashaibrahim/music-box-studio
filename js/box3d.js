// Music Box Studio: the 3D music box scene.
// Units are roughly centimetres. The box sits on the floor (y = 0), facing +z (towards you).
import { mat4, roundedBox, box, plane, cylinder, sphere, merge, createRenderer } from './gl.js';
import { LOW, PITCHES, BOX_COLORS } from './song.js';
import { createFigures } from './figures.js';

const { mul, translate: T, rotateX: RX, rotateY: RY, scale: S } = mat4;

const GOLD = { color: [0.88, 0.70, 0.40], metal: true };
const BRASS = { color: [0.82, 0.64, 0.36], metal: true };
const STEEL = { color: [0.80, 0.82, 0.86], metal: true };

// layout
const W = 16;
const D = 10;
const H = 5.4;
const WALL = 0.55;
const RAISE = 1.7;                      // the movement sits on a raised velvet platform
const CYL = { x: -2.6, y: 2.55 + RAISE, z: -1.35, r: 1.05, len: 7.4 };
const CONTACT = (75 * Math.PI) / 180;   // where pins meet the comb (angle from the top, towards the front)
const COMB_Y = 2.82 + RAISE;
const TOOTH_BASE_Z = 1.05;
const TOOTH_TIP_Z = -0.3;
const PITCH_X = (i) => CYL.x - CYL.len / 2 + ((i + 0.5) * CYL.len) / PITCHES;
const LID_PIVOT = [0, H, -D / 2];
const LID_OPEN = 1.92;                  // radians (~110°)
const KEY_POS = [W / 2 + 0.45, 2.7, 0.6];

const FONT_SCRIPT = '"Fredoka", "Nunito", system-ui, sans-serif';
const FONT_SOFT = '"Nunito", "Avenir Next", system-ui, sans-serif';

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function fitText(ctx, text, maxWidth, size, font) {
  let s = size;
  do { ctx.font = `600 ${s}px ${font}`; s -= 2; } while (ctx.measureText(text).width > maxWidth && s > 12);
  return s + 2;
}

function wrapLines(ctx, text, maxWidth) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width <= maxWidth) { line = t; continue; }
      if (line) out.push(line);
      line = '';
      // a word longer than the whole card ("AJAJAJAJ…") is broken letter by letter
      for (const ch of [...word]) {
        if (line && ctx.measureText(line + ch).width > maxWidth) { out.push(line); line = ch; } else line += ch;
      }
    }
    out.push(line);
  }
  return out;
}

export function createMusicBox(canvas, { onKey = () => {}, onLid = () => {}, onCard = null, onTurn = () => {}, interactive = true, distance = 37, minDist = 18 } = {}) {
  const r = createRenderer(canvas);
  if (!r) return null;

  const figures = createFigures(r);
  const FIGURE_SPOT = [5.4, 2.4 + 0.2, 0.3];     // on top of the velvet cushion
  let spin = 0;

  // ---------------------------------------------------------------- textures (drawn with 2D canvas)
  const [plateCanvas, plateCtx] = canvas2d(1024, 256);
  const [cardCanvas, cardCtx] = canvas2d(1024, 640);
  const [shadowCanvas, shadowCtx] = canvas2d(256, 256);
  const grad = shadowCtx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.42)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  shadowCtx.fillStyle = grad;
  shadowCtx.fillRect(0, 0, 256, 256);
  const plateTex = r.texture(plateCanvas);
  const cardTex = r.texture(cardCanvas);
  const shadowTex = r.texture(shadowCanvas);

  let gift = { color: 'blush', figure: 'ballerina', to: '', from: '', message: '' };
  const finishTextures = new Map();   // picture address → texture (once loaded)
  function finishTexture(url) {
    if (!url) return null;
    if (!finishTextures.has(url)) {
      finishTextures.set(url, null);
      const img = new Image();
      img.onload = () => finishTextures.set(url, r.texture(img, { repeat: true }));
      img.src = url;
    }
    return finishTextures.get(url);
  }

  function drawPlate() {
    const ctx = plateCtx;
    ctx.clearRect(0, 0, 1024, 256);
    // thin engraved border
    ctx.strokeStyle = 'rgba(92, 58, 22, 0.55)';
    ctx.lineWidth = 5;
    ctx.strokeRect(22, 22, 980, 212);
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, 952, 184);
    const text = gift.to ? gift.to : 'Music Box Studio';
    const size = fitText(ctx, text, 860, 124, FONT_SCRIPT);
    ctx.font = `600 ${size}px ${FONT_SCRIPT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 240, 210, 0.55)'; // highlight under the cut
    ctx.fillText(text, 512, 134);
    ctx.fillStyle = 'rgba(78, 46, 16, 0.92)';
    ctx.fillText(text, 512, 130);
    plateTex.update(plateCanvas);
  }

  function drawCard() {
    const ctx = cardCtx;
    ctx.fillStyle = '#fffbf0';
    ctx.fillRect(0, 0, 1024, 640);
    // a stitched pink border, like a sewn label
    ctx.strokeStyle = '#f48fb8';
    ctx.lineWidth = 7;
    ctx.setLineDash([22, 14]);
    ctx.strokeRect(34, 34, 956, 572);
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5b3654';
    const msg = gift.message || 'Wind the key and listen…';
    let size = 54;
    let lines;
    do {
      ctx.font = `600 ${size}px ${FONT_SOFT}`;
      lines = wrapLines(ctx, msg, 820);
      size -= 2;
    } while (lines.length * size * 1.35 > 380 && size > 22);
    size += 2;
    const lh = size * 1.35;
    const top = 300 - (lines.length * lh) / 2 + lh / 2 - (gift.from ? 24 : 0);
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 512, top + i * lh));
    if (gift.from) {
      ctx.font = `600 40px ${FONT_SCRIPT}`;
      ctx.fillStyle = '#d9578e';
      ctx.fillText(`— ${gift.from}`, 512, top + lines.length * lh + 22);
    }
    cardTex.update(cardCanvas);
  }

  // ---------------------------------------------------------------- meshes
  const M = {
    base: r.mesh(roundedBox(W, 0.7, D, 0.25)),
    wallFB: r.mesh(roundedBox(W, H - 0.35, WALL, 0.2)),
    wallLR: r.mesh(roundedBox(WALL, H - 0.35, D - 0.3, 0.2)),
    trimFB: r.mesh(roundedBox(W + 0.05, 0.16, WALL + 0.06, 0.07)),
    trimLR: r.mesh(roundedBox(WALL + 0.06, 0.16, D, 0.07)),
    band: r.mesh(roundedBox(W + 0.24, 0.22, D + 0.24, 0.1)),
    foot: r.mesh(sphere(0.5, 12)),
    floor: r.mesh(box(W - 2 * WALL, 0.2, D - 2 * WALL)),
    cushion: r.mesh(roundedBox(4.1, 1.3, D - 2 * WALL - 0.4, 0.55, 5)),
    lid: r.mesh(roundedBox(W, 0.95, D, 0.32, 5)),
    inlayX: r.mesh(box(W - 1.6, 0.05, 0.09)),
    inlayZ: r.mesh(box(0.09, 0.05, D - 1.6)),
    platform: r.mesh(roundedBox(10.5, RAISE + 0.2, D - 2 * WALL - 0.1, 0.12)),
    card: r.mesh(plane(W - 3.2, (W - 3.2) * 0.625 > D - 2.6 ? D - 2.6 : (W - 3.2) * 0.625)),
    plate: r.mesh(roundedBox(6.6, 1.75, 0.14, 0.06)),
    plateFace: r.mesh(plane(6.3, 1.55)),
    bed: r.mesh(roundedBox(10.4, 0.3, 7.6, 0.1)),
    cylinder: r.mesh(cylinder(CYL.r, CYL.len, 64)),
    axle: r.mesh(cylinder(0.12, CYL.len + 1.4, 12)),
    post: r.mesh(roundedBox(0.42, 1.9, 0.9, 0.08)),
    combBase: r.mesh(roundedBox(CYL.len + 0.3, 0.55, 1.35, 0.08)),
    tooth: r.mesh(box((CYL.len / PITCHES) * 0.74, 0.08, TOOTH_BASE_Z - TOOTH_TIP_Z)),
    weight: r.mesh(box((CYL.len / PITCHES) * 0.6, 0.18, 0.5)),
    fanHub: r.mesh(cylinder(0.12, 1.2, 12)),
    fanBlade: r.mesh(box(0.05, 0.55, 0.7)),
    shaft: r.mesh(cylinder(0.17, 1.0, 16)),
    keyWing: r.mesh(roundedBox(0.22, 0.85, 0.78, 0.2, 4)),
    keyKnob: r.mesh(sphere(0.24, 12)),
    shadow: r.mesh(plane(W * 1.65, D * 1.9)),
    pole: r.mesh(cylinder(0.11, 1, 16)),
    pins: null,
  };

  // ---------------------------------------------------------------- song → pins on the cylinder
  let song = { steps: 64, notes: [] };
  let notesByPitch = [];

  function setSong(next) {
    song = next;
    notesByPitch = Array.from({ length: PITCHES }, () => []);
    for (const n of song.notes) notesByPitch[n.p - LOW].push(n.s);
    notesByPitch.forEach((a) => a.sort((x, y) => x - y));
    if (M.pins) M.pins.dispose();
    const pinGeo = box(0.08, 0.2, 0.08);
    const parts = song.notes.map((n) => {
      const phi = CONTACT - (2 * Math.PI * n.s) / song.steps;
      return { geo: pinGeo, matrix: mul(T(PITCH_X(n.p - LOW) - CYL.x, 0, 0), RX(phi), T(0, CYL.r + 0.07, 0)) };
    });
    M.pins = parts.length ? r.mesh(merge(parts)) : null;
  }

  function setGift(next) {
    gift = { ...gift, ...next };
    drawPlate();
    drawCard();
  }

  // ---------------------------------------------------------------- camera (drag to turn, scroll to zoom)
  const cam = { yaw: 0.42, pitch: 0.6, dist: distance, target: [0, 3.0, 0] };
  let userMoved = false;
  let dragging = null;
  const pointers = new Map();
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function viewMatrices(w, h) {
    const t = performance.now() / 1000;
    const sway = userMoved || reduceMotion ? 0 : Math.sin(t * 0.25) * 0.16;
    const yaw = cam.yaw + sway;
    const portrait = Math.max(0, 1 - w / h);            // on tall phone screens, step back so the whole box fits
    const dist = cam.dist * (1 + portrait * 1.15);
    const eye = [
      cam.target[0] + Math.sin(yaw) * Math.cos(cam.pitch) * dist,
      cam.target[1] + Math.sin(cam.pitch) * dist,
      cam.target[2] + Math.cos(yaw) * Math.cos(cam.pitch) * dist,
    ];
    const open = lid.angle / LID_OPEN;                 // look a little higher when the lid is up
    const target = [cam.target[0], cam.target[1] + open * 2.6, cam.target[2] - open * 1.2];
    eye[1] += open * 2.6;
    eye[2] -= open * 1.2;
    const aspect = w / h;
    const fov = 0.62;
    return { eye, vp: mul(mat4.perspective(fov, aspect, 0.5, 200), mat4.lookAt(eye, target)) };
  }

  // ---------------------------------------------------------------- animation state
  let lid = { angle: 0, target: 0 };
  let keyAngle = 0;
  let fanAngle = 0;
  let playing = false;
  let getPosition = () => null;
  let lastPos = 0;
  let last = performance.now();
  let raf = 0;
  let cardM = null;                 // where the note card inside the lid is (for tapping it)
  let lastEye = null;               // where the camera was last frame (to tell if the key faces us)
  let pulse = 0;                     // little glow on the key to say "turn me"

  function toothLift(i, pos) {
    // after a pin passes, the tooth springs back and wobbles for a moment
    const steps = notesByPitch[i];
    if (!steps || !steps.length || pos == null) return 0;
    let prev = -1;
    for (const s of steps) { if (s <= pos) prev = s; else break; }
    if (prev < 0) prev = steps[steps.length - 1] - song.steps; // wrap around the loop
    const d = pos - prev;
    if (d < 0 || d > 3) return 0;
    return Math.exp(-d * 2.2) * Math.cos(d * 26) * 0.09;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

    // lid eases towards open/closed
    lid.angle += (lid.target - lid.angle) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 5));
    const p = getPosition();
    const pos = p ? p.step : lastPos;
    if (p) lastPos = p.step;
    // the figure turns with the music (so it slows down when the music winds down)
    if (p) spin = ((p.loop || 0) * song.steps + p.step) * 0.35;
    if (playing) { keyAngle += dt * 1.6; fanAngle += dt * 28; }
    pulse += dt;

    const { eye, vp } = viewMatrices(w, h);
    lastEye = eye;
    r.begin(vp, eye, w, h);
    const lacq = BOX_COLORS.find((c) => c.id === gift.color) || BOX_COLORS[0];
    const pattern = finishTexture(lacq.texture);
    const LACQUER = pattern
      ? { color: [1, 1, 1], tex: pattern, planar: true, texScale: 1 / lacq.size, gloss: lacq.gloss ?? 0.75 }
      : { color: lacq.lacquer, gloss: gift.color === 'walnut' ? 0.6 : 0.9 };
    const VELVET = { color: lacq.velvet, velvet: true };

    // soft shadow on the floor
    r.draw(M.shadow, mul(T(0, 0.01, 0.3), RX(-Math.PI / 2)), { shadow: true, tex: shadowTex, alpha: 1 });

    // body
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) r.draw(M.foot, mul(T(x * (W / 2 - 0.9), 0.32, z * (D / 2 - 0.9)), S(1, 0.62, 1)), GOLD);
    r.draw(M.base, T(0, 0.62, 0), LACQUER);
    r.draw(M.band, T(0, 1.0, 0), GOLD);
    r.draw(M.wallFB, T(0, 0.6 + (H - 0.35) / 2, D / 2 - WALL / 2), LACQUER);
    r.draw(M.wallFB, T(0, 0.6 + (H - 0.35) / 2, -D / 2 + WALL / 2), LACQUER);
    r.draw(M.wallLR, T(W / 2 - WALL / 2, 0.6 + (H - 0.35) / 2, 0), LACQUER);
    r.draw(M.wallLR, T(-W / 2 + WALL / 2, 0.6 + (H - 0.35) / 2, 0), LACQUER);
    r.draw(M.trimFB, T(0, H + 0.2, D / 2 - WALL / 2), GOLD);
    r.draw(M.trimFB, T(0, H + 0.2, -D / 2 + WALL / 2), GOLD);
    r.draw(M.trimLR, T(W / 2 - WALL / 2, H + 0.2, 0), GOLD);
    r.draw(M.trimLR, T(-W / 2 + WALL / 2, H + 0.2, 0), GOLD);
    r.draw(M.floor, T(0, 1.0, 0), VELVET);

    // name plate on the front
    r.draw(M.plate, T(0, 3.05, D / 2 + 0.05), GOLD);
    r.draw(M.plateFace, T(0, 3.05, D / 2 + 0.125), { ...GOLD, tex: plateTex });

    // right compartment: divider + velvet cushion
    r.draw(M.cushion, T(5.4, 1.75, 0), VELVET);

    // the twirling figure rises on its stand as the lid opens
    const rise = lid.angle / LID_OPEN;
    const POP = 2.6;                                        // how far the spring pushes the stand up
    const standY = FIGURE_SPOT[1] + POP - (1 - rise) * 12;   // sunk out of sight when the lid is shut
    const figM = mul(T(FIGURE_SPOT[0], standY, FIGURE_SPOT[2]), S(3.1));
    if (gift.figure !== 'none' && rise > 0.02) {
      const poleLen = standY - FIGURE_SPOT[1] + 0.2;
      if (poleLen > 0.05) r.draw(M.pole, mul(T(FIGURE_SPOT[0], FIGURE_SPOT[1] - 0.2 + poleLen / 2, FIGURE_SPOT[2]), mat4.rotateZ(Math.PI / 2), S(poleLen, 1, 1)), GOLD);
      figures.draw(gift.figure, figM, spin, now / 1000);
    }

    // the movement
    r.draw(M.platform, T(-W / 2 + WALL + 5.25, 1.0 + RAISE / 2, 0), VELVET);
    r.draw(M.bed, T(CYL.x + 0.3, 1.25 + RAISE, 0), BRASS);
    r.draw(M.post, T(CYL.x - CYL.len / 2 - 0.35, 2.0 + RAISE, CYL.z), BRASS);
    r.draw(M.post, T(CYL.x + CYL.len / 2 + 0.35, 2.0 + RAISE, CYL.z), BRASS);
    r.draw(M.axle, T(CYL.x, CYL.y, CYL.z), STEEL);
    const turn = (2 * Math.PI * pos) / Math.max(1, song.steps);
    const cylM = mul(T(CYL.x, CYL.y, CYL.z), RX(turn));
    r.draw(M.cylinder, cylM, BRASS);
    if (M.pins) r.draw(M.pins, cylM, STEEL);
    r.draw(M.combBase, T(CYL.x, COMB_Y - 0.32, TOOTH_BASE_Z + 0.62), STEEL);
    for (let i = 0; i < PITCHES; i += 1) {
      const lift = toothLift(i, playing || p ? pos : null);
      const tooth = mul(T(PITCH_X(i), COMB_Y, TOOTH_BASE_Z), RX(-lift), T(0, 0, -(TOOTH_BASE_Z - TOOTH_TIP_Z) / 2));
      r.draw(M.tooth, tooth, STEEL);
      if (i < 8) r.draw(M.weight, T(PITCH_X(i), COMB_Y - 0.14, TOOTH_BASE_Z - 0.35), BRASS); // tuning weights under the low teeth
    }
    // the little air-brake fan that keeps the speed steady
    const fanM = mul(T(CYL.x + CYL.len / 2 + 1.05, 2.4 + RAISE, 1.6), RY(fanAngle));
    r.draw(M.fanHub, mul(T(CYL.x + CYL.len / 2 + 1.05, 2.4 + RAISE, 1.6), mat4.rotateZ(Math.PI / 2)), BRASS);
    r.draw(M.fanBlade, mul(fanM, T(0, 0.45, 0)), BRASS);
    r.draw(M.fanBlade, mul(fanM, RY(Math.PI / 2), T(0, 0.45, 0)), BRASS);

    // winding key on the right side
    const keyM = mul(T(...KEY_POS), RX(keyAngle));
    r.draw(M.shaft, mul(T(KEY_POS[0] - 0.35, KEY_POS[1], KEY_POS[2])), GOLD);
    r.draw(M.keyKnob, keyM, GOLD);
    r.draw(M.keyWing, mul(keyM, T(0.25, 0.48, 0)), GOLD);
    r.draw(M.keyWing, mul(keyM, T(0.25, -0.48, 0)), GOLD);

    // lid, hinged at the back
    const lidM = mul(T(...LID_PIVOT), RX(-lid.angle), T(0, 0.48, D / 2));
    r.draw(M.lid, lidM, LACQUER);
    // thin gold inlay frame on top of the lid
    for (const z of [-(D - 1.6) / 2, (D - 1.6) / 2]) r.draw(M.inlayX, mul(lidM, T(0, 0.47, z)), GOLD);
    for (const x of [-(W - 1.6) / 2, (W - 1.6) / 2]) r.draw(M.inlayZ, mul(lidM, T(x, 0.47, 0)), GOLD);
    cardM = mul(lidM, T(0, -0.49, 0.1), RX(Math.PI / 2));
    if (lid.angle > 0.05) r.draw(M.card, cardM, { color: [1, 1, 1], tex: cardTex, gloss: 0.15 });
    if (gift.figure !== 'none' && rise > 0.02) figures.drawGlass(gift.figure, figM, spin);
  }

  // ---------------------------------------------------------------- picking: is the pointer on the key or the lid?
  function screenPoint(world) {
    const ndc = r.project(world);
    if (!ndc) return null;
    const rect = canvas.getBoundingClientRect();
    return [rect.left + ((ndc[0] + 1) / 2) * rect.width, rect.top + ((1 - ndc[1]) / 2) * rect.height];
  }
  function near(world, x, y, radius) {
    const s = screenPoint(world);
    return s && Math.hypot(s[0] - x, s[1] - y) < radius;
  }
  // the note card inside the lid: tap it to read the message
  const CARD_W = W - 3.2;
  const CARD_H = Math.min(D - 2.6, CARD_W * 0.625);
  const onCardPoint = (u, v) => {
    const m = cardM;
    const x = u * CARD_W / 2, y = v * CARD_H / 2;
    return [m[0] * x + m[4] * y + m[12], m[1] * x + m[5] * y + m[13], m[2] * x + m[6] * y + m[14]];
  };
  function cardHit(px, py) {
    if (!cardM || lid.angle < LID_OPEN * 0.8) return false;
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => screenPoint(onCardPoint(u, v)));
    if (c.some((q) => !q)) return false;
    // is the tap inside the card's four corners on screen?
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i, i += 1) {
      const [xi, yi] = c[i]; const [xj, yj] = c[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const keyHit = (x, y) => near([KEY_POS[0] + 0.3, KEY_POS[1], KEY_POS[2]], x, y, Math.max(34, canvas.clientWidth * 0.045));
  const lidHit = (x, y) => lid.target === 0 && near([0, H + 0.5, 1.5], x, y, canvas.clientWidth * 0.22);

  if (interactive) {
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      dragging = { x: e.clientX, y: e.clientY, moved: 0, yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) {
        const over = keyHit(e.clientX, e.clientY) || lidHit(e.clientX, e.clientY) || (onCard && cardHit(e.clientX, e.clientY));
        canvas.style.cursor = over ? 'pointer' : 'grab';
        return;
      }
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (!dragging.pinch) dragging.pinch = d;
        cam.dist = Math.max(minDist, Math.min(50, dragging.dist * (dragging.pinch / d)));
        dragging.moved = 99;
        return;
      }
      const dx = e.clientX - dragging.x;
      const dy = e.clientY - dragging.y;
      dragging.moved = Math.max(dragging.moved, Math.hypot(dx, dy));
      if (dragging.moved > 4) {
        if (!userMoved) onTurn();
        userMoved = true;
        cam.yaw = dragging.yaw - dx * 0.008;
        cam.pitch = Math.max(0.06, Math.min(1.35, dragging.pitch + dy * 0.006));
        canvas.style.cursor = 'grabbing';
      }
    });
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size) return;
      if (dragging && dragging.moved <= 4) {
        if (keyHit(e.clientX, e.clientY)) onKey();
        else if (lidHit(e.clientX, e.clientY)) onLid();
        else if (onCard && cardHit(e.clientX, e.clientY)) onCard();
      }
      dragging = null;
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      userMoved = true;
      cam.dist = Math.max(minDist, Math.min(50, cam.dist * (1 + Math.sign(e.deltaY) * 0.08)));
    }, { passive: false });
  }

  setSong(song);
  drawPlate();
  drawCard();
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(`600 40px ${FONT_SCRIPT}`), document.fonts.load(`600 40px ${FONT_SOFT}`)])
      .then(() => { drawPlate(); drawCard(); }).catch(() => {});
  }
  raf = requestAnimationFrame(frame);

  return {
    setSong,
    setGift,
    setLid(open, instant = false) { lid.target = open ? LID_OPEN : 0; if (instant) lid.angle = lid.target; },
    get lidOpen() { return lid.target > 0; },
    setPlaying(on) { playing = on; },
    setPosition(fn) { getPosition = fn; },
    keyScreen: () => screenPoint([KEY_POS[0] + 0.3, KEY_POS[1], KEY_POS[2]]),
    // the key sticks out of the right-hand side: it's hidden when that side faces away from us
    keyVisible: () => !lastEye || lastEye[0] - KEY_POS[0] > -1,
    // middle of the note card, or null while the lid is closed
    cardScreen: () => (cardM && lid.angle > LID_OPEN * 0.8 ? screenPoint(onCardPoint(0, 0)) : null),
    combScreen: (i = 12) => screenPoint([PITCH_X(i), COMB_Y + 0.6, 0.2]),
    figureScreen: () => screenPoint([FIGURE_SPOT[0], FIGURE_SPOT[1] + 6, FIGURE_SPOT[2]]),
    resetView() { cam.yaw = 0.42; cam.pitch = 0.6; cam.dist = distance; userMoved = false; },
    destroy() { cancelAnimationFrame(raf); },
  };
}

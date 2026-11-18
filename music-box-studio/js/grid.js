// Music Box Studio: the note grid ("piano roll"). One column per step, one row per comb tooth.
import { LOW, HIGH, PITCHES, hasNote, noteName, isBlackKey, stepsPerBar } from './song.js';

const CELL_W = 24;
const ROW_H = 17;

export function createGrid({ canvas, labels, scroller, status, onChange, onPreview, onStrokeStart }) {
  const ctx = canvas.getContext('2d');
  let song = null;
  let playStep = null;
  let cursor = { step: 0, pitch: 72 };
  let showCursor = false;
  let stroke = null;
  let lastAutoScroll = 0;
  let userScrolledAt = 0;

  // note names down the left edge (highest note at the top)
  labels.replaceChildren(...Array.from({ length: PITCHES }, (_, i) => {
    const midi = HIGH - i;
    const s = document.createElement('span');
    s.textContent = noteName(midi);
    s.style.height = `${ROW_H}px`;
    if (midi % 12 === 0) s.classList.add('c');
    if (isBlackKey(midi)) s.classList.add('black');
    return s;
  }));

  const rowOf = (pitch) => HIGH - pitch;

  function size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = song.steps * CELL_W;
    const h = PITCHES * ROW_H;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }

  function draw() {
    if (!song) return;
    const [w, h] = size();
    ctx.clearRect(0, 0, w, h);
    // the paper: rows for sharps/flats are a shade darker, like the black keys of a piano
    for (let p = LOW; p <= HIGH; p += 1) {
      ctx.fillStyle = isBlackKey(p) ? '#d3e6f9' : '#fff6cf';
      ctx.fillRect(0, rowOf(p) * ROW_H, w, ROW_H);
    }
    const bar = stepsPerBar(song);
    // printed guide lines
    for (let s = 0; s <= song.steps; s += 1) {
      const x = s * CELL_W + 0.5;
      const isBar = s % bar === 0;
      ctx.strokeStyle = isBar ? '#f48fb8' : s % 2 === 0 ? 'rgba(143, 111, 176, 0.22)' : 'rgba(143, 111, 176, 0.08)';
      ctx.lineWidth = isBar ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let p = LOW; p <= HIGH; p += 1) {
      const y = rowOf(p) * ROW_H + 0.5;
      // white gaps between the rows, like lined notebook paper
      ctx.strokeStyle = p % 12 === 11 ? '#f48fb8' : '#ffffff';
      ctx.lineWidth = p % 12 === 11 ? 1.5 : 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // bar numbers, printed in the corner of each bar
    ctx.fillStyle = '#c94683';
    ctx.font = '800 11px Nunito, system-ui, sans-serif';
    for (let s = 0, n = 1; s < song.steps; s += bar, n += 1) ctx.fillText(String(n), s * CELL_W + 4, 12);
    // punched holes: you see the dark velvet through them
    const active = playStep == null ? -1 : Math.floor(playStep);
    for (const n of song.notes) {
      const x = n.s * CELL_W + 4;
      const y = rowOf(n.p) * ROW_H + 3.5;
      const hw = CELL_W - 8;
      const hh = ROW_H - 7;
      const on = n.s === active;
      roundRect(x, y, hw, hh, 3);
      ctx.fillStyle = on ? '#8f6fb0' : '#e0579a';
      if (on) { ctx.shadowColor = 'rgba(143, 111, 176, 0.9)'; ctx.shadowBlur = 10; }
      ctx.fill();
      ctx.shadowBlur = 0;
      // a little shine, like a glossy sticker
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      roundRect(x + 2, y + 1.5, hw - 4, 3, 1.5);
      ctx.fill();
    }
    // playhead: a thin brass line
    if (playStep != null) {
      const x = playStep * CELL_W;
      ctx.fillStyle = 'rgba(244, 143, 184, 0.2)';
      ctx.fillRect(x - 6, 0, 12, h);
      ctx.fillStyle = '#c94683';
      ctx.fillRect(x - 1, 0, 2, h);
    }
    // keyboard cursor
    if (showCursor) {
      ctx.strokeStyle = '#5b3654';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(cursor.step * CELL_W + 1.5, rowOf(cursor.pitch) * ROW_H + 1.5, CELL_W - 3, ROW_H - 3);
      ctx.setLineDash([]);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cellAt(e) {
    const rect = canvas.getBoundingClientRect();
    const step = Math.floor((e.clientX - rect.left) / CELL_W);
    const pitch = HIGH - Math.floor((e.clientY - rect.top) / ROW_H);
    if (step < 0 || step >= song.steps || pitch < LOW || pitch > HIGH) return null;
    return { step, pitch };
  }

  function apply(cell, on) {
    if (onChange(cell.step, cell.pitch, on) && on) onPreview(cell.pitch);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !song) return;
    const cell = cellAt(e);
    if (!cell) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    showCursor = false;
    onStrokeStart();
    const on = !hasNote(song, cell.step, cell.pitch);
    stroke = { on, last: `${cell.step}:${cell.pitch}` };
    apply(cell, on);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!stroke) return;
    const cell = cellAt(e);
    if (!cell) return;
    const k = `${cell.step}:${cell.pitch}`;
    if (k === stroke.last) return;
    stroke.last = k;
    apply(cell, stroke.on);
  });
  const end = () => { stroke = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // keyboard: arrows move, Enter/Space toggles
  canvas.addEventListener('focus', () => { showCursor = true; draw(); });
  canvas.addEventListener('blur', () => { showCursor = false; draw(); });
  canvas.addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (moves[e.key]) {
      e.preventDefault();
      const [ds, dp] = moves[e.key];
      cursor.step = Math.max(0, Math.min(song.steps - 1, cursor.step + ds * (e.shiftKey ? stepsPerBar(song) : 1)));
      cursor.pitch = Math.max(LOW, Math.min(HIGH, cursor.pitch + dp));
      showCursor = true;
      keepVisible(cursor.step * CELL_W);
      status.textContent = `${noteName(cursor.pitch)}, bar ${Math.floor(cursor.step / stepsPerBar(song)) + 1}${hasNote(song, cursor.step, cursor.pitch) ? ', punched' : ''}`;
      draw();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onStrokeStart();
      const on = !hasNote(song, cursor.step, cursor.pitch);
      apply(cursor, on);
      status.textContent = `${noteName(cursor.pitch)} ${on ? 'punched' : 'filled in'}`;
    }
  });

  scroller.addEventListener('scroll', () => { if (performance.now() - lastAutoScroll > 120) userScrolledAt = performance.now(); }, { passive: true });

  function keepVisible(x) {
    const left = scroller.scrollLeft;
    const width = scroller.clientWidth;
    if (x < left + 30 || x > left + width - 60) {
      lastAutoScroll = performance.now();
      scroller.scrollLeft = Math.max(0, x - width * 0.25);
    }
  }

  return {
    setSong(next) { song = next; cursor.step = Math.min(cursor.step, song.steps - 1); draw(); },
    setPlayStep(step) {
      const changed = (step == null) !== (playStep == null) || (step != null && Math.abs(step - playStep) > 0.02);
      playStep = step;
      if (step != null && performance.now() - userScrolledAt > 2500) keepVisible(step * CELL_W);
      if (changed) draw();
    },
    redraw: draw,
  };
}

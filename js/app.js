// Music Box Studio: wires the studio and the gift view together.
import {
  createSong, createGift, setNote, setLength, sortNotes, cloneSong, stepsPerBar,
  encode, decode, BOX_COLORS, COLOR_ORDER, FIGURES, MAX_STEPS, MIN_STEPS, LIMITS,
} from './song.js';
import { TUNES } from './tunes.js';
import { MusicBoxAudio } from './audio.js';
import { createMusicBox } from './box3d.js';
import { createGrid } from './grid.js';

const $ = (id) => document.getElementById(id);
const STORE = 'musicbox-studio'; // older versions saved the last box here; it's now cleared
const audio = new MusicBoxAudio();

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { gift: p.get('gift'), song: p.get('song') };
}

// =============================================================================== gift view
function startGift(code) {
  $('studio').hidden = true;
  $('gift').hidden = false;
  document.title = 'A music box for you';
  let data;
  try {
    data = decode(code);
  } catch (e) {
    $('envelope-scene').hidden = true;
    const box = $('gift-error');
    box.hidden = false;
    const p = document.createElement('p');
    p.textContent = /newer/.test(e.message)
      ? 'This music box was made with a newer version of Music Box Studio. Try refreshing the page.'
      : 'This music box link is incomplete. Ask the sender to copy the whole link again.';
    const a = document.createElement('a');
    a.href = './';
    a.className = 'btn btn-brass';
    a.textContent = 'Make your own music box';
    box.replaceChildren(p, a);
    return;
  }
  const { song, gift } = data;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- step 1: the sealed envelope
  $('env-to').textContent = gift.to || 'For you';
  $('env-from').textContent = gift.from ? `from ${gift.from}` : '';
  $('seal-letter').textContent = gift.from ? [...gift.from.trim()][0].toUpperCase() : '♪';
  $('gift-heading').textContent = gift.to || 'For you';
  $('gift-sub').textContent = gift.from ? `from ${gift.from}` : '';
  if (gift.to) document.title = `A music box: ${gift.to}`;

  const box = createMusicBox($('gift-canvas'), { onKey: wind, onLid: wind, onCard: () => openLetter(), onTurn: () => $('turn-hint').classList.add('used'), distance: 44, minDist: 38 });
  if (box) {
    box.setSong(song);
    box.setGift(gift);
    box.setLid(false, true);
    box.setPosition(() => audio.position());
  }

  let opened = false;
  function openEnvelope() {
    if (opened) return;
    opened = true;
    audio.unlock(); // the tap that opens the envelope also allows sound later
    $('envelope').classList.add('open');
    $('envelope-scene').classList.add('opening');
    setTimeout(() => $('gift').classList.add('revealed'), reduceMotion ? 0 : 900);
    setTimeout(() => {
      $('envelope-scene').hidden = true;
      $('gift-top').hidden = false;
      $('gift-bottom').hidden = false;
      $('wind').focus({ preventScroll: true });
      showKeyHint = true;
    }, reduceMotion ? 0 : 1700);
  }
  $('envelope').addEventListener('click', openEnvelope);

  // ---- step 2: a glowing ring around the winding key
  let showKeyHint = false;
  const hint = $('key-hint');
  (function track() {
    requestAnimationFrame(track);
    let pt = showKeyHint && box && box.keyVisible() ? box.keyScreen() : null;
    if (pt) {
      // measure from the gift screen itself, so the ring stays on the key even if the page is zoomed
      const area = $('gift').getBoundingClientRect();
      pt = [pt[0] - area.left, pt[1] - area.top];
      if (pt[0] < 0 || pt[1] < 0 || pt[0] > area.width || pt[1] > area.height) pt = null;
    }
    hint.hidden = !pt;
    if (pt) {
      hint.style.left = `${pt[0]}px`;
      hint.style.top = `${pt[1]}px`;
      hint.classList.toggle('flip', pt[0] > $('gift').clientWidth - 110);
    }
  })();

  // ---- step 3: turn the key → the lid opens, the figure rises, the song plays once.
  // When it ends: "Play it again" or "Make one back".
  const hasNote = Boolean(gift.message.trim());
  let wound = false;
  function wind() {
    if (!opened || audio.playing) return;
    showKeyHint = false;
    $('wind').hidden = true;
    $('gift-after').hidden = true;
    $('gift').classList.add('open');
    if (box) { box.setLid(true); box.setPlaying(true); }
    audio.play(song, { loops: 1, windDown: true });
    if (!wound && hasNote) setTimeout(() => { if (!letterSeen) $('note-tip').hidden = false; }, reduceMotion ? 0 : 1600);
    wound = true;
  }
  audio.onChange((playing, reason) => {
    if (box) box.setPlaying(playing);
    if (!playing && reason === 'ended') {
      $('gift-after').hidden = false;
      if ($('letter').hidden) $('again').focus({ preventScroll: true });
    }
  });
  $('wind').addEventListener('click', wind);
  $('again').addEventListener('click', wind);

  // ---- the note: tap the card in the lid and it opens as a letter
  let letterSeen = false;
  $('letter-to').textContent = gift.to ? `${gift.to},` : 'For you,';
  $('letter-text').textContent = gift.message;
  $('letter-from').textContent = gift.from ? `— ${gift.from}` : '';
  let returnFocus = null;
  function openLetter() {
    if (!hasNote || !wound || !$('letter').hidden) return;
    letterSeen = true;
    $('note-tip').hidden = true;
    returnFocus = document.activeElement;
    $('letter').hidden = false;
    $('letter-close').focus({ preventScroll: true });
  }
  function closeLetter() {
    if ($('letter').hidden) return;
    $('letter').hidden = true;
    if (returnFocus && returnFocus !== document.body && !returnFocus.closest('[hidden]')) returnFocus.focus({ preventScroll: true });
  }
  $('letter-close').addEventListener('click', closeLetter);
  $('letter').addEventListener('click', (e) => { if (e.target === $('letter')) closeLetter(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLetter(); });

  if (!reduceMotion && box) floatingNotes($('notes-canvas'), box);
}

// little gold notes that drift up out of the box as each note plays
function floatingNotes(canvas, box) {
  const ctx = canvas.getContext('2d');
  const glyphs = ['♪', '♫', '♩', '♬'];
  const NOTE_COLORS = ['#e0579a', '#8db8e6', '#a07cc5', '#f2b733', '#6fbf87'];
  let parts = [];
  let last = performance.now();
  audio.onNote((pitches) => {
    for (const p of pitches.slice(0, 2)) {
      const from = box.combScreen(Math.max(0, Math.min(24, p - 60)));
      if (!from || parts.length > 90) continue;
      parts.push({
        x: from[0] + (Math.random() - 0.5) * 30,
        y: from[1] - 10,
        vx: (Math.random() - 0.5) * 18,
        vy: -(55 + Math.random() * 35),
        life: 0,
        max: 2.4 + Math.random() * 1.2,
        size: 24 + Math.random() * 16,
        wobble: Math.random() * Math.PI * 2,
        glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
        color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      });
    }
  });
  (function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!parts.length) return;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowBlur = 8;
    parts = parts.filter((p) => (p.life += dt) < p.max);
    for (const p of parts) {
      p.x += (p.vx + Math.sin(p.life * 2.2 + p.wobble) * 16) * dt;
      p.y += p.vy * dt;
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, p.life * 4) * (1 - t) ** 1.4;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(p.glyph, p.x, p.y);   // white outline so they show on the stripes
      ctx.fillStyle = p.color;
      ctx.font = `800 ${p.size * (0.8 + t * 0.4)}px Nunito, system-ui, sans-serif`;
      ctx.fillText(p.glyph, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  })(last);
}

// =============================================================================== studio
function startStudio(remixCode) {
  let song;
  let gift = createGift();
  // Every visit starts fresh with the default box (nothing is remembered between visits).
  try { localStorage.removeItem(STORE); } catch { /* storage blocked */ }
  if (remixCode) {
    try { song = decode(remixCode).song; history.replaceState(null, '', location.pathname); toast('Their tune is on the strip. Change it however you like.'); } catch { /* ignore a broken link */ }
  }
  if (!song) song = cloneSong(TUNES[0].song);

  const undo = [];
  const save = () => {}; // kept so edits have one place to hook into; nothing is stored

  // ---------- 3D box ----------
  const box = createMusicBox($('box-canvas'), { onKey: togglePlay, onLid: () => box.setLid(!box.lidOpen) });
  if (!box) $('no-webgl').hidden = false;
  else {
    box.setLid(true, true);
    box.setPosition(() => audio.position());
  }

  // ---------- grid ----------
  const grid = createGrid({
    canvas: $('grid'),
    labels: $('grid-labels'),
    scroller: $('grid-scroll'),
    status: $('grid-status'),
    onStrokeStart() {
      undo.push(cloneSong(song));
      if (undo.length > 60) undo.shift();
      $('undo').disabled = false;
    },
    onChange(step, pitch, on) {
      const changed = setNote(song, step, pitch, on);
      if (changed) songChanged();
      return changed;
    },
    onPreview(pitch) { if (!audio.playing) audio.preview(pitch); },
  });

  function songChanged({ refit = false } = {}) {
    sortNotes(song);
    grid.setSong(song);
    if (box) box.setSong(song);
    audio.update(song);
    $('note-count').textContent = String(song.notes.length);
    const bars = Math.round((song.steps / stepsPerBar(song)) * 10) / 10;
    $('bars-out').textContent = `${bars} bar${bars === 1 ? '' : 's'}`;
    $('tempo').value = String(song.tempo);
    $('tempo-out').textContent = String(song.tempo);
    $('meter').value = String(song.meter);
    $('share').hidden = true;
    if (refit) $('grid-scroll').scrollLeft = 0;
    save();
  }

  // ---------- playback ----------
  function togglePlay() {
    if (audio.playing) audio.stop();
    else if (!song.notes.length) toast('Punch a few holes in the strip first');
    else audio.play(song, { loops: Infinity });
  }
  audio.onChange((playing) => {
    if (box) box.setPlaying(playing);
    $('play').setAttribute('aria-pressed', String(playing));
    $('play-label').textContent = playing ? 'Stop' : 'Play';
    $('play-icon').setAttribute('d', playing ? 'M7 6h10v12H7z' : 'M8 5.5v13l10-6.5z');
    if (!playing) grid.setPlayStep(null);
  });
  (function follow() {
    requestAnimationFrame(follow);
    if (audio.playing) { const p = audio.position(); grid.setPlayStep(p ? p.step % song.steps : null); }
  })();
  $('play').addEventListener('click', togglePlay);
  document.addEventListener('keydown', (e) => {
    // space bar plays/stops, unless typing or using the grid
    if (e.code !== 'Space' || e.target.closest('input, textarea, select, button, canvas')) return;
    e.preventDefault();
    togglePlay();
  });

  // ---------- toolbar ----------
  const tuneSel = $('tune');
  tuneSel.append(new Option('Choose a tune', ''), new Option('A blank strip', 'blank'),
    ...TUNES.map((t, i) => new Option(t.title, String(i))));
  tuneSel.addEventListener('change', () => {
    const v = tuneSel.value;
    if (!v) return;
    undo.push(cloneSong(song));
    $('undo').disabled = false;
    song = v === 'blank' ? createSong() : cloneSong(TUNES[Number(v)].song);
    tuneSel.value = '';
    songChanged({ refit: true });
    toast(v === 'blank' ? 'A blank strip' : `${TUNES[Number(v)].title} is on the strip`);
  });
  $('tempo').addEventListener('input', (e) => {
    song.tempo = Number(e.target.value);
    $('tempo-out').textContent = e.target.value;
    audio.update(song);
  });
  $('tempo').addEventListener('change', save);
  $('meter').addEventListener('change', (e) => { song.meter = Number(e.target.value); songChanged(); });
  const changeBars = (dir) => {
    const bar = stepsPerBar(song);
    const bars = Math.round(song.steps / bar) + dir;
    const steps = Math.max(MIN_STEPS, Math.min(MAX_STEPS, bars * bar));
    if (steps < song.steps && song.notes.some((n) => n.s >= steps)) { undo.push(cloneSong(song)); $('undo').disabled = false; }
    setLength(song, steps);
    songChanged();
  };
  $('bars-down').addEventListener('click', () => changeBars(-1));
  $('bars-up').addEventListener('click', () => changeBars(1));
  $('undo').addEventListener('click', () => {
    if (!undo.length) return;
    song = undo.pop();
    $('undo').disabled = !undo.length;
    songChanged();
  });
  $('undo').disabled = true;
  $('clear').addEventListener('click', () => {
    if (!song.notes.length) return;
    undo.push(cloneSong(song));
    $('undo').disabled = false;
    song.notes = [];
    songChanged();
    toast('Strip cleared. Undo brings it back.');
  });

  // ---------- gift options ----------
  const shownColors = COLOR_ORDER.map((id) => BOX_COLORS.find((c) => c.id === id));
  const swatch = (c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = c.texture ? 'swatch patterned' : 'swatch';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c.name);
    b.title = c.name;
    b.dataset.id = c.id;
    b.style.background = c.texture
      ? `url("${c.texture}") center / cover`
      : `rgb(${c.lacquer.map((v) => Math.round(v * 255)).join(',')})`;
    b.addEventListener('click', () => setGift({ color: c.id }));
    return b;
  };
  const group = (title, list) => {
    const row = document.createElement('div');
    row.className = 'swatch-row';
    const cap = document.createElement('span');
    cap.className = 'swatch-caption';
    cap.textContent = title;
    cap.setAttribute('aria-hidden', 'true');
    row.append(cap, ...list.map(swatch));
    return row;
  };
  $('colors').replaceChildren(
    group('Colours', shownColors.filter((c) => !c.texture)),
    group('Patterns', shownColors.filter((c) => c.texture)),
  );
  $('colors').addEventListener('keydown', (e) => {
    const i = shownColors.findIndex((c) => c.id === gift.color);
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = shownColors[(i + d + shownColors.length) % shownColors.length];
    setGift({ color: next.id });
    $('colors').querySelector(`[data-id="${next.id}"]`).focus();
  });

  // twirling figure
  $('figures').replaceChildren(...FIGURES.map((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    b.setAttribute('role', 'radio');
    b.dataset.id = f.id;
    b.textContent = f.name;
    b.addEventListener('click', () => setGift({ figure: f.id }));
    return b;
  }));
  $('figures').addEventListener('keydown', (e) => {
    const i = FIGURES.findIndex((f) => f.id === gift.figure);
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = FIGURES[(i + d + FIGURES.length) % FIGURES.length];
    setGift({ figure: next.id });
    $('figures').querySelector(`[data-id="${next.id}"]`).focus();
  });

  function setGift(patch) {
    gift = { ...gift, ...patch };
    for (const el of $('colors').querySelectorAll('.swatch')) {
      const on = el.dataset.id === gift.color;
      el.setAttribute('aria-checked', String(on));
      el.tabIndex = on ? 0 : -1;
    }
    for (const el of $('figures').children) {
      const on = el.dataset.id === gift.figure;
      el.setAttribute('aria-checked', String(on));
      el.tabIndex = on ? 0 : -1;
    }
    $('msg-count').textContent = String([...gift.message].length);
    if (box) box.setGift(gift);
    $('share').hidden = true;
    save();
  }
  for (const [id, keyName] of [['gift-to', 'to'], ['gift-from', 'from'], ['gift-message', 'message']]) {
    $(id).value = gift[keyName] || '';
    $(id).addEventListener('input', (e) => setGift({ [keyName]: [...e.target.value].slice(0, LIMITS[keyName]).join('') }));
  }

  $('make-link').addEventListener('click', async () => {
    if (!song.notes.length) { $('gift-msg').textContent = 'Punch a few holes in the strip first.'; return; }
    $('gift-msg').textContent = '';
    const url = `${location.origin}${location.pathname}#gift=${encode(song, gift)}`;
    $('share-url').value = url;
    $('preview').href = url;
    $('share').hidden = false;
    $('share-url').select();
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: 'A music box for you', url }); } catch { /* cancelled */ }
    }
  });
  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('share-url').value); toast('Gift link copied'); } catch { $('share-url').select(); toast('Press Ctrl+C to copy'); }
  });

  setGift({});
  songChanged();
}

// =============================================================================== start
const hash = readHash();
if (hash.gift) startGift(hash.gift);
else startStudio(hash.song);
window.addEventListener('hashchange', () => location.reload());

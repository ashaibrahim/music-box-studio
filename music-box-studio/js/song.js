// Music Box Studio: the song + gift data, and turning them into a share link.
//
// A song is a grid: columns are steps (one step = an eighth note), rows are pitches.
// The music box's comb has 25 teeth: every note from C4 up to C6.

export const LOW = 60;                 // MIDI number of C4
export const HIGH = 84;                // MIDI number of C6
export const PITCHES = HIGH - LOW + 1; // 25 teeth
export const MIN_STEPS = 16;
export const MAX_STEPS = 512;
export const MAX_NOTES = 1500;
export const TEMPO_MIN = 50;
export const TEMPO_MAX = 180;

// The order here is saved in gift links, so new finishes are only ever added at the end.
export const BOX_COLORS = [
  { id: 'blush', name: 'Pink', lacquer: [0.96, 0.72, 0.80], velvet: [0.87, 0.42, 0.62] },
  { id: 'cream', name: 'Cream', lacquer: [0.99, 0.96, 0.90], velvet: [0.90, 0.50, 0.68] },
  { id: 'sage', name: 'Mint', lacquer: [0.78, 0.91, 0.80], velvet: [0.90, 0.52, 0.70] },
  { id: 'lavender', name: 'Lilac', lacquer: [0.82, 0.74, 0.90], velvet: [0.62, 0.46, 0.78] },
  { id: 'walnut', name: 'Walnut', lacquer: [0.42, 0.27, 0.19], velvet: [0.80, 0.36, 0.55] },
  { id: 'butter', name: 'Butter', lacquer: [1.0, 0.94, 0.70], velvet: [0.90, 0.48, 0.66] },
  { id: 'sky', name: 'Baby blue', lacquer: [0.78, 0.87, 0.97], velvet: [0.86, 0.50, 0.70] },
  // patterned finishes: `texture` is wrapped round the box, `size` = how many cm one copy of the picture covers
  { id: 'rainbow-swirl', name: 'Rainbow swirl', lacquer: [0.67, 0.63, 0.46], velvet: [0.55, 0.40, 0.75], texture: 'assets/finishes/rainbow-swirl.jpg', size: 12 },
  { id: 'pink-swirl', name: 'Pink swirl', lacquer: [0.87, 0.61, 0.67], velvet: [0.98, 0.86, 0.90], texture: 'assets/finishes/pink-swirl.jpg', size: 11 },
  { id: 'floral-quilt', name: 'Floral quilt', lacquer: [0.91, 0.89, 0.86], velvet: [0.62, 0.74, 0.60], texture: 'assets/finishes/floral-quilt.jpg', size: 12 },
  { id: 'red-croc', name: 'Red croc', lacquer: [0.26, 0.04, 0.04], velvet: [0.93, 0.70, 0.76], texture: 'assets/finishes/red-croc.jpg', size: 10, gloss: 1 },
  { id: 'pink-mosaic', name: 'Pink mosaic', lacquer: [0.77, 0.58, 0.64], velvet: [0.72, 0.30, 0.50], texture: 'assets/finishes/pink-mosaic.jpg', size: 9, gloss: 1 },
  { id: 'painted-tiles', name: 'Painted tiles', lacquer: [0.80, 0.74, 0.66], velvet: [0.55, 0.66, 0.50], texture: 'assets/finishes/painted-tiles.jpg', size: 14 },
  { id: 'blossom', name: 'Blossom', lacquer: [0.99, 0.94, 0.79], velvet: [0.93, 0.55, 0.68], texture: 'assets/finishes/blossom.jpg', size: 17 },
  { id: 'berry-stripe', name: 'Berry stripe', lacquer: [0.69, 0.38, 0.46], velvet: [0.40, 0.04, 0.16], texture: 'assets/finishes/berry-stripe.jpg', size: 8 },
];
// the order they're shown in
export const COLOR_ORDER = ['blush', 'butter', 'sky', 'lavender', 'sage', 'cream', 'walnut',
  'rainbow-swirl', 'pink-swirl', 'floral-quilt', 'red-croc', 'pink-mosaic', 'painted-tiles', 'blossom', 'berry-stripe'];

// figures that can twirl on the stand inside the box
export const FIGURES = [
  { id: 'none', name: 'None' },
  { id: 'ballerina', name: 'Ballerina' },
  { id: 'swan', name: 'Swan' },
  { id: 'horse', name: 'Carousel horse' },
  { id: 'rose', name: 'Rose dome' },
  { id: 'cake', name: 'Birthday cake' },
];

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const noteName = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
export const isBlackKey = (midi) => [1, 3, 6, 8, 10].includes(midi % 12);

export function createSong() {
  return { tempo: 96, meter: 4, steps: 64, notes: [] }; // meter = beats per bar (2 steps per beat)
}

export function createGift() {
  return { color: 'blush', figure: 'ballerina', to: '', from: '', message: '' };
}

const key = (s, p) => s * 128 + p;

export function hasNote(song, step, pitch) {
  return song.notes.some((n) => n.s === step && n.p === pitch);
}

export function setNote(song, step, pitch, on) {
  if (step < 0 || step >= song.steps || pitch < LOW || pitch > HIGH) return false;
  const i = song.notes.findIndex((n) => n.s === step && n.p === pitch);
  if (on && i < 0) {
    if (song.notes.length >= MAX_NOTES) return false;
    song.notes.push({ s: step, p: pitch });
    return true;
  }
  if (!on && i >= 0) {
    song.notes.splice(i, 1);
    return true;
  }
  return false;
}

export function sortNotes(song) {
  song.notes.sort((a, b) => key(a.s, a.p) - key(b.s, b.p));
  return song;
}

export function setLength(song, steps) {
  song.steps = Math.max(MIN_STEPS, Math.min(MAX_STEPS, Math.round(steps)));
  song.notes = song.notes.filter((n) => n.s < song.steps);
  return song;
}

export const stepsPerBar = (song) => song.meter * 2;

export function cloneSong(song) {
  return { ...song, notes: song.notes.map((n) => ({ ...n })) };
}

// ---------------------------------------------------------------------------
// Share links. Everything (song + gift) is packed into bytes, then base64url,
// so a link needs no database: https://site/#gift=AQBg...
//
//   byte 0      format version (1)
//   byte 1      tempo
//   byte 2      meter (3 or 4)
//   bytes 3-4   steps
//   bytes 5-6   number of notes
//   per note    step (2 bytes) + pitch offset from C4 (1 byte)
//   then        colour index, figure index (version 2+), and three short texts (to, from, message): 2-byte length + UTF-8
// ---------------------------------------------------------------------------

const VERSION = 2; // version 1 links (no figure) still open
export const LIMITS = { to: 24, from: 24, message: 220 };

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const clip = (text, max) => [...String(text || '')].slice(0, max).join('');

export function encode(song, gift = createGift()) {
  const enc = new TextEncoder();
  const notes = sortNotes(cloneSong(song)).notes.slice(0, MAX_NOTES);
  const texts = ['to', 'from', 'message'].map((k) => enc.encode(clip(gift[k], LIMITS[k])));
  const size = 7 + notes.length * 3 + 2 + texts.reduce((n, t) => n + 2 + t.length, 0);
  const b = new Uint8Array(size);
  let i = 0;
  const u16 = (v) => { b[i++] = (v >> 8) & 255; b[i++] = v & 255; };
  b[i++] = VERSION;
  b[i++] = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(song.tempo)));
  b[i++] = song.meter === 3 ? 3 : 4;
  u16(song.steps);
  u16(notes.length);
  for (const n of notes) { u16(n.s); b[i++] = n.p - LOW; }
  b[i++] = Math.max(0, BOX_COLORS.findIndex((c) => c.id === gift.color));
  b[i++] = Math.max(0, FIGURES.findIndex((f) => f.id === gift.figure));
  for (const t of texts) { u16(t.length); b.set(t, i); i += t.length; }
  return toBase64Url(b);
}

export function decode(text) {
  const b = fromBase64Url(String(text).trim());
  let i = 0;
  const need = (n) => { if (i + n > b.length) throw new Error('This link looks cut off.'); };
  const u8 = () => { need(1); return b[i++]; };
  const u16 = () => { need(2); const v = (b[i] << 8) | b[i + 1]; i += 2; return v; };

  const version = u8();
  if (version < 1 || version > VERSION) throw new Error('This link was made by a newer version.');
  const song = createSong();
  song.tempo = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, u8()));
  song.meter = u8() === 3 ? 3 : 4;
  song.steps = Math.max(MIN_STEPS, Math.min(MAX_STEPS, u16()));
  const count = Math.min(u16(), MAX_NOTES);
  for (let n = 0; n < count; n += 1) {
    const s = u16();
    const p = LOW + u8();
    if (s < song.steps && p <= HIGH && !hasNote(song, s, p)) song.notes.push({ s, p });
  }
  const gift = createGift();
  gift.color = (BOX_COLORS[u8()] || BOX_COLORS[0]).id;
  gift.figure = version >= 2 ? (FIGURES[u8()] || FIGURES[0]).id : 'none';
  const dec = new TextDecoder();
  for (const k of ['to', 'from', 'message']) {
    const len = u16();
    need(len);
    gift[k] = clip(dec.decode(b.subarray(i, i + len)), LIMITS[k]);
    i += len;
  }
  return { song: sortNotes(song), gift };
}

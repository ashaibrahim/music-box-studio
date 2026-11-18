// Starter tunes. All of these are old enough to be in the public domain.
// Written as "note:steps" (one step = one grid column); "-" is a rest.
import { createSong, setNote, sortNotes } from './song.js';

const MIDI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function toMidi(name) {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  return (Number(m[3]) + 1) * 12 + MIDI[m[1]] + (m[2] ? 1 : 0);
}

function build({ title, tempo, meter, bars, melody }) {
  const song = createSong();
  song.tempo = tempo;
  song.meter = meter;
  song.steps = bars * meter * 2;
  let step = 0;
  for (const token of melody.trim().split(/\s+/)) {
    const [name, len = '1'] = token.split(':');
    for (const part of name === '-' ? [] : name.split('+')) setNote(song, step, toMidi(part), true); // "C5+E5" = chord
    step += Number(len);
  }
  return { title, song: sortNotes(song), used: step };
}

export const TUNES = [
  build({
    title: 'Twinkle, Twinkle, Little Star',
    tempo: 100, meter: 4, bars: 12,
    melody: `C5:2 C5:2 G5:2 G5:2 A5:2 A5:2 G5:4 F5:2 F5:2 E5:2 E5:2 D5:2 D5:2 C5:4
             G5:2 G5:2 F5:2 F5:2 E5:2 E5:2 D5:4 G5:2 G5:2 F5:2 F5:2 E5:2 E5:2 D5:4
             C5:2 C5:2 G5:2 G5:2 A5:2 A5:2 G5:4 F5:2 F5:2 E5:2 E5:2 D5:2 D5:2 C5:4`,
  }),
  build({
    title: 'Ode to Joy (Beethoven)',
    tempo: 104, meter: 4, bars: 8,
    melody: `E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 E5:3 D5:1 D5:4
             E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 D5:3 C5:1 C5:4`,
  }),
  build({
    title: 'Für Elise (Beethoven)',
    tempo: 66, meter: 3, bars: 9,
    melody: `E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2 -:1 C4 E4 A4 B4:2 -:1 E4 G#4 B4 C5:2 -:1 E4
             E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2 -:1 C4 E4 A4 B4:2 -:1 E4 C5 B4 A4:6`,
  }),
  build({
    title: 'Happy Birthday',
    tempo: 92, meter: 3, bars: 9,
    melody: `G4 G4 A4:2 G4:2 C5:2 B4:4 G4 G4 A4:2 G4:2 D5:2 C5:4 G4 G4
             G5:2 E5:2 C5:2 B4:2 A4:2 F5 F5 E5:2 C5:2 D5:2 C5:6`,
  }),
];

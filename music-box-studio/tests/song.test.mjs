// Unit tests: run with `node --test tests/`
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSong, createGift, setNote, setLength, encode, decode, LOW, HIGH, MAX_STEPS } from '../js/song.js';
import { TUNES } from '../js/tunes.js';

test('notes can be added once and removed', () => {
  const s = createSong();
  assert.equal(setNote(s, 0, 72, true), true);
  assert.equal(setNote(s, 0, 72, true), false); // already there
  assert.equal(setNote(s, 0, 72, false), true);
  assert.equal(s.notes.length, 0);
});

test('notes outside the comb or the song are refused', () => {
  const s = createSong();
  assert.equal(setNote(s, 0, LOW - 1, true), false);
  assert.equal(setNote(s, 0, HIGH + 1, true), false);
  assert.equal(setNote(s, s.steps, 72, true), false);
});

test('shortening a song drops notes past the end', () => {
  const s = createSong();
  setNote(s, 40, 72, true);
  setLength(s, 32);
  assert.equal(s.notes.length, 0);
  setLength(s, 99999);
  assert.equal(s.steps, MAX_STEPS);
});

test('every starter tune fits its length and survives a share link', () => {
  for (const t of TUNES) {
    assert.ok(t.used <= t.song.steps, `${t.title} is too long`);
    const gift = { ...createGift(), to: 'Mei ♡', from: 'Asha', message: 'Selamat hari jadi! 🎂', color: 'sage', figure: 'cake' };
    const back = decode(encode(t.song, gift));
    assert.deepEqual(back.song, t.song);
    assert.deepEqual(back.gift, gift);
  }
});

test('long texts are trimmed to their limits', () => {
  const back = decode(encode(createSong(), { ...createGift(), to: 'x'.repeat(100), message: 'y'.repeat(999) }));
  assert.equal(back.gift.to.length, 24);
  assert.equal(back.gift.message.length, 220);
});

test('broken or tampered links are rejected politely', () => {
  assert.throws(() => decode('AQBg'), /cut off/);
  assert.throws(() => decode('CQ'), /newer version/);
});

test('old version 1 links (made before figures existed) still open', () => {
  // version 1, tempo 96, 4/4, 16 steps, one note (step 0, C5), colour 2 (sage), to "Mei", no from/message
  const bytes = [1, 96, 4, 0, 16, 0, 1, 0, 0, 12, 2, 0, 3, 77, 101, 105, 0, 0, 0, 0];
  const link = Buffer.from(bytes).toString('base64url');
  const { song, gift } = decode(link);
  assert.deepEqual(song.notes, [{ s: 0, p: 72 }]);
  assert.equal(gift.color, 'sage');
  assert.equal(gift.to, 'Mei');
  assert.equal(gift.figure, 'none');
});

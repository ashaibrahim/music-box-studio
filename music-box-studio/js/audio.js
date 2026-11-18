// Music Box Studio: the music box sound, made from scratch with the Web Audio API (no audio files).
//
// A real music box note is a thin steel tooth being plucked by a pin. It rings at its pitch,
// plus a few short, higher "inharmonic" overtones (a cantilever vibrates at about 1, 6.27 and
// 17.5 times its base frequency) and a tiny metallic click at the start.

const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

// A tiny silent WAV file (0.1 s), used to switch older iPhones into "playback" mode.
function silentWav() {
  const n = 800;
  const bytes = new Uint8Array(44 + n);
  const v = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i += 1) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  bytes.fill(128, 44);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(s)}`;
}

export class MusicBoxAudio {
  constructor() {
    this.ctx = null;
    this.timeline = [];      // scheduled steps: { time, step, dur, loop }
    this.timer = null;
    this.playing = false;
    this.listeners = new Set();
    this.noteListeners = new Set();
  }

  // Browsers only allow sound after a click or key press, so call this from one.
  unlock() {
    if (!this.ctx) {
      // iPhones mute web sound when the side switch is on silent. Asking for "playback"
      // makes it behave like a music app instead, so it plays like a video would.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older browsers */ }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.setup(new Ctx({ latencyHint: 'interactive' }));
      // Older iPhones: playing a silent <audio> clip does the same job as audioSession.
      if (!navigator.audioSession) {
        try {
          this.keepAlive = new Audio(silentWav());
          this.keepAlive.loop = true;
          this.keepAlive.setAttribute('playsinline', '');
          this.keepAlive.play().catch(() => {});
        } catch { /* no <audio> support */ }
      }
      // Phones often start the sound engine paused: wake it on every tap until it runs.
      const wake = () => {
        if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
        else for (const t of ['pointerup', 'touchend', 'click', 'keydown']) document.removeEventListener(t, wake, true);
      };
      for (const t of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(t, wake, true);
    }
    if (this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
      // a one-sample silent sound: some phones only start properly after hearing something
      const b = this.ctx.createBufferSource();
      b.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      b.connect(this.ctx.destination);
      b.start();
    }
    return this.ctx;
  }

  // Build the sound chain on any audio context (a live one, or an offline one to record a file).
  setup(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    // a small room reverb (wooden box + room)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(1.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.send = ctx.createGain();
    this.send.connect(this.reverb).connect(wet).connect(this.master);
    // one shared burst of noise for the "click" of each pluck
    this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    return ctx;
  }

  // Record a song to an AudioBuffer (used for tests and for making a demo sound file).
  async render(song, seconds) {
    const steps = 60 / song.tempo / 2;
    const length = seconds || Math.min(60, song.steps * steps + 3);
    const off = new OfflineAudioContext(2, Math.ceil(44100 * length), 44100);
    const live = this.ctx;
    this.setup(off);
    for (const n of song.notes) if (n.s * steps < length - 0.5) this.pluck(n.p, 0.05 + n.s * steps, 0.95);
    const buffer = await off.startRendering();
    this.ctx = null;
    if (live) this.setup(live);
    return buffer;
  }

  makeImpulse(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    return buf;
  }

  // One plucked tooth.
  pluck(midi, when = this.ctx.currentTime, velocity = 1) {
    const ctx = this.ctx;
    const f = midiToFreq(midi);
    const height = (midi - 60) / 24;                 // 0 for C4 … 1 for C6
    const ring = 2.8 - height * 1.5;                 // low teeth ring longer
    const out = ctx.createGain();
    out.gain.value = velocity * (0.9 - height * 0.25);
    out.connect(this.master);
    out.connect(this.send);

    const partials = [
      { ratio: 1, gain: 1, decay: ring },
      { ratio: 2.0, gain: 0.08, decay: ring * 0.35 },
      { ratio: 6.27, gain: 0.16, decay: 0.18 },
      { ratio: 17.55, gain: 0.05, decay: 0.05 },
    ];
    for (const p of partials) {
      const freq = f * p.ratio;
      if (freq > 16000) continue;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(p.gain * 0.3, when + 0.0025);
      g.gain.exponentialRampToValueAtTime(0.0001, when + p.decay);
      osc.connect(g).connect(out);
      osc.start(when);
      osc.stop(when + p.decay + 0.05);
    }

    // the click of the pin leaving the tooth
    const click = ctx.createBufferSource();
    click.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(9000, f * 5);
    bp.Q.value = 3;
    const cg = ctx.createGain();
    cg.gain.value = 0.05;
    click.connect(bp).connect(cg).connect(out);
    click.start(when);
  }

  // Hear a single note right away (when clicking the grid).
  preview(midi) {
    this.unlock();
    this.pluck(midi, this.ctx.currentTime + 0.005, 0.9);
  }

  // Play a song. options: { loops: Infinity | n, windDown: bool }
  // windDown = the end slows down like a music box whose spring is running out.
  play(song, { loops = Infinity, windDown = false, fromStep = 0 } = {}) {
    this.stop();
    this.unlock();
    this.song = song;
    this.loops = loops;
    this.windDown = windDown;
    this.playing = true;
    this.timeline = [];
    this.nextStep = fromStep;
    this.loop = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.byStep = new Map();
    for (const n of song.notes) {
      if (!this.byStep.has(n.s)) this.byStep.set(n.s, []);
      this.byStep.get(n.s).push(n.p);
    }
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
    this.emit();
  }

  // The song was edited while playing: pick up the new notes, tempo and length.
  update(song) {
    if (!this.playing) return;
    this.song = song;
    this.byStep = new Map();
    for (const n of song.notes) {
      if (!this.byStep.has(n.s)) this.byStep.set(n.s, []);
      this.byStep.get(n.s).push(n.p);
    }
    if (this.nextStep >= song.steps) { this.nextStep = 0; this.loop += 1; }
  }

  stepDuration(step, loop) {
    const base = 60 / this.song.tempo / 2;
    if (!this.windDown || loop < this.loops - 1) return base;
    // last time through: the final quarter of the song gradually slows to about half speed
    const t = step / this.song.steps;
    const slow = t < 0.75 ? 0 : (t - 0.75) / 0.25;
    return base * (1 + slow * slow * 1.1);
  }

  schedule() {
    if (!this.playing) return;
    const ctx = this.ctx;
    const horizon = ctx.currentTime + 0.15;
    while (this.nextTime < horizon) {
      if (this.loop >= this.loops) {
        // let the last notes ring, then stop
        const endAt = this.nextTime;
        if (!this.endTimer) {
          this.endTimer = setTimeout(() => { this.endTimer = null; this.stop(true); }, Math.max(0, (endAt - ctx.currentTime) * 1000) + 600);
        }
        return;
      }
      const step = this.nextStep;
      const dur = this.stepDuration(step, this.loop);
      const pitches = this.byStep.get(step) || [];
      for (const p of pitches) this.pluck(p, this.nextTime, pitches.length > 2 ? 0.75 : 0.95);
      if (pitches.length && this.noteListeners.size) {
        const delay = Math.max(0, (this.nextTime - ctx.currentTime) * 1000);
        const ps = [...pitches];
        setTimeout(() => { if (this.playing || this.endTimer) for (const fn of this.noteListeners) fn(ps); }, delay);
      }
      this.timeline.push({ time: this.nextTime, step, dur, loop: this.loop });
      if (this.timeline.length > 64) this.timeline.shift();
      this.nextTime += dur;
      this.nextStep += 1;
      if (this.nextStep >= this.song.steps) { this.nextStep = 0; this.loop += 1; }
    }
  }

  // Where the song is right now, in steps (with fractions), for the 3D box and the grid.
  position() {
    if (!this.ctx || !this.timeline.length) return null;
    const now = this.ctx.currentTime;
    let cur = null;
    for (const e of this.timeline) if (e.time <= now) cur = e;
    if (!cur) return this.playing ? { step: this.timeline[0].step, loop: 0 } : null;
    return { step: cur.step + Math.min(1, (now - cur.time) / cur.dur), loop: cur.loop };
  }

  stop(finished = false) {
    clearInterval(this.timer);
    clearTimeout(this.endTimer);
    this.timer = null;
    this.endTimer = null;
    const was = this.playing;
    this.playing = false;
    if (!finished) this.timeline = [];
    if (was) this.emit(finished ? 'ended' : 'stopped');
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  // called with the pitches of each chord, right when it sounds
  onNote(fn) { this.noteListeners.add(fn); return () => this.noteListeners.delete(fn); }
  emit(reason = '') { for (const fn of this.listeners) fn(this.playing, reason); }
}

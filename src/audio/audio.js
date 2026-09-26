// Procedural audio: zero asset downloads. SFX are tiny synth voices; music is a generative
// pentatonic loop per sector. Starts only after a user gesture (browser autoplay rules).

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
const WORLD_MUSIC = {
  nebula:    { root: 220, tempo: 92,  wave: 'triangle', scale: [0, 4, 7, 9, 12, 16] },
  asteroids: { root: 196, tempo: 104, wave: 'square',   scale: [0, 3, 5, 7, 10, 12] },
  ion:       { root: 247, tempo: 116, wave: 'sawtooth', scale: [0, 2, 7, 9, 12, 14] },
  horizon:   { root: 174, tempo: 84,  wave: 'sine',     scale: [0, 3, 7, 8, 12, 15] },
  forge:     { root: 208, tempo: 110, wave: 'triangle', scale: [0, 4, 5, 7, 11, 12] },
  rift:      { root: 185, tempo: 124, wave: 'square',   scale: [0, 1, 5, 7, 8, 12] },
};

export function createAudio() {
  let ctx = null, master = null, sfxBus = null, musicBus = null;
  let vol = { sfx: 0.8, music: 0.45 };
  let music = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor(); comp.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(comp);
      musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.5; musicBus.connect(comp);
      return true;
    } catch { ctx = null; return false; }
  }

  function tone(f, d, type = 'sine', v = 0.12, slide = 0, delay = 0, bus = sfxBus) {
    if (!ctx || !bus) return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, v = 0.1, hp = 800, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * d), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(f).connect(g).connect(sfxBus); src.start(t);
  }

  const sfx = {
    eat(combo, item) {
      const f = 392 * Math.pow(2, PENTA[Math.min(combo, 8)] / 12);
      if (item === 'orb') { tone(f, 0.1, 'triangle', 0.15); tone(f * 2, 0.07, 'sine', 0.05, 0, 0.03); }
      else if (item === 'comet') [0, 4, 7, 12].forEach((n, i) => tone(f * Math.pow(2, n / 12), 0.13, 'triangle', 0.12, 0, i * 0.05));
      else if (item === 'crystal') [0, 7, 12, 19, 24].forEach((n, i) => tone(660 * Math.pow(2, n / 12), 0.35, 'sine', 0.1, 0, i * 0.07));
      else { tone(f * 0.5, 0.28, 'sine', 0.15, 2.2); tone(f, 0.2, 'triangle', 0.06, 1.5, 0.05); }
    },
    ability(id) {
      if (id === 'supernova') { noise(0.5, 0.2, 200); tone(90, 0.6, 'sawtooth', 0.12, 0.4); }
      else if (id === 'flare') { tone(1200, 0.35, 'sawtooth', 0.08, 0.3); noise(0.3, 0.1, 2000); }
      else if (id === 'boost') { tone(300, 0.4, 'sawtooth', 0.07, 3); }
      else if (id === 'stasis') { tone(880, 0.6, 'sine', 0.1, 0.25); }
      else { tone(440, 0.3, 'triangle', 0.1, 2); tone(660, 0.3, 'sine', 0.06, 1.5, 0.05); }
    },
    shield() { tone(520, 0.2, 'square', 0.07, 0.6); tone(1040, 0.25, 'sine', 0.06); },
    revive() { [12, 7, 4, 0].forEach((n, i) => tone(440 * Math.pow(2, n / 12), 0.15, 'triangle', 0.1, 0, i * 0.06)); },
    warp() { tone(200, 0.25, 'sine', 0.1, 4); },
    warn() { tone(880, 0.06, 'square', 0.04); tone(880, 0.06, 'square', 0.04, 0, 0.12); },
    strike() { noise(0.35, 0.22, 1200); tone(120, 0.3, 'sawtooth', 0.08, 0.5); },
    sever() { tone(300, 0.2, 'square', 0.06, 0.5); },
    rivalDown() { [0, 5, 7, 12].forEach((n, i) => tone(330 * Math.pow(2, n / 12), 0.12, 'square', 0.06, 0, i * 0.05)); },
    die() { tone(240, 0.55, 'sawtooth', 0.1, 0.22); tone(120, 0.6, 'square', 0.045, 0.4, 0.06); noise(0.3, 0.08, 300); },
    finish() { tone(660, 0.2, 'triangle', 0.12); tone(440, 0.35, 'triangle', 0.12, 0, 0.18); },
    tick() { tone(1250, 0.04, 'square', 0.04); },
    start() { tone(523, 0.08, 'triangle', 0.12); tone(784, 0.14, 'triangle', 0.12, 0, 0.08); },
    count(n) { tone(n ? 520 : 1040, n ? 0.08 : 0.18, 'triangle', 0.12); },
    click() { tone(900, 0.03, 'triangle', 0.05); },
    buy() { [0, 4, 7].forEach((n, i) => tone(660 * Math.pow(2, n / 12), 0.1, 'triangle', 0.1, 0, i * 0.05)); },
    error() { tone(200, 0.15, 'square', 0.06); tone(160, 0.2, 'square', 0.06, 0, 0.1); },
    reveal(rank) { const top = [0, 4, 7, 12, 16, 19, 24].slice(0, 3 + rank); top.forEach((n, i) => tone(523 * Math.pow(2, n / 12), 0.25, 'triangle', 0.1, 0, i * 0.08)); },
    levelUp() { [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone(523 * Math.pow(2, n / 12), 0.12, 'triangle', 0.1, 0, i * 0.07)); },
  };

  function startMusic(worldId) {
    stopMusic();
    if (!ensure() || vol.music <= 0) return;
    const m = WORLD_MUSIC[worldId] || WORLD_MUSIC.nebula;
    const beat = 60 / m.tempo / 2;
    const pad = ctx.createOscillator(), padGain = ctx.createGain(), lp = ctx.createBiquadFilter();
    pad.type = 'sawtooth'; pad.frequency.value = m.root / 2;
    lp.type = 'lowpass'; lp.frequency.value = 420;
    padGain.gain.value = 0.05;
    pad.connect(lp).connect(padGain).connect(musicBus); pad.start();
    let step = 0, next = ctx.currentTime + 0.1, alive = true;
    const seq = [0, 2, 4, 1, 3, 5, 2, 4];
    const timer = setInterval(() => {
      if (!alive || !ctx) return;
      while (next < ctx.currentTime + 0.25) {
        const n = m.scale[seq[step % seq.length] % m.scale.length] + (step % 16 >= 8 ? 12 : 0);
        if (step % 2 === 0 || Math.random() < 0.4) tone(m.root * Math.pow(2, n / 12), beat * 1.6, m.wave, 0.035, 0, next - ctx.currentTime, musicBus);
        if (step % 8 === 0) tone(m.root / 2, beat * 3, 'sine', 0.08, 0, next - ctx.currentTime, musicBus);
        lp.frequency.setTargetAtTime(380 + 200 * Math.sin(step / 6), next, 0.5);
        next += beat; step++;
      }
    }, 90);
    music = { stop() { alive = false; clearInterval(timer); try { padGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); pad.stop(ctx.currentTime + 0.6); } catch { /* already stopped */ } } };
  }
  function stopMusic() { if (music) { music.stop(); music = null; } }

  return {
    unlock: ensure,
    setVolume(v) {
      vol = { ...vol, ...v };
      if (sfxBus) sfxBus.gain.value = vol.sfx;
      if (musicBus) musicBus.gain.value = vol.music * 0.5;
      if (vol.music <= 0) stopMusic();
    },
    play(name, ...args) { if (!ctx || vol.sfx <= 0) return; try { sfx[name]?.(...args); } catch { /* audio is best-effort */ } },
    startMusic, stopMusic,
  };
}

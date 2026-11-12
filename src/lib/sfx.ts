// Small synthesized sounds for the card (no audio files). Off by default; the page's sound toggle
// sets <html data-sound="on">, which is the one switch both the page and the 3D island read.

type Name = 'flip' | 'grab' | 'whoosh';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export const soundOn = () => document.documentElement.dataset.sound === 'on';

/** Create or wake the audio context. Call from a click so the browser lets it start. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/** A short metallic tick, like the ring knocking the clamp. */
function tick(a: AudioContext, at: number, gain: number) {
  for (const [f, g] of [[2650, 1], [3980, 0.6], [5300, 0.3]] as const) {
    const o = a.createOscillator();
    const v = a.createGain();
    o.frequency.value = f;
    v.gain.setValueAtTime(gain * g, at);
    v.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    o.connect(v).connect(a.destination);
    o.start(at);
    o.stop(at + 0.1);
  }
}

/** Filtered noise whose pitch sweeps lo -> hi -> lo: fabric moving through air. */
function swish(a: AudioContext, at: number, dur: number, lo: number, hi: number, gain: number) {
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(lo, at);
  f.frequency.exponentialRampToValueAtTime(hi, at + dur * 0.4);
  f.frequency.exponentialRampToValueAtTime(lo, at + dur);
  const v = a.createGain();
  v.gain.setValueAtTime(0.0001, at);
  v.gain.exponentialRampToValueAtTime(gain, at + dur * 0.3);
  v.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(v).connect(a.destination);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

/** Play a sound if sound is on. `amount` (0..1) scales loudness, e.g. how hard a throw was. */
export function play(name: Name, amount = 1) {
  if (!soundOn()) return;
  const a = unlockAudio();
  if (a.state !== 'running') return; // the browser has not allowed audio yet
  const t = a.currentTime + 0.005;
  const k = Math.max(0.15, Math.min(1, amount));
  if (name === 'flip') {
    tick(a, t, 0.05);
    swish(a, t + 0.02, 0.22, 900, 2600, 0.22);
  } else if (name === 'grab') {
    tick(a, t, 0.035);
  } else {
    swish(a, t, 0.25 + 0.2 * k, 350, 1400 + 900 * k, 0.35 * k);
  }
}

// SFX procedurais via WebAudio (sem assets externos).
import { G } from './state.js';

let ctx = null;

export function initAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() { G.muted = !G.muted; return G.muted; }

function tone(type, f0, f1, dur, vol = 0.05, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export function sfx(name) {
  if (!ctx || G.muted) return;
  switch (name) {
    case 'shoot':  tone('square', 700, 140, 0.09, 0.05); break;
    case 'swing':  tone('triangle', 300, 130, 0.08, 0.05); break;
    case 'hit':    tone('sawtooth', 170, 60, 0.07, 0.06); break;
    case 'hurt':   tone('square', 110, 60, 0.13, 0.07); break;
    case 'pickup': tone('sine', 520, 880, 0.09, 0.05); break;
    case 'heal':   tone('sine', 440, 660, 0.2, 0.05); break;
    case 'empty':  tone('square', 220, 200, 0.05, 0.03); break;
    case 'quest':  tone('sine', 660, 990, 0.22, 0.05); tone('sine', 990, 1320, 0.2, 0.04, 0.18); break;
    case 'level':  tone('sine', 523, 1046, 0.2, 0.05); break;
    case 'talk':   tone('sine', 350, 330, 0.04, 0.03); break;
    case 'alarm':  tone('square', 880, 880, 0.1, 0.04); tone('square', 660, 660, 0.1, 0.04, 0.12); break;
    case 'die':    tone('sawtooth', 200, 40, 0.4, 0.07); break;
  }
}

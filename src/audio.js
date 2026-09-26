// Tiny synthesized sound kit + music loop + narrator voice.
// No audio files needed — everything is made with the Web Audio API,
// and the narrator uses the browser's built-in speech voice.

let ctx = null;
let master, sfxGain, musicGain;
let musicTimer = null;
let musicStep = 0;
let musicTheme = 0;

export const settings = { sound: true, music: true, voice: true };

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.13;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  // iOS needs a user-gesture utterance before speech will work later
  if (window.speechSynthesis && !unlockAudio._spoke) {
    unlockAudio._spoke = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
}

function tone(freq, t0, dur, type = 'sine', vol = 0.5, dest = sfxGain, slideTo = null) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(t0, dur, vol = 0.3, filterFreq = 1200) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t0);
}

const SFX = {
  candy(t) { tone(880, t, 0.09, 'triangle', 0.35); tone(1320, t + 0.06, 0.12, 'triangle', 0.3); },
  click(t) { tone(660, t, 0.06, 'square', 0.12); },
  jump(t) { tone(300, t, 0.22, 'triangle', 0.35, sfxGain, 700); },
  bounce(t) { tone(200, t, 0.35, 'sine', 0.45, sfxGain, 900); },
  pop(t) { noise(t, 0.12, 0.35, 2500); tone(500, t, 0.12, 'triangle', 0.3, sfxGain, 1000); },
  silly(t) { tone(400, t, 0.15, 'square', 0.12, sfxGain, 250); tone(250, t + 0.15, 0.25, 'square', 0.12, sfxGain, 180); },
  bump(t) { tone(220, t, 0.25, 'sawtooth', 0.2, sfxGain, 80); noise(t, 0.15, 0.25, 600); },
  sticky(t) { tone(150, t, 0.3, 'sine', 0.25, sfxGain, 110); },
  star(t) { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.25, 'triangle', 0.3)); },
  clue(t) { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.11, 0.3, 'triangle', 0.35)); },
  win(t) { [523, 659, 784, 1047].forEach((f, i) => { tone(f, t + i * 0.15, 0.5, 'triangle', 0.3); tone(f / 2, t + i * 0.15, 0.5, 'sine', 0.2); }); },
  whoosh(t) { noise(t, 1.2, 0.3, 900); tone(200, t, 1.2, 'sine', 0.15, sfxGain, 600); },
  monster(t) { tone(140, t, 0.4, 'sawtooth', 0.15, sfxGain, 90); tone(180, t + 0.25, 0.5, 'sawtooth', 0.12, sfxGain, 120); },
  heart(t) { tone(330, t, 0.2, 'square', 0.15, sfxGain, 220); },
  tag(t) { tone(700, t, 0.1, 'square', 0.18); tone(1050, t + 0.08, 0.2, 'square', 0.18); },
};

export function sfx(name) {
  if (!settings.sound || !ctx) return;
  const f = SFX[name];
  if (f) f(ctx.currentTime + 0.01);
}

// ---------- Music: a cheerful little loop ----------
const THEMES = [
  // [melody notes (semitones from root, null = rest), bass pattern, root freq, bpm]
  { mel: [0, 4, 7, 12, 9, 7, 4, 7, 5, 9, 12, 9, 7, null, 4, null], bass: [0, 0, 5, 5, 7, 7, 0, 0], root: 392, bpm: 118 },
  { mel: [7, 9, 7, 4, 0, 2, 4, null, 5, 4, 2, 4, 7, null, 0, null], bass: [0, 0, 9, 9, 5, 5, 7, 7], root: 349, bpm: 110 },
  { mel: [0, 3, 7, 3, 10, 7, 3, 7, 5, 8, 12, 8, 7, 3, 0, null], bass: [0, 0, 8, 8, 5, 5, 7, 7], root: 330, bpm: 104 },
];

function semis(root, s) { return root * Math.pow(2, s / 12); }

export function startMusic(theme = 0) {
  musicTheme = theme % THEMES.length;
  stopMusic();
  if (!ctx) return;
  musicStep = 0;
  let next = ctx.currentTime + 0.1;
  const tick = () => {
    const th = THEMES[musicTheme];
    const stepDur = 60 / th.bpm / 2;
    while (next < ctx.currentTime + 0.3) {
      if (settings.music) {
        const m = th.mel[musicStep % th.mel.length];
        if (m !== null) tone(semis(th.root, m), next, stepDur * 0.9, 'triangle', 0.5, musicGain);
        if (musicStep % 2 === 0) {
          const b = th.bass[(musicStep / 2) % th.bass.length];
          tone(semis(th.root / 4, b), next, stepDur * 1.8, 'sine', 0.7, musicGain);
        }
        if (musicStep % 4 === 2) tone(2400, next, 0.03, 'square', 0.05, musicGain);
      }
      musicStep++;
      next += stepDur;
    }
  };
  musicTimer = setInterval(tick, 80);
  tick();
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

// ---------- Narrator voice ----------
let voice = null;
function pickVoice() {
  if (!window.speechSynthesis) return null;
  const vs = window.speechSynthesis.getVoices();
  if (!vs.length) return null;
  const prefs = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen', 'Moira', 'Tessa', 'Microsoft Zira'];
  for (const p of prefs) {
    const v = vs.find((x) => x.name.includes(p));
    if (v) return v;
  }
  return vs.find((v) => v.lang && v.lang.startsWith('en')) || vs[0];
}
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
}

let lastSpoken = '';
export function say(text, { interrupt = true } = {}) {
  lastSpoken = text;
  if (!settings.voice || !window.speechSynthesis) return;
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ');
    const u = new SpeechSynthesisUtterance(clean);
    if (!voice) voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 0.92;
    u.pitch = 1.15;
    window.speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
export function repeatSpeech() { if (lastSpoken) say(lastSpoken); }
export function stopSpeech() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* */ } }

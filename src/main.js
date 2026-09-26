import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './style.css';
import * as THREE from 'three';
import { FAMILY, makeCharacter, makeMonster, renderPortraits } from './characters.js';
import { LEVELS, buildShop, makeRoute, isValidRoute } from './levels.js';
import { WorldBuilder, makeSky } from './world.js';
import { Level, DIFFICULTY } from './game.js';
import { Globe } from './globe.js';
import { createInput } from './input.js';
import { settings, unlockAudio, sfx, say, repeatSpeech, stopSpeech, startMusic } from './audio.js';
import { damp, bakeGroup } from './lib.js';

// ============================================================
//  Save data
// ============================================================
const SAVE_KEY = 'candyMonsterGame.v2';
// Each difficulty keeps its own adventure: a route (New York → shuffled cities → New York),
// how many stops are done, and best stars / candies per city.
function freshProg() { return { unlocked: 0, route: makeRoute(), stars: {}, candies: {} }; }
function loadSave() {
  const d = {
    diff: 'easy', leader: 'rumia', seenStory: false, seenHowto: false,
    settings: { sound: true, music: true, voice: true },
    prog: { easy: freshProg(), medium: freshProg(), hard: freshProg() },
  };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) {
      Object.assign(d, s);
      d.settings = { sound: true, music: true, voice: true, ...(s.settings || {}) };
      d.prog = { easy: freshProg(), medium: freshProg(), hard: freshProg(), ...(s.prog || {}) };
      for (const k of ['easy', 'medium', 'hard']) {
        const p = d.prog[k];
        if (!isValidRoute(p.route) || typeof p.stars !== 'object' || Array.isArray(p.stars)) d.prog[k] = freshProg();
      }
    }
  } catch (e) { /* private mode etc. */ }
  return d;
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* */ } }
Object.assign(settings, save.settings);
const prog = () => save.prog[save.diff];
const route = () => prog().route;
const levelAt = (i) => LEVELS[route()[i]];
const STOPS = () => route().length;
// A brand-new adventure: new random order of cities (best stars are kept)
function newAdventure() {
  const p = prog();
  p.unlocked = 0;
  p.route = makeRoute();
  persist();
}

// ============================================================
//  Renderer + camera
// ============================================================
const canvas = document.getElementById('game');
const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const lowPower = coarse && Math.min(window.innerWidth, window.innerHeight) < 900;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 900);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

const input = createInput(canvas);

// ============================================================
//  UI helpers
// ============================================================
const uiRoot = document.getElementById('ui');
const overlay = document.createElement('div');
overlay.className = 'overlay-root';
let actions = {};
overlay.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || !overlay.contains(el)) return;
  const fn = actions[el.dataset.a];
  if (fn) { unlockAudio(); sfx('click'); fn(el); }
});
function show(html, acts = {}) {
  actions = acts;
  overlay.innerHTML = html;
}
function clearScreen() { overlay.innerHTML = ''; actions = {}; }

let portraits = {};
const img = (id, kind = 'face') => (portraits[id] ? portraits[id][kind] : '');
const fam = (id) => FAMILY.find((f) => f.id === id);
const nameOf = (id) => (id === 'monster' ? 'Candy Monster' : fam(id).name);

// ---------- HUD ----------
const hudEl = document.createElement('div');
hudEl.className = 'hud hidden';
hudEl.innerHTML = `
  <div class="top">
    <div class="stats">
      <div class="pill candy">🍬 0</div>
      <div class="pill hearts hidden"></div>
      <div class="pill stars hidden"></div>
    </div>
    <div class="objective"><div class="pill obj"></div></div>
    <div class="btns">
      <button class="icon-btn" data-h="voice" aria-label="Say it again">🔊</button>
      <button class="icon-btn" data-h="hint" aria-label="Hint">💡</button>
      <button class="icon-btn" data-h="pause" aria-label="Pause">⏸️</button>
    </div>
  </div>
  <div class="family"></div>
  <button class="jump-btn" data-h="jump" aria-label="Jump"><span>⬆</span>JUMP</button>
  <div class="toast-wrap"></div>`;
const Q = (s) => hudEl.querySelector(s);
let toastTimer = null;
const hud = {
  show() { hudEl.classList.remove('hidden'); },
  hide() { hudEl.classList.add('hidden'); Q('.toast-wrap').innerHTML = ''; },
  setCandy(n, total) {
    const el = Q('.candy');
    el.textContent = `🍬 ${n}`;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  },
  setHearts(h, max) {
    const el = Q('.hearts');
    el.classList.toggle('hidden', !max);
    el.textContent = '❤️'.repeat(Math.max(0, h)) + '🤍'.repeat(Math.max(0, max - h));
  },
  setStars(s, max) {
    const el = Q('.stars');
    el.classList.toggle('hidden', !max);
    el.textContent = `⭐ ${s} / ${max}`;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  },
  setObjective(t) { Q('.obj').textContent = t; },
  toast(msg) {
    const w = Q('.toast-wrap');
    w.innerHTML = `<div class="toast">${msg}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { w.innerHTML = ''; }, 3800);
  },
  setLeader(id) {
    hudEl.querySelectorAll('.face').forEach((f) => f.classList.toggle('lead', f.dataset.id === id));
  },
  shake() { hudEl.classList.remove('shake'); void hudEl.offsetWidth; hudEl.classList.add('shake'); },
};
hudEl.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-h], .face');
  if (!el) return;
  e.preventDefault();
  unlockAudio();
  if (el.classList.contains('face')) {
    if (level && !paused && el.dataset.id !== level.leaderId) {
      level.setLeader(el.dataset.id);
      save.leader = el.dataset.id; persist();
      say(`${fam(el.dataset.id).name} leads the way!`);
    }
    return;
  }
  const a = el.dataset.h;
  if (a === 'jump') input.queueJump();
  if (a === 'voice') { sfx('click'); repeatSpeech(); }
  if (a === 'hint' && level && !paused) level.showHint();
  if (a === 'pause' && level && !paused) { sfx('click'); pauseGame(); }
});
uiRoot.append(hudEl, overlay);

function buildHudFaces() {
  Q('.family').innerHTML = FAMILY.map((f) => `<button class="face" data-id="${f.id}" aria-label="${f.name}"><img src="${img(f.id)}" alt=""><span class="crown">👑</span></button>`).join('');
}

// ============================================================
//  Shop scene (title / story / ending)
// ============================================================
function makeShopScene() {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const W = new WorldBuilder(root, 22, 5);
  scene.add(makeSky('#8fc3f0', '#fff0f7'));
  scene.fog = new THREE.Fog('#fff0f7', 50, 160);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8b0, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(6, 14, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const shop = buildShop(W, { full: false });
  bakeGroup(root);
  const family = FAMILY.map((f, i) => {
    const c = makeCharacter(f.id);
    c.home = new THREE.Vector3(-2.7 + i * 1.7, 0, 1.6 + (i % 2) * 0.3);
    c.group.position.copy(c.home);
    root.add(c.group);
    return c;
  });
  const monster = makeMonster();
  root.add(monster.group);
  const confetti = [];
  const S = {
    scene, root, W, shop, family, monster, mode: 'title', t: 0,
    camPos: new THREE.Vector3(0, 3.4, 13), camLook: new THREE.Vector3(0, 2.2, -2),
    setMode(m) {
      S.mode = m;
      shop.setFull(m === 'ending');
      shop.setSign(m !== 'title');
      for (const c of family) { c.state.celebrate = m === 'ending' || m === 'story4'; c.state.sad = m === 'story2' || m === 'story3'; c.state.wave = false; }
      if (m === 'title') { family[0].state.wave = true; family[2].state.wave = true; }
      monster.state.happy = m === 'ending';
      monster.state.sad = false;
      monster.group.visible = m !== 'story1' && m !== 'story2' && m !== 'story4';
    },
    update(dt) {
      S.t += dt;
      const t = S.t;
      for (const f of W.animated) f(dt, t);
      for (const c of family) {
        c.group.position.copy(c.home);
        c.group.rotation.y = S.mode === 'story2' ? Math.PI : 0;
        c.state.speed = 0;
        c.update(dt, t + c.home.x);
      }
      const m = monster;
      if (S.mode === 'title') {
        m.group.position.set(7.2 + Math.sin(t * 1.3) * 0.5, 0, -1.2);
        m.group.rotation.y = -0.9;
        m.state.speed = 0.6;
      } else if (S.mode === 'story3') {
        const x = 14 - ((t * 5) % 30);
        m.group.position.set(x, 0, 4.5);
        m.group.rotation.y = -Math.PI / 2;
        m.state.speed = 5;
      } else if (S.mode === 'ending') {
        m.group.position.set(4.6, 0, 2.4);
        m.group.rotation.y = -0.4;
        m.state.speed = 0;
        if (Math.floor(t * 2) !== S._lastConf) {
          S._lastConf = Math.floor(t * 2);
          burstConfetti(root, confetti, new THREE.Vector3((Math.random() - 0.5) * 8, 5, (Math.random() - 0.5) * 3));
        }
      }
      m.update(dt, t);
      updateConfetti(root, confetti, dt);
      // camera
      const aspect = window.innerWidth / window.innerHeight;
      const k = aspect < 0.8 ? 1.7 : aspect < 1.2 ? 1.3 : 1;
      const shots = {
        title: [[Math.sin(t * 0.2) * 1.2, 2.6, 10.5 * k], [0.6, 2.6, -2]],
        story1: [[0, 2.6, 8.5 * k], [0, 2.8, 0]],
        story2: [[-1.2, 2.2, 7.5 * k], [-1.8, 2.6, -2]],
        story3: [[0, 3.2, 12 * k], [0, 3.0, 0]],
        story4: [[0, 2.4, 8 * k], [0, 2.6, 0]],
        ending: [[Math.sin(t * 0.3) * 1.5, 2.8, 11.5 * k], [0.8, 3.2, -1]],
      };
      const [p, l] = shots[S.mode] || shots.title;
      S.camPos.set(damp(S.camPos.x, p[0], 2.5, dt), damp(S.camPos.y, p[1], 2.5, dt), damp(S.camPos.z, p[2], 2.5, dt));
      S.camLook.set(damp(S.camLook.x, l[0], 3, dt), damp(S.camLook.y, l[1], 3, dt), damp(S.camLook.z, l[2], 3, dt));
      camera.position.copy(S.camPos);
      camera.lookAt(S.camLook);
    },
  };
  return S;
}
function burstConfetti(root, list, pos) {
  const cols = ['#ff4f9a', '#ffd23f', '#4f8cff', '#3fbf6a', '#b46cff', '#ff8a3d'];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
    m.position.copy(pos);
    const a = Math.random() * Math.PI * 2;
    list.push({ m, v: new THREE.Vector3(Math.cos(a) * 3 * Math.random(), 3 + Math.random() * 4, Math.sin(a) * 3 * Math.random()), life: 3 });
    root.add(m);
  }
}
function updateConfetti(root, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    p.v.y -= 5 * dt;
    p.v.multiplyScalar(0.985);
    p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += dt * 5; p.m.rotation.y += dt * 3;
    if (p.life <= 0 || p.m.position.y < 0) { root.remove(p.m); p.m.geometry.dispose(); list.splice(i, 1); }
  }
}

// ============================================================
//  Game state
// ============================================================
let mode = 'shop';
let shopScene = null;
let globe = null;
let level = null;
let levelIndex = 0;
let paused = false;

function setMode(m) {
  mode = m;
  input.reset();
  input.enabled = m === 'level';
}

// ---------- title ----------
function goTitle() {
  setMode('shop');
  disposeLevel();
  shopScene.setMode('title');
  hud.hide();
  show(`
    <div class="screen" style="justify-content:space-between">
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
        <h1 class="title-h logo"><small>The</small>Candy Monster<small>Game</small></h1>
        <p class="sub">The Candy Monster stole all the candy in the world! 🍭</p>
      </div>
      <div style="flex:1"></div>
      <button class="btn big" data-a="play">▶ PLAY</button>
      <div class="row">
        <button class="btn small" data-a="story">📖 Story</button>
        <button class="btn small" data-a="settings">⚙️ Sound</button>
      </div>
    </div>`, {
    play: () => { startMusic(0); say("Let's play the Candy Monster Game!"); goDifficulty(); },
    story: () => { startMusic(0); goStory(goTitle); },
    settings: () => goSettings(goTitle),
  });
}

// ---------- settings ----------
function goSettings(back) {
  const tg = (k, label) => `<button class="btn small toggle ${settings[k] ? '' : 'off'}" data-a="t_${k}">${label}</button>`;
  show(`
    <div class="screen dim">
      <div class="card">
        <h2>⚙️ Settings</h2>
        <div class="toggles">
          ${tg('music', '🎵 Music')}${tg('sound', '🔔 Sounds')}${tg('voice', '🗣️ Voice')}
          <button class="btn small" data-a="fs">⛶ Full screen</button>
        </div>
        <p style="font-size:16px;margin-top:14px">Grown-ups: progress is saved on this device.</p>
        <div class="row"><button class="btn small" data-a="reset">🧹 Start over</button></div>
        <div class="row" style="margin-top:12px"><button class="btn pink" data-a="back">✔ Done</button></div>
      </div>
    </div>`, {
    t_music: () => { settings.music = !settings.music; save.settings = { ...settings }; persist(); goSettings(back); },
    t_sound: () => { settings.sound = !settings.sound; save.settings = { ...settings }; persist(); goSettings(back); },
    t_voice: () => { settings.voice = !settings.voice; if (!settings.voice) stopSpeech(); save.settings = { ...settings }; persist(); goSettings(back); },
    fs: toggleFullscreen,
    reset: () => {
      if (!window.confirm('Start over? This clears all saved stars and cities.')) return;
      save.prog = { easy: freshProg(), medium: freshProg(), hard: freshProg() };
      save.seenStory = false; save.seenHowto = false; persist();
      back();
    },
    back,
  });
}
function toggleFullscreen() {
  const d = document;
  try {
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen)?.call(d.documentElement);
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
    }
  } catch (e) { /* */ }
}

// ---------- difficulty ----------
function goDifficulty() {
  setMode('shop');
  shopScene.setMode('title');
  const card = (id, emo, lollies, desc) => {
    const p = save.prog[id];
    const done = Math.min(p.unlocked, p.route.length);
    return `<button class="choice ${id}" data-a="pick" data-d="${id}">
      <div class="emo">${emo}</div><div class="name">${DIFFICULTY[id].label}</div>
      <div class="lollies">${lollies}</div><div class="desc">${desc}</div>
      <div class="prog">${done ? `🌍 ${done} of ${p.route.length} stops` : ''}</div></button>`;
  };
  show(`
    <div class="screen">
      <p class="sub">How brave are you? Pick one!</p>
      <div class="choices">
        ${card('easy', '🐣', '🍭', 'Follow the yellow arrow. No bumps!')}
        ${card('medium', '🦊', '🍭🍭', 'Solve the riddle. Jump over gumballs!')}
        ${card('hard', '🦁', '🍭🍭🍭', 'Find 3 gold stars. Run from Sour Gummies!')}
      </div>
      <button class="btn small" data-a="back">⬅ Back</button>
    </div>`, {
    pick: (el) => {
      save.diff = el.dataset.d; persist();
      say(`${DIFFICULTY[save.diff].label}! Great choice!`);
      goCharacter();
    },
    back: goTitle,
  });
  say('How brave are you? Pick easy, medium, or hard!', { interrupt: false });
}

// ---------- character ----------
function goCharacter() {
  show(`
    <div class="screen">
      <p class="sub">Who leads the way? The whole family comes along!</p>
      <div class="chars">
        ${FAMILY.map((f) => `<button class="char ${f.id === save.leader ? '' : ''}" data-a="pick" data-id="${f.id}">
          <img src="${img(f.id, 'full')}" alt="${f.name}"><div class="n">${f.name}</div>${f.name !== f.realName ? `<div class="rn">${f.realName}</div>` : '<div class="rn">&nbsp;</div>'}
        </button>`).join('')}
      </div>
      <button class="btn small" data-a="back">⬅ Back</button>
    </div>`, {
    pick: (el) => {
      const id = el.dataset.id;
      save.leader = id; persist();
      overlay.querySelectorAll('.char').forEach((c) => c.classList.toggle('sel', c === el));
      say(`${fam(id).name}! ${fam(id).cheer}`);
      sfx('star');
      actions = {};
      setTimeout(() => {
        const next = () => (save.seenHowto ? goMap() : goHowto(goMap));
        if (!save.seenStory) goStory(next); else next();
      }, 1100);
    },
    back: goDifficulty,
  });
  say('Who wants to lead the way? Pick a player!', { interrupt: false });
}

// ---------- story ----------
const STORY = [
  { shot: 'story1', art: '🏪🍭', text: "Dad, Mom, Rumia and Delana walked to their favorite place in all of New York City: Mr. Sugar's Lollipop Shop!" },
  { shot: 'story2', art: '😮🪟', text: 'But oh no! The window was EMPTY! The sign said: Sorry! No candy!' },
  { shot: 'story3', art: '👾🎒', text: 'The Candy Monster took ALL the candy in the world and hid it far, far away!' },
  { shot: 'story4', art: '🔍✈️🌍', text: 'But he dropped a clue right here in New York! Each clue shows where to fly next. Let\'s bring the candy back!' },
];
function goStory(done, i = 0) {
  setMode('shop');
  hud.hide();
  const s = STORY[i];
  shopScene.setMode(s.shot);
  const last = i === STORY.length - 1;
  show(`
    <div class="screen" style="justify-content:flex-start">
      <div class="card">
        <div style="font-size:clamp(34px,6vw,54px)">${s.art}</div>
        <p style="font-weight:600">${s.text}</p>
        <div class="row" style="margin-top:10px">
          <button class="btn small" data-a="skip">Skip ⏭</button>
          <button class="btn ${last ? 'big' : 'pink'}" data-a="next">${last ? "Let's go! ✈️" : 'Next ▶'}</button>
        </div>
      </div>
    </div>`, {
    next: () => { if (last) { save.seenStory = true; persist(); done(); } else goStory(done, i + 1); },
    skip: () => { save.seenStory = true; persist(); done(); },
  });
  say(s.text);
}

// ---------- how to play ----------
function goHowto(done) {
  const touch = coarse;
  show(`
    <div class="screen dim">
      <div class="card" style="max-width:900px">
        <h2>How to play</h2>
        <div class="howto">
          <div class="how"><div class="i">${touch ? '👆' : '🖱️'}</div><div class="t">${touch ? 'Touch where you want to walk' : 'Click where you want to walk (or use the arrow keys)'}</div></div>
          <div class="how"><div class="i">⬆️</div><div class="t">Press JUMP to jump${touch ? '' : ' (or the space bar)'}</div></div>
          <div class="how"><div class="i">🍬</div><div class="t">Walk into candy to pick it up</div></div>
          <div class="how"><div class="i">🎁</div><div class="t">Walk to a surprise box to open it</div></div>
          <div class="how"><div class="i">🔍</div><div class="t">Find the hidden clue to fly to the next city!</div></div>
          <div class="how"><div class="i">👨‍👩‍👧‍👧</div><div class="t">Tap a face to change who leads</div></div>
        </div>
        <div class="row" style="margin-top:14px"><button class="btn big" data-a="ok">OK! 👍</button></div>
      </div>
    </div>`, {
    ok: () => { save.seenHowto = true; persist(); done(); },
  });
  say(`Here's how to play! ${touch ? 'Touch' : 'Click'} where you want to walk. Press jump to jump. Pick up candy, open the surprise boxes, and find the hidden clue!`);
}

// ---------- world map ----------
function stopLabel(i, open) {
  const id = route()[i];
  const c = LEVELS[id];
  if (id === 'newyork') return '🏠 New York';
  if (id === 'finale') return '🏁 Back to New York';
  return open ? `${c.flag} ${c.name}` : '❓ Mystery city';
}
function goMap(autoFly = null) {
  setMode('globe');
  disposeLevel();
  hud.hide();
  const p = prog();
  const r = route();
  const N = r.length;
  const allDone = p.unlocked >= N;
  const next = Math.min(p.unlocked, N - 1);
  globe.setProgress(r, p.unlocked, p.stars);
  if (!globe.planeId || p.unlocked === 0) globe.placePlaneAt('newyork');
  globe.focus(globe.planeId, false);
  if (autoFly !== null) { flyTo(autoFly); return; }
  const chips = r.map((id, i) => {
    const open = i <= p.unlocked;
    const st = open ? p.stars[id] || 0 : 0;
    return `<button class="chip ${open ? '' : 'locked'}" data-a="${open ? 'city' : 'locked'}" data-i="${i}">${stopLabel(i, open)} ${st ? `<span class="st">${'★'.repeat(st)}</span>` : open ? '' : '🔒'}</button>`;
  }).join('');
  const total = Object.values(p.stars).reduce((a, b) => a + (b || 0), 0);
  const nid = r[next];
  const btn = allDone ? ''
    : next === 0 ? '🏙️ Start in New York!'
    : nid === 'finale' ? '✈️ Fly home to New York!'
    : `✈️ Fly to ${LEVELS[nid].name}!`;
  show(`
    <div class="map-corner">
      <button class="icon-btn" data-a="home" aria-label="Home">🏠</button>
      <button class="icon-btn" data-a="settings" aria-label="Settings">⚙️</button>
    </div>
    <div class="map-top"><div class="pill">${allDone ? '🎉 You found every clue!' : `🌍 Stop ${next + 1} of ${N}`} · ⭐ ${total}</div></div>
    <div class="map-bottom">
      ${allDone
        ? '<div class="row"><button class="btn big" data-a="ending">🎉 Happy ending!</button><button class="btn pink" data-a="again">🔀 New adventure</button></div>'
        : `<button class="btn big" data-a="fly">${btn}</button>`}
      <div class="city-chips">${chips}</div>
    </div>`, {
    fly: () => flyTo(next),
    city: (el) => flyTo(+el.dataset.i),
    locked: () => say('That city is a mystery! Find the clues to find out where to go next.'),
    home: goTitle,
    settings: () => goSettings(() => goMap()),
    ending: () => goEnding(),
    again: () => { newAdventure(); say('A new adventure! The Candy Monster hid his clues in new places!'); goMap(); },
  });
  if (allDone) say('You found every clue! Watch the happy ending, or start a new adventure with the cities in a new order!');
  else if (next === 0) say("Our adventure starts at home in New York! Tap the big button!");
  else if (nid === 'finale') say("Let's fly home to New York and catch the Candy Monster! Tap the big button!");
  else say(`Let's fly to ${LEVELS[nid].name}! Tap the big button!`);
}

function flyTo(i) {
  const id = route()[i];
  const c = LEVELS[id];
  const from = globe.planeId || 'newyork';
  const home = id === 'finale' || id === 'newyork';
  show(`<div class="map-top"><div class="pill">✈️ ${home ? 'Going home to' : 'Flying to'} ${c.flag} ${c.name}…</div></div>`, {});
  if (globe.pinId(from) === globe.pinId(id)) {
    say(`Here we are in ${c.name}!`);
    globe.placePlaneAt(id);
    setTimeout(() => startLevel(i), 900);
    return;
  }
  say(home ? 'Whoosh! Flying home to New York!' : `Whoosh! Flying to ${c.name}!`);
  sfx('whoosh');
  globe.travel(from, id, () => startLevel(i));
}

// ---------- level ----------
function disposeLevel() {
  if (level) { level.dispose(); level = null; }
  paused = false;
}
function objectiveFor(city, D) {
  if (D.id === 'easy') return { short: `🔍 Find ${city.clue.emoji} ${city.clue.name}!`, long: `Find ${city.clue.name}! Follow the yellow arrow. Look for the rainbow light!` };
  if (D.id === 'medium') return { short: `🔍 Find ${city.clue.emoji} ${city.clue.name}!`, long: `Find ${city.clue.name}! Here is a riddle: ${city.riddle} Jump over the rolling gumballs!` };
  return { short: `⭐ Get 3 gold stars, then find ${city.clue.emoji}!`, long: `Open the surprise boxes and find 3 gold stars. Then find ${city.clue.name}. ${city.riddle} Watch out for the Sour Gummies!` };
}
function startLevel(i) {
  disposeLevel();
  levelIndex = i;
  const city = levelAt(i);
  const D = DIFFICULTY[save.diff];
  level = new Level({
    city, cityIndex: i, difficulty: save.diff, leaderId: save.leader, input, hud, lowPower,
    onComplete: (stats) => levelComplete(stats),
    onFail: () => levelFailed(),
    onFinale: () => runFinale(),
  });
  setMode('level');
  const obj = objectiveFor(city, D);
  hud.setObjective(obj.short);
  hud.show();
  hudEl.querySelector('[data-h="hint"]').classList.toggle('hidden', D.id === 'easy');
  paused = true;
  startMusic(city.music);
  show(`
    <div class="screen dim">
      <div class="card">
        <div style="font-size:clamp(46px,9vw,72px)">${city.flag}</div>
        <h2>${city.name}</h2>
        <p style="font-weight:600">${city.intro}</p>
        <p>${obj.long}</p>
        <div class="row" style="margin-top:10px"><button class="btn big" data-a="go">GO! 🚀</button></div>
      </div>
    </div>`, {
    go: () => { clearScreen(); paused = false; input.reset(); say("Let's go!"); },
  });
  say(`${city.intro} ${obj.long}`);
}

function pauseGame() {
  paused = true;
  show(`
    <div class="screen dim">
      <div class="card">
        <h2>⏸️ Paused</h2>
        <div class="row" style="flex-direction:column;align-items:center">
          <button class="btn big" data-a="resume">▶ Keep playing</button>
          <div class="row">
            <button class="btn small" data-a="how">❓ How to play</button>
            <button class="btn small" data-a="restart">🔁 Start city again</button>
          </div>
          <div class="row">
            <button class="btn small" data-a="map">🌍 World map</button>
            <button class="btn small" data-a="settings">⚙️ Sound</button>
            <button class="btn small" data-a="home">🏠 Home</button>
          </div>
        </div>
      </div>
    </div>`, {
    resume: () => { clearScreen(); paused = false; input.reset(); },
    how: () => goHowto(() => pauseGame()),
    restart: () => startLevel(levelIndex),
    map: () => goMap(),
    settings: () => goSettings(() => pauseGame()),
    home: goTitle,
  });
  say('Paused. Tap keep playing when you are ready!');
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'level' && level && !paused && level.state !== 'done') pauseGame();
});

function recordResult(stats) {
  const p = prog();
  const id = route()[levelIndex];
  p.stars[id] = Math.max(p.stars[id] || 0, stats.stars);
  p.candies[id] = Math.max(p.candies[id] || 0, stats.candies);
  p.unlocked = Math.max(p.unlocked, levelIndex + 1);
  persist();
}

function levelComplete(stats) {
  recordResult(stats);
  const city = levelAt(levelIndex);
  const nextId = route()[levelIndex + 1];
  const next = LEVELS[nextId];
  const goingHome = nextId === 'finale';
  const nextName = goingHome ? 'home to New York' : next.name;
  paused = true;
  hud.hide();
  const stars = [1, 2, 3].map((k, i) => `<span class="${k <= stats.stars ? '' : 'off'}" style="animation-delay:${0.2 + i * 0.25}s">⭐</span>`).join('');
  show(`
    <div class="screen dim">
      <div class="card">
        <div class="clue-emoji">${city.clue.emoji}</div>
        <h2>You found clue ${levelIndex + 1} of ${STOPS()}!</h2>
        <p>${cap(city.clue.name)} ${city.clue.where}!</p>
        <p style="font-weight:700">🗺️ ${goingHome ? 'The clue says the Candy Monster went home to 🇺🇸 New York!' : `The clue points to: ${next.flag} ${next.name}!`}</p>
        <div class="stars-row">${stars}</div>
        <p>🍬 ${stats.candies} cand${stats.candies === 1 ? 'y' : 'ies'}${stats.candies < stats.total ? ` <span style="opacity:.7">(${stats.total - stats.candies} still hiding!)</span>` : ' — you got them ALL!'}</p>
        <div class="row" style="margin-top:10px;flex-direction:column;align-items:center">
          <button class="btn big" data-a="next">✈️ Fly ${goingHome ? 'home!' : `to ${next.name}!`}</button>
          <div class="row"><button class="btn small" data-a="again">🔁 Play again</button><button class="btn small" data-a="map">🌍 Map</button></div>
        </div>
      </div>
    </div>`, {
    next: () => goMap(levelIndex + 1),
    again: () => startLevel(levelIndex),
    map: () => goMap(),
  });
  sfx('win');
  say(`Hooray! You found clue number ${levelIndex + 1}! You got ${stats.stars} star${stats.stars > 1 ? 's' : ''}! ${goingHome ? 'The clue says the Candy Monster went back home to New York! Let\'s go catch him!' : `The clue points to ${next.name}! Let's fly there!`}`);
}

function levelFailed() {
  paused = true;
  hud.hide();
  show(`
    <div class="screen dim">
      <div class="card">
        <div style="font-size:64px">🙈</div>
        <h2>Oops! Let's try again!</h2>
        <p>The Sour Gummies got too close. You can do it!</p>
        <div class="row"><button class="btn big" data-a="again">🔁 Try again</button></div>
        <div class="row" style="margin-top:8px"><button class="btn small" data-a="map">🌍 Map</button><button class="btn small" data-a="easier">🐣 Try Easy</button></div>
      </div>
    </div>`, {
    again: () => startLevel(levelIndex),
    map: () => goMap(),
    easier: () => { save.diff = 'easy'; persist(); startLevel(levelIndex); },
  });
  say("Oops! Let's try again! You can do it!");
}

// ---------- finale ----------
function runFinale() {
  const stats = level.stats();
  recordResult(stats);
  level.lineUp();
  hud.hide();
  const L = save.leader;
  const kid = L === 'rumia' ? 'delana' : 'rumia';
  const kid2 = kid === 'rumia' ? 'delana' : 'rumia';
  const grown = L === 'dad' ? 'mom' : 'dad';
  const lines = [
    ['monster', 'Oh no, you caught me! Hee hee… I just LOVE candy!'],
    [L, 'Candy Monster, why did you take ALL the candy in the whole world?'],
    ['monster', 'Because nobody ever shares their candy with me… sniff, sniff.'],
    [kid, "We'll share with you! Candy is sweeter when you share!"],
    [kid2, 'Yeah! Sharing is caring!'],
    ['monster', "You would share with ME? Yippee! I'll give ALL the candy back!"],
    [grown, "Let's all go back to Mr. Sugar's Lollipop Shop together!"],
  ];
  const step = (i) => {
    if (i >= lines.length) {
      clearScreen();
      level.monster.state.sad = false;
      level.monster.state.happy = true;
      for (const f of level.family) f.state.celebrate = true;
      sfx('win');
      level.fx.burst(new THREE.Vector3(level.camFocus.x, 3, level.camFocus.z), { n: 60, speed: 7, up: 8, life: 2, confetti: true });
      setTimeout(goEnding, 2600);
      return;
    }
    const [who, text] = lines[i];
    if (who === 'monster') { level.monster.state.sad = i < 3; level.monster.state.happy = i >= 5; }
    show(`
      <div class="dialog">
        <img src="${img(who)}" alt="">
        <div class="body"><div class="who">${nameOf(who)}</div><div class="txt">${text}</div></div>
        <button class="btn pink" data-a="next">${i === lines.length - 1 ? '🎉' : '▶'}</button>
      </div>`, { next: () => step(i + 1) });
    say(text);
  };
  setTimeout(() => step(0), 900);
}

function goEnding() {
  setMode('shop');
  disposeLevel();
  hud.hide();
  shopScene.setMode('ending');
  startMusic(0);
  const p = prog();
  const totalStars = Object.values(p.stars).reduce((a, b) => a + (b || 0), 0);
  const totalCandy = Object.values(p.candies).reduce((a, b) => a + (b || 0), 0);
  const nextDiff = save.diff === 'easy' ? 'medium' : save.diff === 'medium' ? 'hard' : null;
  show(`
    <div class="screen" style="justify-content:flex-start">
      <div class="card">
        <h2>🎉 You saved the candy! 🎉</h2>
        <p>The Candy Monster gave all the lollipops back. Now he shares with everyone. The world is sweet again!</p>
        <p style="font-weight:700">⭐ ${totalStars} star${totalStars === 1 ? '' : 's'} · 🍬 ${totalCandy} cand${totalCandy === 1 ? 'y' : 'ies'}</p>
        <div class="row" style="margin-top:8px">
          ${nextDiff ? `<button class="btn pink" data-a="harder">${nextDiff === 'medium' ? '🦊' : '🦁'} Try ${DIFFICULTY[nextDiff].label}</button>` : ''}
          <button class="btn" data-a="again">🔁 Play again</button>
        </div>
      </div>
    </div>`, {
    harder: () => {
      save.diff = nextDiff;
      if (prog().unlocked >= STOPS()) newAdventure();
      persist(); goCharacter();
    },
    again: () => { newAdventure(); goTitle(); },
  });
  say('Hooray! You saved the candy! The Candy Monster gave all the lollipops back, and now he shares with everyone. The world is sweet again!');
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ============================================================
//  Globe taps
// ============================================================
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'globe' || globe.travelState) return;
  unlockAudio();
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  const id = globe.pick(ndc, camera);
  if (!id) return;
  // which stop of this adventure is that pin? (New York is both the first and last stop)
  const r = route();
  const maxOpen = Math.min(prog().unlocked, r.length - 1);
  let idx = -1;
  r.forEach((rid, i) => { if (globe.pinId(rid) === id && i <= maxOpen) idx = i; });
  if (idx >= 0) flyTo(idx);
  else say('That city is a mystery! Find the clues to find out where to go next.');
});

// ============================================================
//  Main loop
// ============================================================
let lastT = performance.now();
function frame(now = performance.now()) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  if (mode === 'shop' && shopScene) {
    shopScene.update(dt);
    renderer.render(shopScene.scene, camera);
  } else if (mode === 'globe' && globe) {
    globe.update(dt, camera);
    renderer.render(globe.scene, camera);
  } else if (mode === 'level' && level) {
    if (!paused) level.update(dt, camera);
    else if (level.t === 0) level.update(0.0001, camera);
    renderer.render(level.scene, camera);
  }
}

// ============================================================
//  Boot
// ============================================================
async function boot() {
  try { await document.fonts?.load('700 40px Fredoka'); } catch (e) { /* */ }
  portraits = renderPortraits();
  buildHudFaces();
  shopScene = makeShopScene();
  globe = new Globe();
  goTitle();
  frame();
  document.getElementById('loading').classList.add('hide');
  // one-time audio unlock on first touch anywhere
  const unlock = () => { unlockAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
}
boot();

// Handy for testing from the browser console: __game.startLevel(3)
window.__game = {
  startLevel: (i) => { hud.hide(); startLevel(i); }, goMap, goEnding, goTitle,
  get level() { return level; }, save, LEVELS, route, renderer, newAdventure,
  setDifficulty: (d) => { save.diff = d; persist(); },
  unpause: () => { clearScreen(); paused = false; },
};

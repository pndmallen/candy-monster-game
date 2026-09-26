import * as THREE from 'three';
import { mat, basic, mesh, outline, rng, questionTex, sparkleTex, textTex, damp, angleDamp, clamp, starShape, bakeGroup } from './lib.js';
import { WorldBuilder, resolveCollisions, makeSky, makeWeather } from './world.js';
import { makeCharacter, makeMonster, makeGummy, makeLollipop } from './characters.js';
import { makeClueModel } from './levels.js';
import { sfx, say } from './audio.js';

// ============================================================
//  Difficulty rules
// ============================================================
export const DIFFICULTY = {
  easy: {
    id: 'easy', label: 'Easy', boxes: 3, candies: 20, gumballs: 0, puddles: 0, gummies: 0, hearts: 0, stars: 0,
    arrow: true, beam: true, tags: 1, gumballSpeed: 0, monsterSpeed: 0, hintCooldown: 0,
  },
  medium: {
    id: 'medium', label: 'Medium', boxes: 5, candies: 26, gumballs: 2, puddles: 2, gummies: 0, hearts: 0, stars: 0,
    arrow: false, beam: false, tags: 2, gumballSpeed: 3.0, monsterSpeed: 3.6, hintCooldown: 0,
  },
  hard: {
    id: 'hard', label: 'Hard', boxes: 6, candies: 30, gumballs: 3, puddles: 3, gummies: 2, hearts: 3, stars: 3,
    arrow: false, beam: false, tags: 3, gumballSpeed: 4.2, monsterSpeed: 4.4, hintCooldown: 15,
  },
};

const SPEED = 5.6;
const GRAVITY = 22;
const JUMP_V = 8;
const BOUNCE_V = 13.5;
const PLAYER_R = 0.38;
const SILLY = [
  ['🧦', 'Just a stinky sock! Silly!'],
  ['🦆', 'A rubber duck! Quack quack!'],
  ['🐱', 'A sleepy kitty! Shhh!'],
  ['🥦', 'Broccoli?! That is not candy!'],
  ['🎈', 'A balloon! Pop!'],
  ['🐸', 'A froggy! Ribbit!'],
  ['🧸', 'A teddy bear! Awww!'],
  ['🦖', 'A toy dinosaur! Rawr!'],
];
const CANDY_COLORS = ['#ff4f9a', '#2f8cff', '#ffd23f', '#3fae6a', '#ff8a3d', '#b46cff', '#ff5d5d'];

// ---------- shared candy meshes ----------
let candyProtos = null;
function candyProto(i) {
  if (!candyProtos) {
    candyProtos = [];
    for (let k = 0; k < CANDY_COLORS.length; k++) {
      const c = CANDY_COLORS[k];
      // lollipop
      const l = makeLollipop(0.26, c);
      l.children[0].position.y = -0.3; l.children[0].scale.y = 0.5;
      candyProtos.push(l);
      // wrapped candy
      const w = new THREE.Group();
      const b = mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(c)); b.scale.set(1.3, 0.9, 0.9); w.add(b);
      for (const s of [-1, 1]) {
        const e = mesh(new THREE.ConeGeometry(0.16, 0.24, 8), mat(c)); e.rotation.z = s * Math.PI / 2; e.position.x = s * 0.36; w.add(e);
      }
      const stripe = mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 14), mat('#ffffff')); stripe.rotation.y = Math.PI / 2; w.add(stripe);
      candyProtos.push(w);
      // gumdrop
      const gd = mesh(new THREE.SphereGeometry(0.26, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(c, { transparent: true, opacity: 0.92 }));
      gd.scale.y = 1.2;
      const gg = new THREE.Group(); gg.add(gd);
      candyProtos.push(gg);
      bakeGroup(l); bakeGroup(w);
    }
  }
  const m = candyProtos[i % candyProtos.length].clone();
  m.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; });
  return m;
}

// ============================================================
//  Tiny particle system (candy sparkles, poofs, confetti)
// ============================================================
class Particles {
  constructor(root) {
    this.root = root;
    this.list = [];
    this.geo = new THREE.SphereGeometry(0.09, 6, 4);
    this.box = new THREE.BoxGeometry(0.16, 0.16, 0.04);
  }
  burst(pos, { n = 12, colors = CANDY_COLORS, speed = 5, up = 5, life = 0.8, size = 1, confetti = false, gravity = 12 } = {}) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(confetti ? this.box : this.geo, basic(colors[i % colors.length]));
      m.position.copy(pos);
      m.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * speed * Math.random(), up * (0.5 + Math.random()), Math.sin(a) * speed * Math.random());
      this.root.add(m);
      this.list.push({ m, v, life, max: life, gravity, spin: confetti ? (Math.random() - 0.5) * 12 : 0 });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.spin) { p.m.rotation.x += p.spin * dt; p.m.rotation.z += p.spin * dt * 0.7; }
      const k = Math.max(0, p.life / p.max);
      p.m.scale.multiplyScalar(p.life < 0.2 ? 0.9 : 1);
      if (p.life <= 0 || k <= 0) {
        this.root.remove(p.m);
        this.list.splice(i, 1);
      }
    }
  }
}

function spriteFromTex(tex, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}
function emojiTex(emoji) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 64, 72);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ============================================================
//  Level
// ============================================================
export class Level {
  /**
   * opts: { city, cityIndex, difficulty, leaderId, input, hud, onComplete, onFail, onFinale }
   */
  constructor(opts) {
    Object.assign(this, opts);
    this.D = DIFFICULTY[opts.difficulty];
    this.scene = new THREE.Scene();
    this.t = 0;
    this.state = 'play'; // play | found | chase | done | frozen
    this.candyCount = 0;
    this.stars = 0;
    this.hearts = this.D.hearts;
    this.invuln = 0;
    this.hintTimer = 0;
    this.hintCooldown = 0;
    this.toastCooldown = 0;
    this.tags = 0;
    this.paused = false;
    this.build();
  }

  // ------------------------------------------------------------
  build() {
    const city = this.city;
    const S = city.S;
    const root = new THREE.Group();
    this.scene.add(root);
    this.root = root;
    const W = new WorldBuilder(root, S, 1000 + this.cityIndex * 17);
    this.W = W;

    this.scene.add(makeSky(city.sky[0], city.sky[1]));
    this.scene.fog = new THREE.Fog(city.sky[1], 45, 140);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8c8b0, 1.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(8, 18, 10);
    sun.castShadow = true;
    const sm = this.lowPower ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    const info = city.build(W);
    bakeGroup(root);
    this.spawn = info.spawn;
    this.clueInfo = info.clue;

    this.weather = makeWeather(city.weather, S);
    if (this.weather) this.scene.add(this.weather);

    this.fx = new Particles(root);
    const r = rng(77 + this.cityIndex * 13 + this.difficulty.length);
    this.rand = r;

    // ---- family ----
    const order = ['dad', 'mom', 'rumia', 'delana'];
    this.family = order.map((id) => {
      const ch = makeCharacter(id);
      ch.pos = new THREE.Vector3(this.spawn.x + (order.indexOf(id) - 1.5) * 1.2, 0, this.spawn.z + 1);
      ch.vel = new THREE.Vector3();
      ch.vy = 0;
      ch.facing = Math.PI;
      ch.jumpDelay = -1;
      root.add(ch.group);
      return ch;
    });
    this.setLeader(this.leaderId, true);

    // ---- helpers for placing things on free ground ----
    const taken = [];
    const avoid = [
      { x: this.spawn.x, z: this.spawn.z, r: 4 },
      { x: this.clueInfo.x, z: this.clueInfo.z, r: 3.5 },
    ];
    const findSpot = (margin = 0.8, spacing = 2, tries = 200, extra = null) => {
      for (let i = 0; i < tries; i++) {
        const x = (r() * 2 - 1) * (S - 2.5);
        const z = (r() * 2 - 1) * (S - 2.5);
        if (!W.free(x, z, margin)) continue;
        if (avoid.some((a) => (a.x - x) ** 2 + (a.z - z) ** 2 < a.r * a.r)) continue;
        if (taken.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < spacing * spacing)) continue;
        if (extra && !extra(x, z)) continue;
        taken.push({ x, z });
        return { x, z };
      }
      return null;
    };
    this.findSpot = findSpot;

    // ---- surprise boxes ----
    this.boxes = [];
    const nBoxes = this.D.boxes;
    const contents = [];
    for (let i = 0; i < nBoxes; i++) {
      if (i < this.D.stars) contents.push('star');
      else contents.push(i % 2 === 0 ? 'candy' : 'silly');
    }
    // shuffle
    for (let i = contents.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [contents[i], contents[j]] = [contents[j], contents[i]]; }
    const boxCols = [['#ff6fb5', '#ffd23f'], ['#4f8cff', '#ffffff'], ['#3fae6a', '#ff4f9a'], ['#b46cff', '#ffd23f'], ['#ff8a3d', '#4f8cff'], ['#ffd23f', '#ff4f9a']];
    for (let i = 0; i < nBoxes; i++) {
      // spread boxes out: prefer spots far from each other and from spawn
      const p = findSpot(1.2, 7, 400, (x, z) => z < this.spawn.z - 5) || findSpot(1.0, 3, 400);
      if (!p) continue;
      const [c1, c2] = boxCols[i % boxCols.length];
      const g = new THREE.Group();
      const body = mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), mat(c1)); body.position.y = 0.45; outline(body, 0.03); g.add(body);
      const lid = new THREE.Group();
      const lidM = mesh(new THREE.BoxGeometry(1.25, 0.25, 1.25), mat(c1)); lid.add(lidM); outline(lidM, 0.03);
      const rb1 = mesh(new THREE.BoxGeometry(1.27, 0.27, 0.2), mat(c2)); lid.add(rb1);
      const rb2 = mesh(new THREE.BoxGeometry(0.2, 0.27, 1.27), mat(c2)); lid.add(rb2);
      for (const s of [-1, 1]) { const bow = mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 12), mat(c2)); bow.position.set(s * 0.17, 0.2, 0); bow.rotation.y = Math.PI / 2; lid.add(bow); }
      lid.position.y = 1.0;
      g.add(lid);
      const rb3 = mesh(new THREE.BoxGeometry(1.12, 0.92, 0.2), mat(c2)); rb3.position.y = 0.45; g.add(rb3);
      bakeGroup(lid); lid.userData.dynamic = true; bakeGroup(g);
      const q = spriteFromTex(questionTex(), 0.9);
      q.position.y = 2.1;
      g.add(q);
      g.position.set(p.x, 0, p.z);
      g.rotation.y = r() * Math.PI;
      root.add(g);
      W.colCircle(p.x, p.z, 0.72);
      this.boxes.push({ g, lid, q, x: p.x, z: p.z, opened: false, content: contents[i], openT: 0 });
    }

    // ---- candies ----
    this.candies = [];
    for (let i = 0; i < this.D.candies; i++) {
      const p = findSpot(0.6, 1.8, 300);
      if (!p) continue;
      this.addCandy(p.x, p.z, i);
    }
    this.totalCandies = this.candies.length;

    // ---- obstacles ----
    this.pads = [];
    for (let i = 0; i < 2; i++) {
      const p = findSpot(1.2, 4, 300);
      if (!p) continue;
      const g = new THREE.Group();
      const stem = mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.4, 12), mat('#fff3e0')); stem.position.y = 0.2; g.add(stem);
      const cap = mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ff5fa2', { transparent: true, opacity: 0.9 }));
      cap.scale.set(1.05, 0.45, 1.05); cap.position.y = 0.35; outline(cap, 0.03); g.add(cap);
      for (let k = 0; k < 5; k++) { const d = mesh(new THREE.SphereGeometry(0.13, 8, 6), mat('#ffffff')); const a = k * 1.3; d.position.set(Math.cos(a) * 0.55, 0.62, Math.sin(a) * 0.55); g.add(d); }
      g.position.set(p.x, 0, p.z);
      cap.userData.dynamic = true;
      bakeGroup(g);
      root.add(g);
      this.pads.push({ g, cap, x: p.x, z: p.z, squash: 0 });
    }
    const lvlBoost = Math.min(3, Math.floor(this.cityIndex / 2));
    this.puddles = [];
    const nPud = this.D.puddles ? this.D.puddles + Math.floor(this.cityIndex / 3) : 0;
    for (let i = 0; i < nPud; i++) {
      const p = findSpot(1.5, 4, 300);
      if (!p) continue;
      const rr = 1.5 + r() * 0.6;
      const g = new THREE.Group();
      const d = mesh(new THREE.CircleGeometry(rr, 24), mat('#b0672a'), { shadow: false }); d.rotation.x = -Math.PI / 2; d.position.y = 0.03; d.receiveShadow = true; g.add(d);
      const hl = mesh(new THREE.CircleGeometry(rr * 0.35, 16), basic('#e8a867'), { shadow: false }); hl.rotation.x = -Math.PI / 2; hl.position.set(-rr * 0.3, 0.04, -rr * 0.2); hl.scale.y = 0.5; g.add(hl);
      for (let k = 0; k < 3; k++) { const b = mesh(new THREE.SphereGeometry(0.15, 8, 6), mat('#b0672a')); b.position.set((r() - 0.5) * rr, 0.05, (r() - 0.5) * rr); b.scale.y = 0.5; g.add(b); }
      g.position.set(p.x, 0, p.z);
      root.add(g);
      this.puddles.push({ x: p.x, z: p.z, r: rr });
    }
    this.gumballs = [];
    const nGum = this.D.gumballs ? this.D.gumballs + lvlBoost : 0;
    for (let i = 0; i < nGum; i++) {
      let lane = null;
      for (let tries = 0; tries < 200 && !lane; tries++) {
        const a = findSpot(1.2, 2, 50);
        if (!a) break;
        const ang = r() * Math.PI * 2;
        const len = 7 + r() * 6;
        const b = { x: a.x + Math.cos(ang) * len, z: a.z + Math.sin(ang) * len };
        let ok = true;
        for (let k = 0; k <= 12; k++) {
          const x = a.x + (b.x - a.x) * (k / 12), z = a.z + (b.z - a.z) * (k / 12);
          if (!W.free(x, z, 0.9) || avoid.some((v) => (v.x - x) ** 2 + (v.z - z) ** 2 < (v.r + 1) ** 2)) { ok = false; break; }
        }
        if (ok) lane = { a, b, len };
        else taken.pop();
      }
      if (!lane) continue;
      const col = CANDY_COLORS[i % CANDY_COLORS.length];
      const ball = mesh(new THREE.SphereGeometry(0.75, 20, 14), mat(col));
      outline(ball, 0.04);
      for (let k = 0; k < 8; k++) {
        const sp = mesh(new THREE.SphereGeometry(0.1, 6, 4), basic('#ffffff'));
        const n = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.74);
        sp.position.copy(n); ball.add(sp);
      }
      ball.position.set(lane.a.x, 0.75, lane.a.z);
      bakeGroup(ball);
      root.add(ball);
      // faint track so kids can see where it rolls
      const track = mesh(new THREE.PlaneGeometry(lane.len, 1.4), basic(col, { transparent: true, opacity: 0.18, depthWrite: false }), { shadow: false });
      track.rotation.x = -Math.PI / 2;
      track.rotation.z = -Math.atan2(lane.b.z - lane.a.z, lane.b.x - lane.a.x);
      track.position.set((lane.a.x + lane.b.x) / 2, 0.02, (lane.a.z + lane.b.z) / 2);
      root.add(track);
      this.gumballs.push({ ball, ...lane, s: r(), dir: 1, speed: this.D.gumballSpeed * (1 + this.cityIndex * 0.04) });
    }
    this.gummies = [];
    const nG = this.D.gummies ? Math.min(4, this.D.gummies + Math.floor(this.cityIndex / 3)) : 0;
    for (let i = 0; i < nG; i++) {
      const p = findSpot(1, 1.5, 400, (x, z) => z < 6 && this.gummies.every((o) => Math.hypot(o.home.x - x, o.home.z - z) > 6));
      if (!p) continue;
      const g = makeGummy(['#57e36b', '#ff5d5d', '#ff9e3d', '#5ad1ff'][i % 4]);
      g.pos = new THREE.Vector3(p.x, 0, p.z);
      g.home = { x: p.x, z: p.z };
      g.wander = r() * Math.PI * 2;
      g.group.position.copy(g.pos);
      root.add(g.group);
      this.gummies.push(g);
    }

    // ---- the hidden clue ----
    const ci = this.clueInfo;
    const clue = makeClueModel(city.clue.model);
    clue.position.set(ci.x, ci.y, ci.z);
    root.add(clue);
    if (ci.hang) {
      const len = ci.hang.y - ci.y;
      const str = mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 4), basic('#8a6a3a'), { shadow: false });
      str.position.set(ci.x, ci.y + len / 2, ci.z);
      root.add(str);
      this.clueString = str;
    }
    this.clue = { model: clue, x: ci.x, z: ci.z, y: ci.y, found: false };
    const hidden = !this.D.beam;
    clue.scale.setScalar(hidden ? 0.001 : 1);
    this.clueHidden = hidden;
    // sparkles around the hiding spot
    this.sparkles = [];
    for (let i = 0; i < 6; i++) {
      const s = spriteFromTex(sparkleTex(), 0.6);
      root.add(s);
      this.sparkles.push(s);
    }
    if (this.D.beam) {
      const beam = mesh(new THREE.CylinderGeometry(0.6, 0.9, 30, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }), { shadow: false });
      beam.position.set(ci.x, 15, ci.z);
      root.add(beam);
      this.beam = beam;
    }
    if (this.D.stars) {
      this.lock = spriteFromTex(emojiTex('🔒'), 1.1);
      this.lock.position.set(ci.x, ci.y + 1.6, ci.z);
      root.add(this.lock);
    }

    // ---- hint arrow ----
    const arrow = new THREE.Group();
    const am = basic('#ffe14a');
    const shaft = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 10), am, { shadow: false }); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.2; arrow.add(shaft);
    const head = mesh(new THREE.ConeGeometry(0.32, 0.6, 12), am, { shadow: false }); head.rotation.x = Math.PI / 2; head.position.z = 0.9; arrow.add(head);
    outline(head, 0.12); outline(shaft, 0.2);
    root.add(arrow);
    this.arrow = arrow;
    arrow.visible = false;

    // ---- monster (Rio finale) ----
    if (city.finale) {
      this.monster = makeMonster();
      this.monster.group.visible = false;
      this.monster.pos = new THREE.Vector3();
      root.add(this.monster.group);
    }

    // ---- camera state ----
    this.camPos = new THREE.Vector3(this.spawn.x, 12, this.spawn.z + 14);
    this.camLook = new THREE.Vector3(this.spawn.x, 1, this.spawn.z);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.target = null;

    this.hud.setCandy(0, this.totalCandies);
    this.hud.setHearts(this.hearts, this.D.hearts);
    this.hud.setStars(this.stars, this.D.stars);
  }

  addCandy(x, z, i = Math.floor(Math.random() * 99), fly = null) {
    const m = candyProto(i);
    m.position.set(x, 0.7, z);
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(m);
    const c = { m, x, z, alive: true, phase: Math.random() * 6, fly, delay: fly ? 0.6 : 0 };
    this.candies.push(c);
    return c;
  }

  setLeader(id, instant = false) {
    const idx = this.family.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const lead = this.family[idx];
    this.leader = lead;
    this.leaderId = id;
    // chain order: leader first, then the others by distance
    const rest = this.family.filter((c) => c !== lead).sort((a, b) => a.pos.distanceTo(lead.pos) - b.pos.distanceTo(lead.pos));
    this.chain = [lead, ...rest];
    for (const c of this.family) c.group.visible = true;
    if (!instant) {
      sfx('pop');
      this.fx.burst(lead.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), { n: 14, speed: 3, up: 4, life: 0.6 });
    }
    this.target = null;
    this.hud.setLeader(id);
  }

  // ------------------------------------------------------------
  toast(msg, speak = true, cooldown = 0) {
    if (cooldown && this.toastCooldown > 0) return;
    this.toastCooldown = cooldown;
    this.hud.toast(msg);
    if (speak) say(msg);
  }

  showHint() {
    if (this.hintCooldown > 0) {
      this.toast(`Hint is resting… ${Math.ceil(this.hintCooldown)}`, false);
      return;
    }
    this.hintTimer = 6;
    this.hintCooldown = this.D.hintCooldown;
    const tgt = this.hintTarget();
    sfx('star');
    if (this.state === 'chase') this.toast('Follow the arrow to the Candy Monster!');
    else if (tgt && tgt.kind === 'star') this.toast('Follow the arrow to a gold star!');
    else this.toast(`Follow the arrow! ${this.city.riddle}`);
  }

  hintTarget() {
    if (this.state === 'chase' && this.monster) return { x: this.monster.pos.x, z: this.monster.pos.z, kind: 'monster' };
    if (this.D.stars && this.stars < this.D.stars) {
      let best = null, bd = 1e9;
      for (const b of this.boxes) {
        if (b.opened || b.content !== 'star') continue;
        const d = (b.x - this.leader.pos.x) ** 2 + (b.z - this.leader.pos.z) ** 2;
        if (d < bd) { bd = d; best = b; }
      }
      if (best) return { x: best.x, z: best.z, kind: 'star' };
    }
    return { x: this.clue.x, z: this.clue.z, kind: 'clue' };
  }

  jump() {
    const L = this.leader;
    if (this.state !== 'play' && this.state !== 'chase') return;
    if (L.pos.y > 0.01) return;
    L.vy = JUMP_V;
    sfx('jump');
    this.chain.forEach((c, i) => { if (i > 0) c.jumpDelay = i * 0.14; });
  }

  // ------------------------------------------------------------
  update(dt, camera) {
    this.t += dt;
    const t = this.t;
    const L = this.leader;
    this.toastCooldown = Math.max(0, this.toastCooldown - dt);
    this.hintTimer = Math.max(0, this.hintTimer - dt);
    this.hintCooldown = Math.max(0, this.hintCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    for (const f of this.W.animated) f(dt, t);
    if (this.weather) this.weather.userData.update(dt, t);

    const canMove = this.state === 'play' || this.state === 'chase';
    // ---------- input -> desired direction ----------
    const inp = this.input;
    const desired = new THREE.Vector3();
    if (canMove) {
      const k = inp.keyVector();
      if (k.x || k.z) {
        desired.set(k.x, 0, k.z).normalize();
        this.target = null;
      } else if (inp.pointer.active) {
        const ndc = new THREE.Vector2((inp.pointer.x / window.innerWidth) * 2 - 1, -(inp.pointer.y / window.innerHeight) * 2 + 1);
        this.raycaster.setFromCamera(ndc, camera);
        const hit = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) this.target = hit;
      }
      if (this.target && !(k.x || k.z)) {
        const d = new THREE.Vector3(this.target.x - L.pos.x, 0, this.target.z - L.pos.z);
        const len = d.length();
        if (len > 0.35) desired.copy(d.multiplyScalar(1 / len)).multiplyScalar(Math.min(1, len / 0.9));
        else if (!inp.pointer.active) this.target = null;
      }
      if (inp.consumeJump()) this.jump();
    } else {
      inp.consumeJump();
    }

    // ---------- leader physics ----------
    let slow = 1;
    for (const p of this.puddles) {
      if ((L.pos.x - p.x) ** 2 + (L.pos.z - p.z) ** 2 < p.r * p.r && L.pos.y < 0.1) {
        slow = 0.42;
        if (!this._inPuddle) { sfx('sticky'); this.toast('Sticky caramel! Slow down!', true, 6); }
      }
    }
    this._inPuddle = slow < 1;
    const sp = SPEED * slow;
    L.vel.x = damp(L.vel.x, desired.x * sp, 10, dt);
    L.vel.z = damp(L.vel.z, desired.z * sp, 10, dt);
    if (this.knock) {
      L.vel.x += this.knock.x; L.vel.z += this.knock.z;
      this.knock = null;
    }
    L.pos.x += L.vel.x * dt;
    L.pos.z += L.vel.z * dt;
    resolveCollisions(L.pos, PLAYER_R, this.W.colliders, this.city.S);

    // everyone: gravity + jumping + bounce pads + animation
    this.chain.forEach((c, i) => {
      if (i > 0 && c.jumpDelay >= 0) {
        c.jumpDelay -= dt;
        if (c.jumpDelay < 0 && c.pos.y <= 0.01) c.vy = JUMP_V * 0.9;
      }
      c.vy -= GRAVITY * dt;
      c.pos.y += c.vy * dt;
      if (c.pos.y <= 0) { c.pos.y = 0; c.vy = 0; }
      for (const p of this.pads) {
        if ((c.pos.x - p.x) ** 2 + (c.pos.z - p.z) ** 2 < 1.1 && c.pos.y < 0.5 && c.vy <= 0) {
          c.vy = BOUNCE_V;
          p.squash = 1;
          if (c === L) { sfx('bounce'); this.toast('Boing!', false, 2); }
        }
      }
    });

    // ---------- followers ----------
    for (let i = 1; i < this.chain.length && this.state !== 'cutscene'; i++) {
      const f = this.chain[i], prev = this.chain[i - 1];
      const dx = prev.pos.x - f.pos.x, dz = prev.pos.z - f.pos.z;
      const dist = Math.hypot(dx, dz);
      const gap = 1.25;
      if (dist > 14) {
        f.pos.x = prev.pos.x - dx / dist * gap; f.pos.z = prev.pos.z - dz / dist * gap;
      }
      let vx = 0, vz = 0;
      if (dist > gap) {
        const s = Math.min(SPEED * 1.15, (dist - gap) * 5);
        vx = (dx / dist) * s; vz = (dz / dist) * s;
      }
      f.vel.x = damp(f.vel.x, vx, 10, dt);
      f.vel.z = damp(f.vel.z, vz, 10, dt);
      f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt;
      // keep a little personal space
      for (const o of this.chain) {
        if (o === f) continue;
        const ox = f.pos.x - o.pos.x, oz = f.pos.z - o.pos.z;
        const od = Math.hypot(ox, oz);
        if (od < 0.8 && od > 0.001) { f.pos.x += (ox / od) * (0.8 - od) * 0.5; f.pos.z += (oz / od) * (0.8 - od) * 0.5; }
      }
      resolveCollisions(f.pos, 0.32, this.W.colliders, this.city.S);
    }

    for (const c of this.family) {
      const hs = Math.hypot(c.vel.x, c.vel.z);
      if (hs > 0.4) c.facing = angleDamp(c.facing, Math.atan2(c.vel.x, c.vel.z), 12, dt);
      c.group.position.copy(c.pos);
      c.group.rotation.y = c.facing;
      c.state.speed = hs;
      c.state.airborne = c.pos.y > 0.15;
      c.update(dt, t);
    }
    // leader flashing while invulnerable
    L.group.visible = this.invuln > 0 ? Math.floor(t * 12) % 2 === 0 : true;

    // ---------- candies ----------
    for (const c of this.candies) {
      if (!c.alive) continue;
      if (c.fly) {
        c.fly.vy -= 14 * dt;
        c.x += c.fly.vx * dt; c.z += c.fly.vz * dt;
        c.m.position.y += c.fly.vy * dt;
        if (c.m.position.y <= 0.7 && c.fly.vy < 0) { c.m.position.y = 0.7; c.fly = null; }
        const p = { x: c.x, z: c.z };
        resolveCollisions(p, 0.3, this.W.colliders, this.city.S);
        c.x = p.x; c.z = p.z;
        c.m.position.x = c.x; c.m.position.z = c.z;
      } else {
        c.m.position.y = 0.7 + Math.sin(t * 3 + c.phase) * 0.15;
      }
      c.m.rotation.y += dt * 2;
      c.delay -= dt;
      if (c.delay > 0) continue;
      for (const f of this.family) {
        if ((f.pos.x - c.x) ** 2 + (f.pos.z - c.z) ** 2 < 1.1 && Math.abs(f.pos.y + 0.6 - c.m.position.y) < 1.8) {
          c.alive = false;
          this.root.remove(c.m);
          this.candyCount++;
          this.hud.setCandy(this.candyCount, this.totalCandies);
          sfx('candy');
          this.fx.burst(c.m.position, { n: 8, speed: 2.5, up: 3, life: 0.5, size: 0.8 });
          break;
        }
      }
    }

    // ---------- surprise boxes ----------
    for (const b of this.boxes) {
      if (b.opened) {
        if (b.openT < 1.2) {
          b.openT += dt;
          b.lid.position.y = 1.0 + b.openT * 3;
          b.lid.rotation.x = b.openT * 4;
          b.lid.scale.setScalar(Math.max(0.01, 1 - b.openT / 1.2));
        }
        if (b.popup) {
          b.popup.position.y = 1.4 + Math.min(1.2, b.openT * 2);
          b.popup.material.opacity = Math.max(0, 1 - (b.openT - 1.2) / 1.5);
          b.openT += b.openT >= 1.2 ? dt : 0;
          if (b.openT > 2.8) { this.root.remove(b.popup); b.popup = null; }
        }
        continue;
      }
      b.q.position.y = 2.1 + Math.sin(t * 3 + b.x) * 0.15;
      if (!canMove) continue;
      if ((L.pos.x - b.x) ** 2 + (L.pos.z - b.z) ** 2 < 2.0 * 2.0) this.openBox(b);
    }

    // ---------- bounce pads ----------
    for (const p of this.pads) {
      p.squash = Math.max(0, p.squash - dt * 3);
      p.cap.scale.y = 0.45 * (1 - Math.sin(p.squash * Math.PI) * 0.4);
    }

    // ---------- gumballs ----------
    for (const g of this.gumballs) {
      g.s += (g.dir * g.speed * dt) / g.len;
      if (g.s > 1) { g.s = 1; g.dir = -1; }
      if (g.s < 0) { g.s = 0; g.dir = 1; }
      const x = g.a.x + (g.b.x - g.a.x) * g.s, z = g.a.z + (g.b.z - g.a.z) * g.s;
      g.ball.position.x = x; g.ball.position.z = z;
      const ax = new THREE.Vector3(-(g.b.z - g.a.z), 0, g.b.x - g.a.x).normalize();
      g.ball.rotateOnWorldAxis(ax, (g.dir * g.speed * dt) / 0.75);
      if (canMove && this.invuln <= 0 && (L.pos.x - x) ** 2 + (L.pos.z - z) ** 2 < (0.75 + PLAYER_R) ** 2 && L.pos.y < 0.9) {
        this.hurt(x, z, 'Bonk! Jump over the gumballs!');
      }
    }

    // ---------- sour gummies ----------
    for (const g of this.gummies) {
      const dx = L.pos.x - g.pos.x, dz = L.pos.z - g.pos.z;
      const d = Math.hypot(dx, dz);
      let vx, vz, s;
      if (canMove && d < 7 && this.state === 'play') {
        s = 2.7 + this.cityIndex * 0.08;
        vx = dx / d; vz = dz / d;
      } else {
        g.wander += (Math.random() - 0.5) * dt * 2;
        const hx = g.home.x - g.pos.x, hz = g.home.z - g.pos.z;
        vx = Math.cos(g.wander) + hx * 0.15; vz = Math.sin(g.wander) + hz * 0.15;
        const n = Math.hypot(vx, vz) || 1; vx /= n; vz /= n;
        s = 1.2;
      }
      g.pos.x += vx * s * dt; g.pos.z += vz * s * dt;
      resolveCollisions(g.pos, 0.5, this.W.colliders, this.city.S);
      g.group.position.copy(g.pos);
      g.group.rotation.y = Math.atan2(vx, vz);
      g.update(dt);
      if (canMove && this.state === 'play' && this.invuln <= 0 && d < 0.5 + PLAYER_R + 0.1 && L.pos.y < 1.0) {
        this.hurt(g.pos.x, g.pos.z, 'Oh no! A Sour Gummy! Run away!');
        g.pos.x -= (dx / d) * 2; g.pos.z -= (dz / d) * 2;
      }
    }

    // ---------- clue ----------
    this.updateClue(dt, t, canMove);

    // ---------- finale chase ----------
    if (this.state === 'chase') this.updateChase(dt, t);
    if (this.monster && this.monster.group.visible) this.monster.update(dt, t);

    // ---------- hint arrow ----------
    const showArrow = canMove && (this.D.arrow || this.hintTimer > 0 || this.state === 'chase');
    this.arrow.visible = showArrow;
    if (showArrow) {
      const tg = this.hintTarget();
      const hy = L.height * L.group.scale.x + 0.9;
      this.arrow.position.set(L.pos.x, L.pos.y + hy + Math.sin(t * 5) * 0.12, L.pos.z);
      this.arrow.rotation.y = Math.atan2(tg.x - L.pos.x, tg.z - L.pos.z);
    }

    this.fx.update(dt);

    // ---------- camera ----------
    const aspect = window.innerWidth / window.innerHeight;
    const far = aspect < 0.8 ? 1.45 : aspect < 1.2 ? 1.2 : 1;
    const off = this.camOffset || new THREE.Vector3(0, 8.2 * far, 10.4 * far);
    const focus = this.camFocus || L.pos;
    const want = new THREE.Vector3(focus.x + off.x, focus.y * 0.3 + off.y, focus.z + off.z);
    this.camPos.x = damp(this.camPos.x, want.x, 4, dt);
    this.camPos.y = damp(this.camPos.y, want.y, 4, dt);
    this.camPos.z = damp(this.camPos.z, want.z, 4, dt);
    this.camLook.x = damp(this.camLook.x, focus.x, 6, dt);
    this.camLook.y = damp(this.camLook.y, 1 + focus.y * 0.3, 6, dt);
    this.camLook.z = damp(this.camLook.z, focus.z - 1, 6, dt);
    camera.position.copy(this.camPos);
    camera.lookAt(this.camLook);
    this.sun.position.set(L.pos.x + 8, 18, L.pos.z + 10);
    this.sun.target.position.set(L.pos.x, 0, L.pos.z);
  }

  hurt(x, z, msg) {
    const L = this.leader;
    this.invuln = 1.8;
    const dx = L.pos.x - x, dz = L.pos.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this.knock = { x: (dx / d) * 9, z: (dz / d) * 9 };
    L.vy = 5;
    sfx('bump');
    this.hud.shake();
    // drop some candy (it can be picked up again!)
    const drop = Math.min(this.candyCount, this.D.id === 'hard' ? 3 : 2);
    for (let i = 0; i < drop; i++) {
      const a = Math.random() * Math.PI * 2;
      const c = this.addCandy(L.pos.x, L.pos.z, i, { vx: Math.cos(a) * 3.5, vz: Math.sin(a) * 3.5, vy: 6 });
      c.m.position.y = 1.2;
    }
    this.candyCount -= drop;
    this.hud.setCandy(this.candyCount, this.totalCandies);
    if (this.D.hearts) {
      this.hearts--;
      this.hud.setHearts(this.hearts, this.D.hearts);
      sfx('heart');
      if (this.hearts <= 0) {
        this.state = 'done';
        this.toast('Oh no! Out of hearts!', true);
        setTimeout(() => this.onFail && this.onFail(), 1200);
        return;
      }
    }
    this.toast(msg + (drop ? ' You dropped some candy!' : ''), true, 2);
  }

  openBox(b) {
    b.opened = true;
    b.openT = 0;
    b.q.visible = false;
    sfx('pop');
    const top = new THREE.Vector3(b.x, 1.3, b.z);
    this.fx.burst(top, { n: 18, speed: 4, up: 6, life: 0.9, confetti: true });
    if (b.content === 'candy') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.random();
        const c = this.addCandy(b.x, b.z, i, { vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vy: 7 });
        c.m.position.y = 1.3;
        this.totalCandies++;
      }
      this.hud.setCandy(this.candyCount, this.totalCandies);
      this.toast('Yay! Candy! Pick it up!', true, 0);
    } else if (b.content === 'silly') {
      const [emo, line] = SILLY[Math.floor(Math.random() * SILLY.length)];
      b.popup = spriteFromTex(emojiTex(emo), 1.4);
      b.popup.position.set(b.x, 1.4, b.z);
      this.root.add(b.popup);
      sfx('silly');
      this.toast(`${line} No clue here. Keep looking!`, true);
    } else if (b.content === 'star') {
      const st = mesh(new THREE.ExtrudeGeometry(starShape(0.5, 0.22), { depth: 0.15, bevelEnabled: false }), mat('#ffd23f'));
      outline(st, 0.06);
      b.popup = st;
      st.material = st.material.clone();
      st.material.transparent = true;
      st.position.set(b.x, 1.4, b.z);
      this.root.add(st);
      this.animStar = st;
      this.stars++;
      this.hud.setStars(this.stars, this.D.stars);
      sfx('star');
      if (this.stars >= this.D.stars) {
        this.toast('You found all the gold stars! Now the clue is unlocked. Go find it!', true);
        if (this.lock) { this.fx.burst(this.lock.position, { n: 20, colors: ['#ffd23f', '#ffffff'] }); this.root.remove(this.lock); this.lock = null; }
      } else {
        this.toast(`A gold star! That's ${this.stars}. Find ${this.D.stars - this.stars} more!`, true);
      }
    }
  }

  updateClue(dt, t, canMove) {
    const c = this.clue;
    const L = this.leader;
    const d = Math.hypot(L.pos.x - c.x, L.pos.z - c.z);
    if (this.animStar) this.animStar.rotation.y += dt * 4;
    // sparkles: always in easy, only close-up in medium/hard
    const vis = this.D.beam ? 1 : clamp((9 - d) / 5, 0, 1);
    this.sparkles.forEach((s, i) => {
      const a = t * 1.5 + (i / this.sparkles.length) * Math.PI * 2;
      s.position.set(c.x + Math.cos(a) * 0.9, c.y + 0.3 + Math.sin(t * 3 + i) * 0.4, c.z + Math.sin(a) * 0.9);
      s.material.opacity = vis * (0.6 + Math.sin(t * 6 + i) * 0.4);
      s.visible = !c.found && vis > 0.01;
    });
    if (this.beam) this.beam.material.color.setHSL((t * 0.15) % 1, 1, 0.7);
    if (this.lock) this.lock.position.y = c.y + 1.6 + Math.sin(t * 2) * 0.15;
    if (!c.found) {
      if (!this.clueHidden) c.model.rotation.y += dt * 1.5;
      if (this.clueString) c.model.rotation.z = Math.sin(t * 2) * 0.15;
      if (this.state === 'play' && canMove && d < 2.3) {
        if (this.D.stars && this.stars < this.D.stars) {
          this.toast(`The clue is locked! Find ${this.D.stars - this.stars} more gold star${this.D.stars - this.stars > 1 ? 's' : ''} in the surprise boxes.`, true, 5);
        } else {
          this.foundClue();
        }
      }
    } else if (this.foundT !== undefined) {
      this.foundT += dt;
      const k = Math.min(1, this.foundT / 0.8);
      c.model.scale.setScalar(Math.max(0.001, k * 1.4));
      c.model.position.set(
        c.x + (L.pos.x - c.x) * k * 0.5,
        c.y + k * 2.8 + Math.sin(t * 3) * 0.1,
        c.z + (L.pos.z - c.z) * k * 0.5,
      );
      c.model.rotation.y += dt * 3;
      c.model.rotation.z = 0;
    }
  }

  foundClue() {
    const c = this.clue;
    c.found = true;
    this.foundT = 0;
    this.state = 'found';
    this.arrow.visible = false;
    if (this.clueString) this.root.remove(this.clueString);
    if (this.beam) this.root.remove(this.beam);
    sfx('clue');
    this.fx.burst(new THREE.Vector3(c.x, c.y + 1, c.z), { n: 40, speed: 6, up: 8, life: 1.4, confetti: true });
    for (const f of this.family) { f.state.celebrate = true; f.vel.set(0, 0, 0); }
    this.target = null;
    // face the camera for the celebration
    for (const f of this.family) f.facing = 0;
    const msg = `You found it! ${capital(this.city.clue.name)} ${this.city.clue.where}!`;
    this.toast(msg, true);
    for (const g of this.gummies) { this.fx.burst(g.pos.clone().setY(0.6), { n: 12, colors: ['#ffffff', '#57e36b'] }); this.root.remove(g.group); }
    this.gummies = [];
    setTimeout(() => {
      for (const f of this.family) f.state.celebrate = false;
      if (this.city.finale) this.startChase();
      else {
        this.state = 'done';
        this.onComplete && this.onComplete(this.stats());
      }
    }, 3200);
  }

  stats() {
    const ratio = this.totalCandies ? this.candyCount / this.totalCandies : 1;
    const stars = 1 + (ratio >= 0.5 ? 1 : 0) + (ratio >= 0.9 ? 1 : 0);
    return { candies: this.candyCount, total: this.totalCandies, stars };
  }

  // ------------------------------------------------------------
  //  Finale: catch the Candy Monster!
  // ------------------------------------------------------------
  startChase() {
    const m = this.monster;
    const L = this.leader;
    this.root.remove(this.clue.model);
    const p = this.farSpot(10) || { x: L.pos.x, z: L.pos.z - 9 };
    m.pos.set(p.x, 0, p.z);
    m.group.position.copy(m.pos);
    m.group.visible = true;
    m.group.scale.setScalar(0.85);
    this.fx.burst(m.pos.clone().setY(1.5), { n: 40, speed: 6, up: 6, life: 1.2 });
    sfx('monster');
    this.state = 'chase';
    this.tagsNeeded = this.D.tags;
    this.hud.setObjective('🟣 Catch the Candy Monster!');
    if (this.D.id === 'easy') this.toast('Look! It\'s the Candy Monster! Walk over and give him a hug!', true);
    else this.toast(`It's the Candy Monster! Catch him ${this.tagsNeeded} times!`, true);
  }

  farSpot(minD) {
    const L = this.leader;
    const S = this.city.S;
    for (let i = 0; i < 300; i++) {
      const x = (Math.random() * 2 - 1) * (S - 4), z = (Math.random() * 2 - 1) * (S - 4);
      if (!this.W.free(x, z, 1.4)) continue;
      if (Math.hypot(x - L.pos.x, z - L.pos.z) < minD) continue;
      return { x, z };
    }
    return null;
  }

  updateChase(dt, t) {
    const m = this.monster;
    const L = this.leader;
    const dx = m.pos.x - L.pos.x, dz = m.pos.z - L.pos.z;
    const d = Math.hypot(dx, dz) || 0.001;
    let vx = 0, vz = 0, s = 0;
    if (this.D.id === 'easy') {
      if (d > 3) { vx = -dx / d; vz = -dz / d; s = 1.6; }
    } else if (d < 9) {
      vx = dx / d; vz = dz / d;
      // steer away from walls
      const S = this.city.S - 4;
      if (m.pos.x > S) vx -= (m.pos.x - S);
      if (m.pos.x < -S) vx += (-S - m.pos.x);
      if (m.pos.z > S) vz -= (m.pos.z - S);
      if (m.pos.z < -S) vz += (-S - m.pos.z);
      const wob = Math.sin(t * 1.7) * 0.6;
      const px = -vz * wob, pz = vx * wob;
      vx += px; vz += pz;
      const n = Math.hypot(vx, vz) || 1; vx /= n; vz /= n;
      s = this.D.monsterSpeed;
    } else {
      vx = Math.sin(t * 0.7); vz = Math.cos(t * 0.5); s = 1.0;
    }
    m.pos.x += vx * s * dt; m.pos.z += vz * s * dt;
    const hit = resolveCollisions(m.pos, 1.0, this.W.colliders, this.city.S);
    if (hit && d < 6 && this.D.id !== 'easy') {
      // cornered: hop sideways
      m.pos.x += -vz * 2 * dt * s; m.pos.z += vx * 2 * dt * s;
    }
    m.state.speed = s;
    m.group.position.copy(m.pos);
    m.group.rotation.y = angleDamp(m.group.rotation.y, this.D.id === 'easy' ? Math.atan2(-dx, -dz) : Math.atan2(vx, vz), 8, dt);
    if (d < 2.2) {
      this.tags++;
      sfx('tag');
      this.fx.burst(m.pos.clone().setY(1.5), { n: 30, speed: 6, up: 6, life: 1.0 });
      const left = this.tagsNeeded - this.tags;
      if (left <= 0) {
        this.state = 'done';
        m.state.speed = 0;
        m.state.sad = true;
        m.group.rotation.y = Math.atan2(-dx, -dz);
        for (const f of this.family) { f.vel.set(0, 0, 0); f.state.speed = 0; }
        this.toast('You caught the Candy Monster!', true);
        setTimeout(() => this.onFinale && this.onFinale(), 1400);
      } else {
        const p = this.farSpot(12);
        if (p) m.pos.set(p.x, 0, p.z);
        this.fx.burst(m.pos.clone().setY(1.5), { n: 30, speed: 5, up: 6, life: 1.0, colors: ['#b46cff', '#ffffff'] });
        this.toast(`Got him! Hee hee, catch me if you can! ${left} more!`, true);
      }
    }
  }

  // For cutscenes: line everybody up facing the camera
  lineUp() {
    const m = this.monster;
    const cx = this.clue.x, cz = this.clue.z + 3.2;
    // clear the stage
    for (const g of this.gumballs) g.ball.visible = false;
    this.gumballs = [];
    for (const c of this.candies) if (c.alive && Math.hypot(c.x - cx, c.z - cz) < 7) { c.alive = false; this.root.remove(c.m); }
    for (const b of this.boxes) if (Math.hypot(b.x - cx, b.z - cz) < 8) b.g.visible = false;
    for (const p of this.pads) if (Math.hypot(p.x - cx, p.z - cz) < 8) p.g.visible = false;
    this.family.forEach((f, i) => {
      f.pos.set(cx - 2.4 + i * 1.3, 0, cz + 0.5);
      f.facing = 0.0;
      f.vel.set(0, 0, 0);
    });
    if (m) {
      m.pos.set(cx + 3.2, 0, cz - 1.2);
      m.group.position.copy(m.pos);
      m.group.rotation.y = -0.5;
    }
    this.camFocus = new THREE.Vector3(cx + 0.6, 0, cz);
    this.camOffset = new THREE.Vector3(0, 3.4, 9.5);
    this.state = 'cutscene';
    this.arrow.visible = false;
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    });
  }
}

function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

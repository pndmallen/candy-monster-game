import * as THREE from 'three';
import { mat, basic, mesh, outline, stripeTex, windowsTex, clockTex, textTex, swirlTex, starShape, heartShape, bakeGroup } from './lib.js';
import {
  makeGround, candyFence, tree, blossom, pine, palm, lamp, bench, flowers, bush, rock, cloud,
  building, car, billboard, waterMat, giantLolly, dyn,
} from './world.js';
import { makeLollipop } from './characters.js';

// ============================================================
//  Every stop in the game. New York is HOME (Mr. Sugar's shop is
//  there): each adventure starts in New York, visits the other cities
//  in a random order, and ends back in New York to catch the monster.
// ============================================================
const NY = { lat: 40.76, lon: -73.99 };
export const HOME = { id: 'newyork', name: 'New York', flag: '🇺🇸', ...NY };

export const LEVELS = {
  newyork: {
    id: 'newyork', name: 'New York', flag: '🇺🇸', ...NY, S: 22, music: 1,
    sky: ['#86b8ec', '#ffe6cf'], weather: null,
    intro: "This is home: New York City! The Candy Monster emptied Mr. Sugar's shop, but he dropped a clue in Times Square!",
    clue: { name: 'a blue lollipop', emoji: '🔵', model: 'blue', where: 'behind the blue lollipop sign in Times Square' },
    riddle: 'Look behind the big sign with a BLUE lollipop on it!',
    build: (W) => buildNewYork(W, false),
  },
  london: {
    id: 'london', name: 'London', flag: '🇬🇧', lat: 51.5, lon: -0.12, S: 22, music: 0,
    sky: ['#8fc3f0', '#e6f2ff'], weather: null,
    intro: 'Welcome to London! The Candy Monster was here!',
    clue: { name: 'a lollipop wrapper', emoji: '🍬', model: 'wrapper', where: 'tucked behind Big Ben' },
    riddle: 'Look behind the tall clock tower that goes DONG, DONG!',
    build: buildLondon,
  },
  tokyo: {
    id: 'tokyo', name: 'Tokyo', flag: '🇯🇵', lat: 35.68, lon: 139.69, S: 22, music: 1,
    sky: ['#9fd0ff', '#ffe9f3'], weather: 'petals',
    intro: 'Welcome to Tokyo! Look at the pretty cherry blossoms!',
    clue: { name: 'a red envelope', emoji: '🧧', model: 'envelope', where: 'near the shrine' },
    riddle: 'Look near the big red shrine with the swoopy roof!',
    build: buildTokyo,
  },
  moscow: {
    id: 'moscow', name: 'Moscow', flag: '🇷🇺', lat: 55.75, lon: 37.62, S: 22, music: 2,
    sky: ['#b7cbe0', '#f4f8fc'], weather: 'snow',
    intro: 'Brrr! Welcome to snowy Moscow!',
    clue: { name: 'a candy cane', emoji: '🍭', model: 'cane', where: "on the door of Saint Basil's Cathedral" },
    riddle: 'Check the door of the church with the colorful swirly domes!',
    build: buildMoscow,
  },
  dubai: {
    id: 'dubai', name: 'Dubai', flag: '🇦🇪', lat: 25.2, lon: 55.27, S: 22, music: 0,
    sky: ['#7fc4f5', '#fff1d6'], weather: null,
    intro: 'Welcome to sunny Dubai! Look how tall that building is!',
    clue: { name: 'a golden clue', emoji: '🏅', model: 'golden', where: 'hanging from a palm tree' },
    riddle: 'Look up! A palm tree with something shiny on it!',
    build: buildDubai,
  },
  venice: {
    id: 'venice', name: 'Venice', flag: '🇮🇹', lat: 45.44, lon: 12.33, S: 22, music: 2,
    sky: ['#8ccaf5', '#fff0dc'], weather: null,
    intro: 'Welcome to Venice! The streets here are made of water!',
    clue: { name: 'a lollipop wrapped in gold', emoji: '✨', model: 'gold', where: 'inside a gondola boat' },
    riddle: 'Look inside a little black boat called a gondola!',
    build: buildVenice,
  },
  rio: {
    id: 'rio', name: 'Rio de Janeiro', flag: '🇧🇷', lat: -22.95, lon: -43.21, S: 22, music: 0,
    sky: ['#6fc0f5', '#fff4d6'], weather: null,
    intro: 'Welcome to Rio de Janeiro! Look at the beach and the giant statue!',
    clue: { name: 'a big glowing lollipop', emoji: '🍭', model: 'glow', where: 'under the giant statue' },
    riddle: 'Look under the giant statue with its arms open wide!',
    build: buildRio,
  },
  hcmc: {
    id: 'hcmc', name: 'Ho Chi Minh City', flag: '🇻🇳', lat: 10.78, lon: 106.7, S: 22, music: 1,
    sky: ['#7fc6f2', '#fff0d0'], weather: null,
    intro: 'Xin chào! Welcome to Ho Chi Minh City! Beep beep, so many scooters!',
    clue: { name: 'a red lantern full of candy', emoji: '🏮', model: 'lantern', where: 'hanging by Ben Thanh Market' },
    riddle: 'Look by the big yellow market with the clock tower, where a red lantern hangs!',
    build: buildHCMC,
  },
  finale: {
    id: 'finale', name: 'New York', flag: '🇺🇸', ...NY, S: 22, music: 2,
    sky: ['#f7a98b', '#ffe3c4'], weather: null,
    intro: 'Back home in New York! The Candy Monster is hiding somewhere nearby!',
    clue: { name: "the Candy Monster's candy sack", emoji: '🎒', model: 'sack', where: 'behind the hot dog cart' },
    riddle: 'Sniff sniff! Something smells sweet behind the hot dog cart!',
    build: (W) => buildNewYork(W, true),
    finale: true,
  },
};

// The cities that get shuffled between the first and last New York stops
export const MIDDLE = ['london', 'tokyo', 'moscow', 'dubai', 'venice', 'rio', 'hcmc'];
// Pins on the globe (New York is the home pin)
export const GLOBE_CITIES = ['newyork', ...MIDDLE];

export function makeRoute() {
  const mid = [...MIDDLE];
  for (let i = mid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mid[i], mid[j]] = [mid[j], mid[i]];
  }
  return ['newyork', ...mid, 'finale'];
}
export function isValidRoute(r) {
  return Array.isArray(r) && r.length === MIDDLE.length + 2 && r[0] === 'newyork' && r[r.length - 1] === 'finale'
    && MIDDLE.every((id) => r.includes(id));
}

// ============================================================
//  Clue models
// ============================================================
export function makeClueModel(kind) {
  const g = new THREE.Group();
  if (kind === 'wrapper') {
    const b = mesh(new THREE.SphereGeometry(0.35, 16, 12), mat('#ff5fa2')); b.scale.set(1.4, 0.8, 0.6); g.add(b);
    for (const s of [-1, 1]) {
      const c = mesh(new THREE.ConeGeometry(0.3, 0.45, 12), mat('#ffd23f'));
      c.rotation.z = s * Math.PI / 2; c.position.x = s * 0.62; g.add(c);
    }
  } else if (kind === 'envelope') {
    const e = mesh(new THREE.BoxGeometry(0.9, 0.6, 0.08), mat('#e0242e')); g.add(e);
    const f = mesh(new THREE.ConeGeometry(0.48, 0.35, 4), mat('#c81c26')); f.rotation.set(Math.PI / 2, Math.PI / 4, 0); f.scale.set(1.3, 1, 0.12); f.position.set(0, 0.13, 0.05); g.add(f);
    const s = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), mat('#ffd23f')); s.rotation.x = Math.PI / 2; s.position.z = 0.07; g.add(s);
  } else if (kind === 'cane') {
    const m = mat('#ffffff', { map: stripeTex('#ffffff', '#e8203a', 5, true) });
    const st = mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 10), m); st.position.y = -0.25; g.add(st);
    const hook = mesh(new THREE.TorusGeometry(0.22, 0.08, 8, 16, Math.PI), m); hook.position.set(-0.22, 0.3, 0); g.add(hook);
  } else if (kind === 'golden') {
    const d = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 24), mat('#ffcf3a')); d.rotation.x = Math.PI / 2; g.add(d);
    const st = mesh(new THREE.ExtrudeGeometry(starShape(0.25, 0.11), { depth: 0.05, bevelEnabled: false }), mat('#fff3a8')); st.position.z = 0.03; g.add(st);
    const ring = mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), mat('#ffcf3a')); ring.position.y = 0.48; g.add(ring);
  } else if (kind === 'blue') {
    g.add(makeLollipop(0.45, '#2f8cff'));
  } else if (kind === 'gold') {
    const l = new THREE.Group();
    const st = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), mat('#ffffff')); st.position.y = -0.6; l.add(st);
    const b = mesh(new THREE.IcosahedronGeometry(0.38, 1), new THREE.MeshStandardMaterial({ color: '#ffcf3a', metalness: 0.9, roughness: 0.25, flatShading: true })); l.add(b);
    const tw = mesh(new THREE.ConeGeometry(0.15, 0.25, 8), mat('#ffcf3a')); tw.position.y = -0.4; tw.rotation.x = Math.PI; l.add(tw);
    g.add(l);
  } else if (kind === 'lantern') {
    const body = mesh(new THREE.SphereGeometry(0.42, 16, 12), mat('#e8202e')); body.scale.set(1, 1.15, 1); g.add(body);
    for (let i = 0; i < 6; i++) {
      const rib = mesh(new THREE.TorusGeometry(0.42, 0.018, 4, 20), mat('#b3121d'));
      rib.rotation.y = (i / 6) * Math.PI; rib.scale.set(1, 1.15, 1); g.add(rib);
    }
    for (const y of [0.46, -0.46]) { const cap = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 14), mat('#ffcf3a')); cap.position.y = y; g.add(cap); }
    const tassel = mesh(new THREE.ConeGeometry(0.08, 0.35, 8), mat('#ffcf3a')); tassel.position.y = -0.68; tassel.rotation.x = Math.PI; g.add(tassel);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ color: '#ffd68a', transparent: true, opacity: 0.35, depthWrite: false }));
    glow.position.z = -0.3; g.add(glow);
  } else if (kind === 'sack') {
    const s = mesh(new THREE.SphereGeometry(0.55, 16, 12), mat('#b5824a')); s.scale.set(1, 1.1, 0.9); g.add(s);
    const knot = mesh(new THREE.ConeGeometry(0.18, 0.3, 8), mat('#9a6a38')); knot.position.y = 0.68; g.add(knot);
    const cols = ['#ff4f9a', '#2f8cff', '#ffd23f'];
    for (let i = 0; i < 3; i++) {
      const l = makeLollipop(0.14, cols[i]); l.position.set(-0.2 + i * 0.2, 0.9, 0.05); l.rotation.z = -0.4 + i * 0.4; g.add(l);
    }
  } else if (kind === 'glow') {
    const l = makeLollipop(0.75, '#ff4f9a');
    g.add(l);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ color: '#fff6a8', transparent: true, opacity: 0.45, depthWrite: false }));
    halo.position.z = -0.2;
    g.add(halo);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ============================================================
//  City builders. Each returns { spawn, clue:{x,z,y}, update? }
// ============================================================
function edgeClouds(W) {
  for (let i = 0; i < 7; i++) cloud(W, -60 + i * 20, 18 + (i % 3) * 4, -45 - (i % 2) * 15, 1.4 + (i % 3) * 0.4);
}

function phoneBox(W, x, z, rotY = 0) {
  const tex = windowsTex('#d61f2b', '#bfe6ff', '#bfe6ff', 3, 5);
  W.box(1.1, 2.4, 1.1, '#d61f2b', x, 0, z, { map: tex, rotY, edge: true });
  W.box(1.3, 0.3, 1.3, '#c01a25', x, 2.4, z, { collide: false });
}

function buildLondon(W) {
  makeGround(W, { color: '#cfc9bd', spec: '#aaa295', kind: 'cobble', far: '#86b86a' });
  candyFence(W);
  // lawns
  for (const [x, z, w, d] of [[-14, 6, 10, 10], [14, 8, 10, 12]]) {
    const g = mesh(new THREE.PlaneGeometry(w, d), mat('#86c96a'), { shadow: false });
    g.rotation.x = -Math.PI / 2; g.position.set(x, 0.01, z); g.receiveShadow = true; W.root.add(g);
  }
  // --- Big Ben ---
  const bx = -7, bz = -11;
  W.box(3.4, 11, 3.4, '#d8b877', bx, 0, bz, { map: windowsTex('#d8b877', '#b08a47', '#b08a47', 3, 10), edge: true });
  W.box(4, 3.6, 4, '#c9a86b', bx, 11, bz, { collide: false, edge: true });
  const face = mat('#ffffff', { map: clockTex() });
  for (let i = 0; i < 4; i++) {
    const p = mesh(new THREE.PlaneGeometry(3, 3), face, { shadow: false });
    const a = (i * Math.PI) / 2;
    p.position.set(bx + Math.sin(a) * 2.01, 12.8, bz + Math.cos(a) * 2.01);
    p.rotation.y = a;
    W.root.add(p);
  }
  W.box(3.4, 1.4, 3.4, '#b99656', bx, 14.6, bz, { collide: false });
  const sp = W.cone(2.6, 5.5, '#3d4a57', bx, 16, bz, { seg: 4 });
  sp.rotation.y = Math.PI / 4;
  W.sphere(0.3, '#ffcf3a', bx, 21.6, bz);
  // --- Houses of Parliament ---
  building(W, 8, -14, 16, 4, 5, '#d8b877', { win: windowsTex('#d8b877', '#a48448', '#a48448', 14, 3), roof: '#5a6878' });
  for (let i = 0; i < 6; i++) W.cone(0.5, 1.6, '#5a6878', 1 + i * 2.8, 5, -12.2, { seg: 4 });
  W.box(2.4, 8, 2.4, '#d8b877', 15, 0, -14, { map: windowsTex('#d8b877', '#a48448', '#a48448', 2, 6) });
  W.cone(1.6, 2.5, '#5a6878', 15, 8, -14, { seg: 4 });
  // --- Red bus ---
  const bus = new THREE.Group();
  const bt = windowsTex('#d61f2b', '#cfeeff', '#cfeeff', 6, 3);
  const bm = mesh(new THREE.BoxGeometry(2.4, 3.6, 7), [mat('#fff', { map: bt }), mat('#fff', { map: bt }), mat('#c01a25'), mat('#c01a25'), mat('#d61f2b'), mat('#d61f2b')]);
  bm.position.y = 2.2; outline(bm, 0.015); bus.add(bm);
  for (const [wx, wz] of [[-1.2, 2.3], [1.2, 2.3], [-1.2, -2.3], [1.2, -2.3]]) {
    const wh = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14), mat('#222')); wh.rotation.z = Math.PI / 2; wh.position.set(wx, 0.5, wz); bus.add(wh);
  }
  W.add(bus, 11, 0, 0, Math.PI / 2);
  W.colBox(11, 0, 7, 2.4);
  // phone boxes, lamps, trees, benches
  phoneBox(W, -2, -4); phoneBox(W, -0.6, -4); phoneBox(W, 5, 10);
  for (const [x, z] of [[-4, 4], [4, 4], [-4, 12], [4, 12], [-12, -4], [4, -8]]) lamp(W, x, z, '#2d3340');
  for (const [x, z] of [[-17, 3], [-12, 9], [-16, 10], [16, 4], [12, 13], [17, 12], [-18, -17], [-15, 16]]) tree(W, x, z, 1.1);
  bench(W, -13, 3, 0); bench(W, 14, 4.5, Math.PI);
  flowers(W, -9, 12); flowers(W, 9, 16);
  // Queen's guards
  for (const gx of [2, 5]) {
    const g = new THREE.Group();
    const legs = mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.7, 10), mat('#1e2230')); legs.position.y = 0.35; g.add(legs);
    const body = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), mat('#d61f2b')); body.position.y = 1.1; outline(body, 0.05); g.add(body);
    const head = mesh(new THREE.SphereGeometry(0.25, 12, 10), mat('#f0c4a0')); head.position.y = 1.7; g.add(head);
    const hat = mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.8, 12), mat('#15161b')); hat.position.y = 2.15; g.add(hat);
    W.add(g, gx, 0, -10.5);
    W.colCircle(gx, -10.5, 0.4);
  }
  // London Eye in the distance
  const eye = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(11, 0.25, 8, 48), mat('#f2f4f7')); eye.add(ring);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const spk = mesh(new THREE.CylinderGeometry(0.06, 0.06, 11, 4), mat('#dfe3ea')); spk.rotation.z = a; spk.position.set(Math.cos(a + Math.PI / 2) * 5.5, Math.sin(a + Math.PI / 2) * 5.5, 0); eye.add(spk);
    const pod = mesh(new THREE.SphereGeometry(0.5, 10, 8), mat('#bfe6ff')); pod.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0); eye.add(pod);
  }
  W.add(eye, 26, 13, -38, -0.5);
  dyn(eye);
  W.animated.push((dt) => { eye.rotation.z += dt * 0.05; });
  W.cyl(0.4, 0.6, 13, '#dfe3ea', 26, 0, -38, { collide: false });
  // river
  const river = mesh(new THREE.PlaneGeometry(200, 14), waterMat('#5aa7d6'), { shadow: false });
  river.rotation.x = -Math.PI / 2; river.position.set(0, 0.02, -32); W.root.add(river);
  edgeClouds(W);
  return { spawn: { x: 0, z: 17 }, clue: { x: bx, z: bz - 3.2, y: 0.6 } };
}

function buildTokyo(W) {
  makeGround(W, { color: '#ece1cb', spec: '#c9b99a', far: '#8fd07a' });
  candyFence(W, '#ff6fb5');
  // shrine
  W.box(11, 0.8, 7, '#7a4a2e', 0, 0, -14, { edge: true });
  W.box(9, 3.2, 5, '#d9412b', 0, 0.8, -14.3, { collide: false, edge: true });
  W.box(2, 2.2, 0.1, '#3a2418', 0, 0.8, -11.75, { collide: false });
  const roof = mesh(new THREE.ConeGeometry(7.4, 2.8, 4), mat('#3b4450'));
  roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.72); roof.position.set(0, 5.4, -14.3); outline(roof, 0.02); W.root.add(roof);
  W.box(1.6, 0.4, 1.4, '#9a6a45', 0, 0, -9.9, { collide: false });
  for (const x of [-3.8, 3.8]) W.cyl(0.25, 0.25, 3.2, '#b8321f', x, 0.8, -11.9, { collide: false, seg: 10 });
  // bell rope + offering box
  W.box(1.4, 0.8, 0.8, '#6a3f25', 0, 0.8, -11.1, { collide: false });
  // torii gates
  for (const tz of [-4, 6]) {
    for (const x of [-2.4, 2.4]) W.cyl(0.3, 0.34, 5, '#e2412b', x, 0, tz, { seg: 12 });
    W.box(6.8, 0.45, 0.7, '#1f1f24', 0, 5, tz, { collide: false });
    W.box(6.2, 0.3, 0.5, '#e2412b', 0, 4.6, tz, { collide: false });
    W.box(5.4, 0.3, 0.35, '#e2412b', 0, 3.9, tz, { collide: false });
  }
  // pagoda
  for (let i = 0; i < 4; i++) {
    const s = 3.6 - i * 0.6, y = i * 1.8;
    W.box(s, 1.3, s, i % 2 ? '#f4efe6' : '#d9412b', -13, y, -11, { collide: i === 0 });
    const r = W.cone(s * 0.95, 0.7, '#3b4450', -13, y + 1.3, -11, { seg: 4 });
    r.rotation.y = Math.PI / 4;
  }
  W.cyl(0.08, 0.08, 2, '#ffcf3a', -13, 7.6, -11, { collide: false });
  // stone lanterns
  for (const [x, z] of [[-3.5, -8], [3.5, -8], [-3.5, 1], [3.5, 1]]) {
    W.cyl(0.25, 0.35, 1, '#b9b6ad', x, 0, z, { seg: 8 });
    W.box(0.8, 0.6, 0.8, '#dcd8cc', x, 1, z, { collide: false });
    W.sphere(0.18, '#fff3b0', x, 1.3, z, { material: basic('#fff3b0') });
    W.cone(0.7, 0.5, '#9e9b93', x, 1.6, z, { seg: 4 });
  }
  // koi pond
  const pond = mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.08, 32), waterMat('#58b9e8'), { shadow: false });
  pond.position.set(11, 0.04, 3); W.root.add(pond); W.colCircle(11, 3, 3.1);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; rock(W, 11 + Math.cos(a) * 3.4, 3 + Math.sin(a) * 3.4, 0.4); }
  const kois = [];
  for (let i = 0; i < 3; i++) {
    const k = mesh(new THREE.SphereGeometry(0.25, 10, 8), mat(i === 1 ? '#ffffff' : '#ff7a2f')); k.scale.set(0.6, 0.4, 1.4); W.root.add(dyn(k)); kois.push(k);
  }
  W.animated.push((dt, t) => kois.forEach((k, i) => {
    const a = t * (0.5 + i * 0.15) + i * 2;
    k.position.set(11 + Math.cos(a) * (1.2 + i * 0.5), 0.1, 3 + Math.sin(a) * (1.2 + i * 0.5));
    k.rotation.y = -a;
  }));
  for (const [x, z] of [[-9, 2], [-14, 8], [-17, -2], [9, -6], [15, -10], [16, 12], [-10, 14], [10, 14], [-18, 15], [17, -17], [-6, -19]]) blossom(W, x, z, 1.1);
  // Mt Fuji
  W.cone(48, 30, '#7c95bd', 10, -1, -95, { seg: 24 });
  W.cone(16.3, 10.3, '#ffffff', 10, 19, -95, { seg: 24 });
  edgeClouds(W);
  return { spawn: { x: 0, z: 17 }, clue: { x: 7, z: -10, y: 0.5 } };
}

function onionTower(W, x, z, h, stripeA, stripeB, bodyColor) {
  W.cyl(0.95, 1.0, h, bodyColor, x, 3, z, { collide: false, seg: 12 });
  const onion = mesh(new THREE.SphereGeometry(1.2, 18, 14), mat('#ffffff', { map: stripeTex(stripeA, stripeB, 6, true) }));
  onion.scale.set(1, 1.2, 1);
  onion.position.set(x, 3 + h + 1.0, z);
  outline(onion, 0.03);
  W.root.add(onion);
  W.cone(0.55, 1.3, stripeB, x, 3 + h + 1.9, z, { seg: 12 });
  W.sphere(0.15, '#ffcf3a', x, 3 + h + 3.3, z);
}
function snowman(W, x, z) {
  W.sphere(0.8, '#ffffff', x, 0.7, z);
  W.sphere(0.58, '#ffffff', x, 1.75, z);
  W.sphere(0.42, '#ffffff', x, 2.55, z);
  const n = W.cone(0.08, 0.45, '#ff8a2a', x, 0, z + 0.5);
  n.rotation.x = Math.PI / 2; n.position.set(x, 2.55, z + 0.55);
  for (const s of [-1, 1]) W.sphere(0.06, '#111', x + s * 0.15, 2.68, z + 0.37);
  const sc = mesh(new THREE.TorusGeometry(0.45, 0.1, 6, 16), mat('#e8203a')); sc.rotation.x = Math.PI / 2; sc.position.set(x, 2.2, z); W.root.add(sc);
  W.cyl(0.3, 0.3, 0.45, '#222', x, 2.85, z, { collide: false });
  W.colCircle(x, z, 0.8);
}
function buildMoscow(W) {
  makeGround(W, { color: '#f4f8fc', spec: '#c9ddee', far: '#eef4fa' });
  candyFence(W, '#2f8cff');
  const cx = 0, cz = -14;
  W.box(10, 3, 7, '#b8452f', cx, 0, cz, { map: windowsTex('#b8452f', '#e9d6b0', '#e9d6b0', 7, 2), edge: true });
  // central tent tower
  W.cyl(1.6, 1.8, 7, '#c9553a', cx, 3, cz, { collide: false, seg: 8, map: stripeTex('#c9553a', '#e9d6b0', 10, false) });
  W.cone(1.9, 5, '#3fae6a', cx, 10, cz, { seg: 8 });
  W.sphere(0.5, '#ffcf3a', cx, 15.3, cz);
  onionTower(W, cx - 3.3, cz + 2, 2.8, '#ffffff', '#e2412b', '#d9d2c3');
  onionTower(W, cx + 3.3, cz + 2, 2.8, '#3fae6a', '#ffd23f', '#c9553a');
  onionTower(W, cx - 3.3, cz - 2, 3.4, '#2f8cff', '#ffffff', '#c9553a');
  onionTower(W, cx + 3.3, cz - 2, 3.4, '#ffd23f', '#3fae6a', '#d9d2c3');
  // door
  W.box(1.6, 2.2, 0.12, '#5a3420', cx, 0, cz + 3.52, { collide: false });
  const arch = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 16, 1, false, 0, Math.PI), mat('#5a3420'));
  arch.rotation.set(Math.PI / 2, 0, Math.PI / 2); arch.position.set(cx, 2.2, cz + 3.52); W.root.add(arch);
  W.box(2.6, 0.3, 1.2, '#d9d2c3', cx, 0, cz + 4.1, { collide: false });
  // Kremlin wall + tower in the distance
  W.box(70, 6, 2, '#b5402f', 0, 0, -32, { collide: false });
  for (let i = -34; i <= 34; i += 2) W.box(0.9, 0.9, 2, '#b5402f', i, 6, -32, { collide: false });
  W.box(4.5, 15, 4.5, '#b5402f', 14, 0, -31, { collide: false, map: windowsTex('#b5402f', '#e9d6b0', '#e9d6b0', 2, 6) });
  W.cone(3, 6, '#3fae6a', 14, 15, -31, { seg: 8 });
  const star = mesh(new THREE.ExtrudeGeometry(starShape(1, 0.45), { depth: 0.2, bevelEnabled: false }), basic('#ff2a3a'));
  star.position.set(14, 22.2, -31); W.root.add(star);
  // snowmen, snowy pines, lamps
  snowman(W, -8, 4); snowman(W, 9, 8); snowman(W, -14, -6);
  for (const [x, z] of [[-17, -14], [-12, 12], [-18, 4], [15, -8], [17, 3], [13, 15], [-6, -20], [7, -20], [18, -18]]) pine(W, x, z, 1.2, true);
  for (const [x, z] of [[-4, 6], [4, 6], [-4, -3], [4, -3]]) lamp(W, x, z, '#2d3340');
  bench(W, 10, -2, -Math.PI / 2, '#5a3420');
  // frozen pond
  const ice = mesh(new THREE.CylinderGeometry(3, 3, 0.05, 32), mat('#cdeaff'), { shadow: false });
  ice.position.set(-10, 0.03, 12); W.root.add(ice);
  edgeClouds(W);
  return { spawn: { x: 0, z: 17 }, clue: { x: cx + 0.9, z: cz + 3.75, y: 1.4 } };
}

function camel(W, x, z, rotY = 0) {
  const g = new THREE.Group();
  const c = '#c99a5b';
  const body = mesh(new THREE.SphereGeometry(0.9, 14, 10), mat(c)); body.scale.set(0.8, 0.7, 1.3); body.position.y = 1.9; outline(body, 0.03); g.add(body);
  const hump = mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(c)); hump.position.set(0, 2.5, 0); g.add(hump);
  const neck = mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.3, 8), mat(c)); neck.position.set(0, 2.6, 1.2); neck.rotation.x = 0.5; g.add(neck);
  const head = mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(c)); head.scale.set(0.8, 0.8, 1.4); head.position.set(0, 3.2, 1.6); g.add(head);
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.06, 6, 6), basic('#222')); e.position.set(s * 0.18, 3.3, 1.75); g.add(e);
  }
  for (const [lx, lz] of [[-0.35, 0.7], [0.35, 0.7], [-0.35, -0.7], [0.35, -0.7]]) {
    const l = mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.6, 6), mat(c)); l.position.set(lx, 0.8, lz); g.add(l);
  }
  const blanket = mesh(new THREE.BoxGeometry(1.5, 0.1, 1.2), mat('#e2412b')); blanket.position.y = 2.35; g.add(blanket);
  W.add(g, x, 0, z, rotY);
  W.colCircle(x, z, 1.2);
}
function buildDubai(W) {
  makeGround(W, { color: '#f4dba6', spec: '#e2bf80', far: '#efcf8f' });
  candyFence(W, '#ffb23f');
  // Burj Khalifa
  const bx = 7, bz = -15;
  const radii = [3.4, 3.0, 2.6, 2.2, 1.8, 1.4, 1.0, 0.7];
  let y = 0;
  radii.forEach((r, i) => {
    const h = 5.5;
    W.cyl(r * 0.85, r, h, '#b9cfe2', bx + (i % 2) * 0.2, y, bz, { seg: 6, collide: i === 0, map: windowsTex('#a9c3db', '#e6f4ff', '#e6f4ff', 6, 4) });
    y += h;
  });
  W.cyl(0.1, 0.3, 9, '#dfe9f3', bx, y, bz, { collide: false, seg: 6 });
  // skyline
  for (const [x, z, w, h, c] of [[-18, -30, 6, 18, '#9fb8d0'], [-9, -34, 5, 26, '#c2d4e5'], [18, -30, 6, 22, '#a7c0d6'], [26, -26, 5, 14, '#8fb1cd']]) {
    building(W, x, z, w, w, h, c, { collide: false });
  }
  // fountain
  const fx = -6, fz = 0;
  const pool = mesh(new THREE.CylinderGeometry(4, 4, 0.3, 36), waterMat('#4fc3f7'), { shadow: false });
  pool.position.set(fx, 0.15, fz); W.root.add(pool);
  const rim = mesh(new THREE.TorusGeometry(4, 0.25, 8, 40), mat('#f3efe6')); rim.rotation.x = Math.PI / 2; rim.position.set(fx, 0.3, fz); W.root.add(rim);
  W.colCircle(fx, fz, 4.2);
  const jets = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const j = mesh(new THREE.CylinderGeometry(0.08, 0.18, 1, 8), new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.8 }), { shadow: false });
    j.position.set(fx + Math.cos(a) * 2.3, 0, fz + Math.sin(a) * 2.3);
    W.root.add(dyn(j)); jets.push(j);
  }
  const mid = mesh(new THREE.CylinderGeometry(0.1, 0.25, 1, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }), { shadow: false });
  mid.position.set(fx, 0, fz); W.root.add(dyn(mid)); jets.push(mid);
  W.animated.push((dt, t) => jets.forEach((j, i) => {
    const h = 1.5 + Math.abs(Math.sin(t * 1.5 + i)) * (i === jets.length - 1 ? 5 : 2.5);
    j.scale.y = h; j.position.y = h / 2;
  }));
  // palms (one of them holds the clue)
  for (const [x, z] of [[-16, -4], [-17, 8], [-10, 12], [12, 4], [16, 10], [10, 14], [-3, -10], [15, -5], [-18, -17], [2, 8]]) palm(W, x, z, 4 + W.rand() * 1.5);
  const cluePalm = palm(W, -12, -12, 4.2, 0.05);
  camel(W, 12, -4, -0.6); camel(W, -14, 3, 0.9);
  // dunes
  for (const [x, z, s] of [[-40, -45, 16], [0, -60, 22], [45, -40, 18], [-55, 0, 14], [55, 10, 16]]) {
    const d = mesh(new THREE.SphereGeometry(s, 20, 12), mat('#eec788'), { shadow: false }); d.scale.y = 0.3; d.position.set(x, -1, z); W.root.add(d);
  }
  edgeClouds(W);
  const top = cluePalm.userData.top;
  return { spawn: { x: 0, z: 17 }, clue: { x: -12, z: -11.1, y: 3.0, hang: top } };
}

function lollySignTex() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#fff7e0'; g.fillRect(0, 0, 512, 300);
  g.strokeStyle = '#ffcf3a'; g.lineWidth = 16; g.strokeRect(8, 8, 496, 284);
  g.fillStyle = '#ffffff'; g.fillRect(140, 150, 14, 120);
  const cx = 147, cy = 120;
  g.fillStyle = '#2f8cff'; g.beginPath(); g.arc(cx, cy, 80, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#bfe0ff'; g.lineWidth = 12; g.beginPath();
  for (let a = 0; a < Math.PI * 6; a += 0.1) { const r = a * 4; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.stroke();
  g.fillStyle = '#1b5fbf'; g.font = 'bold 64px Fredoka, sans-serif'; g.textAlign = 'center';
  g.fillText('LOLLI', 370, 130); g.fillText('POP!', 370, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function buildNewYork(W, finale = false) {
  makeGround(W, { color: '#bfc3c9', spec: '#a0a6ae', kind: 'tiles', far: '#8d939b' });
  candyFence(W, '#ffcf1f');
  // crosswalk stripes
  for (let i = 0; i < 8; i++) {
    const s = mesh(new THREE.PlaneGeometry(0.8, 5), mat('#ffffff'), { shadow: false });
    s.rotation.x = -Math.PI / 2; s.position.set(-6 + i * 1.6, 0.015, 3); W.root.add(s);
  }
  // buildings on three sides with bright billboards
  const cols = ['#8aa3c7', '#c7a38a', '#9fb3a0', '#b8a6c9', '#c9b38a', '#8fb8c9'];
  const signs = [['CANDY', '#ff4f9a', '#fff'], ['NYC', '#2f2f7a', '#ffd23f'], ['SWEET!', '#ffd23f', '#e2412b'], ['SHOW', '#e2412b', '#fff'], ['YUM', '#3fae6a', '#fff'], ['☆☆☆', '#7a3fd0', '#fff']];
  let k = 0;
  for (let x = -19; x <= 19; x += 6.4) {
    const h = 14 + ((k * 7) % 11);
    building(W, x, -26, 6, 6, h, cols[k % cols.length], { collide: false });
    const [txt, bg, fg] = signs[k % signs.length];
    billboard(W, x, 5 + (k % 3), -22.9, 5, 2.6, textTex(txt, { bg, fg }));
    k++;
  }
  for (const side of [-1, 1]) {
    for (let z = -18; z <= 14; z += 6.4) {
      const h = 12 + ((k * 5) % 10);
      building(W, side * 26, z, 6, 6, h, cols[k % cols.length], { collide: false });
      const [txt, bg, fg] = signs[k % signs.length];
      billboard(W, side * 22.9, 5 + (k % 2), z, 5, 2.6, textTex(txt, { bg, fg }), -side * Math.PI / 2);
      k++;
    }
  }
  // THE blue lollipop billboard
  const sx = 6, sz = -9;
  W.box(6.6, 0.9, 0.9, '#6b7380', sx, 0, sz, { edge: true });
  for (const px of [-2.6, 2.6]) W.cyl(0.18, 0.18, 3, '#4a5160', sx + px, 0.9, sz, { collide: false, seg: 8 });
  W.box(6.4, 3.8, 0.35, '#2a2f38', sx, 3.4, sz, { collide: false });
  billboard(W, sx, 5.3, sz + 0.2, 6, 3.4, lollySignTex());
  // taxis, hot dog cart, planters, hydrants
  car(W, -14, -8, 0, '#ffcf1f', true); car(W, -14, -2, 0, '#ffcf1f', true); car(W, -10.5, 10, Math.PI, '#ffcf1f', true); car(W, 14, 12, Math.PI / 2, '#ffcf1f', true);
  const cart = new THREE.Group();
  const cb = mesh(new THREE.BoxGeometry(2, 1, 1), mat('#e9eef5')); cb.position.y = 0.9; outline(cb, 0.03); cart.add(cb);
  const um = mesh(new THREE.ConeGeometry(1.4, 0.6, 8), mat('#ffffff', { map: stripeTex('#ffcf1f', '#2f8cff', 8, false) })); um.position.y = 2.8; cart.add(um);
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), mat('#555')); pole.position.y = 1.5; cart.add(pole);
  W.add(cart, -4, 0, -12); W.colBox(-4, -12, 2, 1);
  for (const [x, z] of [[-18, 6], [18, 0], [-18, -14], [16, -16], [0, -18], [10, 6]]) {
    W.box(1.6, 0.7, 1.6, '#8b6f55', x, 0, z);
    const l = W.sphere(0.9, '#5cc35a', x, 1.4, z, { seg: 10 }); outline(l, 0.03);
  }
  for (const [x, z] of [[-8, 12], [8, -4]]) { W.cyl(0.2, 0.25, 0.7, '#e2412b', x, 0, z, { seg: 8 }); W.sphere(0.2, '#e2412b', x, 0.75, z); }
  for (const [x, z] of [[-9, 0], [9, 0], [-9, 14], [9, 14]]) lamp(W, x, z, '#2d3340');
  // Statue of Liberty in the distance
  const lx = -32, lz = -60;
  W.box(6, 8, 6, '#b9ad96', lx, 0, lz, { collide: false });
  W.cone(2.2, 11, '#7fc4a8', lx, 8, lz, { seg: 12 });
  W.sphere(1.2, '#7fc4a8', lx, 20, lz);
  W.cyl(0.3, 0.3, 4, '#7fc4a8', lx + 1.2, 20, lz, { collide: false, seg: 6 });
  W.cone(0.5, 1, '#ffcf3a', lx + 1.2, 24, lz);
  for (let i = 0; i < 7; i++) { const s = W.cone(0.15, 1, '#7fc4a8', lx + Math.cos(i) * 0.6, 20.8, lz + Math.sin(i) * 0.6, { seg: 4 }); s.rotation.z = (i - 3) * 0.2; }
  edgeClouds(W);
  if (finale) return { spawn: { x: 0, z: 17 }, clue: { x: -4, z: -13.3, y: 0.6 } };
  return { spawn: { x: 0, z: 17 }, clue: { x: sx + 1.2, z: sz - 1.35, y: 0.8 } };
}

function gondola(color = '#15161b') {
  const g = new THREE.Group();
  const hull = mesh(new THREE.SphereGeometry(1, 16, 10), mat(color)); hull.scale.set(0.7, 0.35, 3.2); outline(hull, 0.02); g.add(hull);
  const seat = mesh(new THREE.BoxGeometry(1, 0.2, 1.2), mat('#b8323a')); seat.position.y = 0.3; g.add(seat);
  const prow = mesh(new THREE.BoxGeometry(0.1, 0.9, 0.5), mat('#e9e3d0')); prow.position.set(0, 0.6, 3); g.add(prow);
  bakeGroup(g);
  return g;
}
function buildVenice(W) {
  const S = W.S;
  makeGround(W, { color: '#e6d6b6', spec: '#cab48f', kind: 'tiles', far: '#4fb6f0' });
  candyFence(W, '#2f8cff');
  const wm = waterMat('#3fa9e0');
  const water = (x1, x2, z1, z2) => {
    const w = mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), wm, { shadow: false });
    w.rotation.x = -Math.PI / 2; w.position.set((x1 + x2) / 2, 0.03, (z1 + z2) / 2); W.root.add(w);
  };
  // canal A (east-west) with two bridges; canal B (north-south) with one bridge
  water(-S, S, -3, 1);
  water(11, 15, -S, -3);
  const blockA = [[-S, -10.6], [-7.4, 5.4], [8.6, 11], [15, S]];
  for (const [a, b] of blockA) W.colBox((a + b) / 2, -1, b - a, 4);
  W.colBox(13, -1, 4, 4);
  W.colBox(13, (-S - 13.6) / 2, 4, S - 13.6);
  W.colBox(13, (-10.4 - 3) / 2, 4, 7.4);
  const bridge = (x, z, alongX) => {
    const g = new THREE.Group();
    const deck = mesh(new THREE.BoxGeometry(3.2, 0.25, 4.8), mat('#efe3c8')); deck.position.y = 0.12; g.add(deck);
    for (const s of [-1, 1]) {
      const rail = mesh(new THREE.BoxGeometry(0.25, 0.8, 4.8), mat('#f7efdc')); rail.position.set(s * 1.55, 0.6, 0); outline(rail, 0.03); g.add(rail);
    }
    W.add(g, x, 0, z, alongX ? Math.PI / 2 : 0);
  };
  bridge(-9, -1, false); bridge(7, -1, false); bridge(13, -12, true);
  W.colBox(-10.55, -1, 0.2, 4); W.colBox(-7.45, -1, 0.2, 4);
  W.colBox(5.45, -1, 0.2, 4); W.colBox(8.55, -1, 0.2, 4);
  W.colBox(13, -13.55, 4, 0.2); W.colBox(13, -10.45, 4, 0.2);
  // striped mooring poles
  const poleM = mat('#ffffff', { map: stripeTex('#ffffff', '#2f5fd0', 5, true) });
  for (const [x, z] of [[-15, -2.6], [-3, 0.6], [3, -2.6], [17, 0.6], [11.4, -7], [14.6, -19]]) W.cyl(0.14, 0.14, 2.6, '#fff', x, 0, z, { material: poleM, collide: false });
  // moving gondolas
  const g1 = gondola(); g1.rotation.y = Math.PI / 2; W.root.add(dyn(g1));
  const g2 = gondola(); g2.rotation.y = Math.PI / 2; W.root.add(dyn(g2));
  W.animated.push((dt, t) => {
    g1.position.set(((t * 1.6) % 50) - 25, 0.15 + Math.sin(t * 2) * 0.04, -1.8);
    g2.position.set(25 - ((t * 1.2 + 20) % 50), 0.15 + Math.sin(t * 2 + 1) * 0.04, 0);
  });
  // docked gondola with the clue
  const dock = gondola('#1b1b22');
  dock.position.set(12.4, 0.15, -17);
  W.root.add(dyn(dock));
  W.animated.push((dt, t) => { dock.position.y = 0.15 + Math.sin(t * 1.7) * 0.05; dock.rotation.z = Math.sin(t * 1.3) * 0.03; });
  // pastel buildings
  const pastel = ['#f4b6a6', '#f6d38c', '#b6d7c4', '#f1c1d4', '#e8c39e', '#c9d7ef'];
  let k = 0;
  for (let x = -19; x <= 8; x += 5.4) building(W, x, -19.5, 5, 4, 7 + (k % 3) * 1.5, pastel[k++ % 6], { roof: '#c4553a', roofType: 'gable' });
  for (let z = -13; z <= -6; z += 5.4) building(W, -19.5, z, 4, 5, 8, pastel[k++ % 6], { roof: '#c4553a' });
  for (let x = -18; x <= 18; x += 7) { if (Math.abs(x - 13) < 3) continue; building(W, x, 8.5, 4.5, 3.5, 6, pastel[k++ % 6], { roof: '#c4553a', roofType: 'gable' }); }
  building(W, 19, -8, 4, 6, 7, pastel[k++ % 6], { roof: '#c4553a' });
  // St Mark's campanile
  W.box(3, 14, 3, '#b5553c', -13.5, 0, -12, { map: windowsTex('#b5553c', '#8a3a28', '#8a3a28', 2, 8), edge: true });
  W.box(3.4, 2.5, 3.4, '#efe3c8', -13.5, 14, -12, { collide: false });
  W.cone(2.2, 5, '#3fae6a', -13.5, 16.5, -12, { seg: 4 }).rotation.y = Math.PI / 4;
  // flower pots, lamps
  for (const [x, z] of [[-4, 4], [4, 4], [-4, -8], [4, -8], [-4, 14], [4, 14]]) lamp(W, x, z, '#2d3340');
  flowers(W, -14, 3); flowers(W, 0, -12); flowers(W, 16, 15);
  edgeClouds(W);
  return { spawn: { x: 0, z: 17 }, clue: { x: 12.3, z: -16.4, y: 0.75 } };
}

function copacabanaTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#26262b';
  for (let row = 0; row < 4; row++) {
    g.beginPath();
    for (let y = 0; y <= 256; y += 4) {
      const x = row * 64 + 32 + Math.sin((y / 256) * Math.PI * 4) * 16;
      if (y === 0) g.moveTo(x - 12, y); else g.lineTo(x - 12, y);
    }
    for (let y = 256; y >= 0; y -= 4) g.lineTo(row * 64 + 32 + Math.sin((y / 256) * Math.PI * 4) * 16 + 12, y);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 8);
  return t;
}
function buildRio(W) {
  const S = W.S;
  makeGround(W, { color: '#f6e0ac', spec: '#e3c787', far: '#3cc0e8' });
  candyFence(W, '#3fae6a');
  // ocean on the east side
  const sea = mesh(new THREE.PlaneGeometry(S - 14 + 6, S * 2 + 6), waterMat('#39b8e6'), { shadow: false });
  sea.rotation.x = -Math.PI / 2; sea.position.set((14 + S + 3) / 2, 0.03, 0); W.root.add(sea);
  W.colBox((14 + S) / 2, 0, S - 14, S * 2);
  const foam = mesh(new THREE.PlaneGeometry(0.8, S * 2), basic('#ffffff'), { shadow: false });
  foam.rotation.x = -Math.PI / 2; foam.position.set(14.2, 0.04, 0); W.root.add(dyn(foam));
  W.animated.push((dt, t) => { foam.position.x = 14.1 + Math.sin(t * 1.2) * 0.35; });
  // promenade with the famous wave pattern
  const prom = mesh(new THREE.PlaneGeometry(4, S * 2), mat('#ffffff', { map: copacabanaTex() }), { shadow: false });
  prom.rotation.x = -Math.PI / 2; prom.position.set(-12, 0.02, 0); prom.receiveShadow = true; W.root.add(prom);
  // hill + Christ the Redeemer
  const hx = -2, hz = -17;
  const hill = mesh(new THREE.SphereGeometry(6, 24, 16), mat('#5fb44f')); hill.scale.y = 0.55; hill.position.set(hx, 0, hz); outline(hill, 0.01); W.root.add(hill);
  W.colCircle(hx, hz, 5.8);
  W.box(1.8, 2, 1.8, '#e7e2d6', hx, 3, hz, { collide: false });
  const st = new THREE.Group();
  const white = mat('#f4f1ea');
  const robe = mesh(new THREE.CylinderGeometry(0.7, 1.1, 5, 12), white); robe.position.y = 2.5; outline(robe, 0.02); st.add(robe);
  const arms = mesh(new THREE.BoxGeometry(7, 0.6, 0.6), white); arms.position.y = 4.4; outline(arms, 0.03); st.add(arms);
  const head = mesh(new THREE.SphereGeometry(0.55, 14, 12), white); head.position.y = 5.5; st.add(head);
  W.add(st, hx, 5, hz);
  // Sugarloaf mountains out in the sea
  for (const [x, z, r, h] of [[45, -40, 9, 22], [34, -30, 6, 12]]) {
    const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat('#6f8f5a')); m.scale.y = h / r; m.position.set(x, 0, z); W.root.add(m);
  }
  // palms, umbrellas, beach balls, sandcastles, lifeguard tower
  for (const z of [-18, -10, -2, 6, 14]) palm(W, -15, z, 4.5 + W.rand());
  for (const [x, z] of [[8, 10], [9, -8], [-6, 3]]) palm(W, x, z, 4.2);
  const umb = [['#ff4f9a', '#ffffff'], ['#ffd23f', '#2f8cff'], ['#3fae6a', '#ffffff'], ['#ff8a3d', '#ffffff']];
  for (const [i, [x, z]] of [[3, 2], [10, 4], [5, 12], [11, -4], [6, -8]].entries()) {
    W.cyl(0.06, 0.06, 2.4, '#ffffff', x, 0, z, { seg: 6 });
    const u = W.cone(1.6, 0.7, '#fff', x, 2.2, z, { seg: 10, material: mat('#ffffff', { map: stripeTex(umb[i % 4][0], umb[i % 4][1], 8, false) }) });
    u.rotation.y = i;
  }
  const balls = [];
  for (const [x, z] of [[1, 6], [8, -12]]) {
    const b = W.sphere(0.45, '#fff', x, 0.45, z, { material: mat('#ffffff', { map: stripeTex('#ff4f9a', '#ffffff', 4, false) }) });
    balls.push(dyn(b));
  }
  W.animated.push((dt, t) => balls.forEach((b, i) => { b.rotation.y = t * (0.5 + i * 0.3); }));
  for (const [x, z] of [[-5, 10], [2, -6]]) {
    W.box(1.4, 0.7, 1.4, '#e9c98a', x, 0, z);
    for (const [dx, dz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) W.cyl(0.25, 0.28, 1.1, '#e9c98a', x + dx, 0, z + dz, { collide: false, seg: 6 });
  }
  const lg = new THREE.Group();
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
    const l = mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), mat('#ffffff')); l.position.set(dx, 1.25, dz); lg.add(l);
  }
  const hut = mesh(new THREE.BoxGeometry(2, 1.4, 2), mat('#ff4f4f')); hut.position.y = 3.2; outline(hut, 0.03); lg.add(hut);
  W.add(lg, 11, 0, 15); W.colBox(11, 15, 2, 2);
  edgeClouds(W);
  return { spawn: { x: 0, z: 17 }, clue: { x: hx, z: hz + 6.6, y: 1.2 } };
}


// ------------------------------------------------------------
//  Ho Chi Minh City
// ------------------------------------------------------------
function scooter(color) {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.5, 0.5, 1.4), mat(color)); body.position.y = 0.6; outline(body, 0.04); g.add(body);
  const front = mesh(new THREE.BoxGeometry(0.5, 0.9, 0.2), mat(color)); front.position.set(0, 0.9, 0.65); g.add(front);
  const bar = mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08), mat('#333')); bar.position.set(0, 1.4, 0.65); g.add(bar);
  const seat = mesh(new THREE.BoxGeometry(0.45, 0.14, 0.7), mat('#2a2a2a')); seat.position.set(0, 0.92, -0.2); g.add(seat);
  for (const z of [0.6, -0.55]) {
    const w = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 12), mat('#222')); w.rotation.z = Math.PI / 2; w.position.set(0, 0.28, z); g.add(w);
  }
  const lamp = mesh(new THREE.SphereGeometry(0.1, 8, 6), basic('#fff3b0')); lamp.position.set(0, 1.25, 0.78); g.add(lamp);
  bakeGroup(g);
  return g;
}
function conicalHat(color = '#f2dca0') {
  const h = mesh(new THREE.ConeGeometry(0.45, 0.32, 16), mat(color));
  return h;
}
function lanternString(W, x1, z1, x2, z2, y = 3.6) {
  const cols = ['#e8202e', '#ffcf3a', '#ff8a3d', '#e8202e', '#ff4f9a'];
  for (const [x, z] of [[x1, z1], [x2, z2]]) W.cyl(0.07, 0.09, y + 0.2, '#5a4636', x, 0, z, { seg: 6 });
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(3, Math.floor(len / 1.3));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const sag = Math.sin(t * Math.PI) * 0.5;
    W.sphere(0.22, cols[i % cols.length], x1 + (x2 - x1) * t, y - sag - 0.25, z1 + (z2 - z1) * t, { sy: 1.2, seg: 10 });
  }
}
function buildHCMC(W) {
  makeGround(W, { color: '#ecd7b8', spec: '#d3b891', kind: 'tiles', far: '#9fcf7a' });
  candyFence(W, '#e8202e');
  // --- Ben Thanh Market with its clock tower ---
  const mx = 0, mz = -16;
  building(W, mx, mz, 16, 5, 5, '#f2d36b', { win: windowsTex('#f2d36b', '#8a5a2b', '#8a5a2b', 12, 3), roof: '#b5553c', roofType: 'gable' });
  W.box(3.4, 9, 3.4, '#f5dc7e', mx, 0, mz + 3.2, { map: windowsTex('#f5dc7e', '#8a5a2b', '#8a5a2b', 2, 6), edge: true });
  const face = mat('#ffffff', { map: clockTex() });
  const clock = mesh(new THREE.PlaneGeometry(2.2, 2.2), face, { shadow: false });
  clock.position.set(mx, 7.4, mz + 4.92); W.root.add(clock);
  W.box(3.8, 0.4, 3.8, '#e3c35b', mx, 9, mz + 3.2, { collide: false });
  const tr = W.cone(2.2, 2, '#b5553c', mx, 9.4, mz + 3.2, { seg: 4 }); tr.rotation.y = Math.PI / 4;
  W.box(2, 2.4, 0.15, '#6a3f25', mx, 0, mz + 4.95, { collide: false });
  // lantern pole: the clue hangs here
  const px = 8.4, pz = -11.2;
  W.cyl(0.1, 0.12, 4.2, '#5a4636', px, 0, pz, { seg: 8 });
  W.box(1.6, 0.12, 0.12, '#5a4636', px - 0.7, 4.0, pz, { collide: false });
  // --- Notre-Dame Cathedral (red brick, two spires) ---
  const cx = -14, cz = -7;
  W.box(6, 6, 7, '#c0553d', cx, 0, cz, { map: windowsTex('#c0553d', '#f4e3c8', '#f4e3c8', 3, 3), edge: true });
  for (const dx of [-2.2, 2.2]) {
    W.box(1.9, 10, 1.9, '#c95f45', cx + dx, 0, cz + 3.2, { map: windowsTex('#c95f45', '#f4e3c8', '#f4e3c8', 1, 6) });
    W.cone(1.25, 4, '#6f7a86', cx + dx, 10, cz + 3.2, { seg: 4 }).rotation.y = Math.PI / 4;
    W.sphere(0.15, '#ffcf3a', cx + dx, 14.1, cz + 3.2);
  }
  const gable = W.cone(4.4, 2.5, '#9b3f2c', cx, 6, cz, { seg: 4 }); gable.rotation.y = Math.PI / 4; gable.scale.z = 1.2;
  // --- Central Post Office (yellow, arched roof) ---
  building(W, 14, -12, 7, 5, 4.5, '#f3d07a', { win: windowsTex('#f3d07a', '#6b8f6a', '#6b8f6a', 6, 2), roof: '#7f9b85' });
  const arch = mesh(new THREE.CylinderGeometry(2.5, 2.5, 5, 18, 1, false, 0, Math.PI), mat('#7f9b85'));
  arch.rotation.set(0, Math.PI / 2, Math.PI / 2); arch.position.set(14, 4.5, -12); arch.scale.set(1, 1, 0.5); W.root.add(arch);
  // --- Bitexco tower + skyline in the distance ---
  W.cyl(1.6, 3.4, 30, '#a9c8dd', 18, 0, -40, { collide: false, seg: 10, map: windowsTex('#9fc0d8', '#e6f4ff', '#e6f4ff', 6, 12) });
  const heli = mesh(new THREE.CylinderGeometry(2, 2, 0.3, 16), mat('#6f7a86')); heli.position.set(19.6, 24, -40); W.root.add(heli);
  W.cone(1.6, 3, '#a9c8dd', 18, 30, -40, { seg: 10 });
  for (const [x, z, w, h, c] of [[-20, -38, 6, 16, '#d8c6a8'], [-8, -42, 6, 22, '#c9d7ef'], [6, -44, 5, 14, '#f1c1d4'], [30, -34, 6, 18, '#b6d7c4']]) building(W, x, z, w, w, h, c, { collide: false });
  // --- street life: scooters, food carts, stools, lanterns ---
  const cols = ['#e8202e', '#2f8cff', '#3fae6a', '#ffcf1f', '#ff8a3d', '#ffffff', '#b46cff'];
  const parked = [[-6, -8, 0.3], [-5, -8.3, 0.3], [-4, -8.1, 0.2], [6, 2, 1.6], [6.2, 3.2, 1.6], [-17, 6, -0.5], [15, 8, 2.9]];
  parked.forEach(([x, z, r], i) => { const sc = scooter(cols[i % cols.length]); W.add(sc, x, 0, z, r); W.colCircle(x, z, 0.7); });
  // zooming scooters on the road behind the market (outside the play area)
  const riders = [];
  for (let i = 0; i < 6; i++) {
    const sc = scooter(cols[(i + 2) % cols.length]);
    const hat = conicalHat(); hat.position.set(0, 1.9, -0.15); sc.add(hat);
    const rider = mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), mat(cols[(i + 4) % cols.length])); rider.position.set(0, 1.35, -0.2); sc.add(rider);
    W.root.add(dyn(sc));
    riders.push({ sc, speed: 5 + (i % 3) * 1.5, off: i * 13, lane: i % 2 });
  }
  W.animated.push((dt, t) => riders.forEach((r) => {
    const dir = r.lane ? 1 : -1;
    r.sc.position.set(dir * (((t * r.speed + r.off) % 80) - 40), 0, -25 - r.lane * 1.6);
    r.sc.rotation.y = dir * Math.PI / 2;
  }));
  const road = mesh(new THREE.PlaneGeometry(200, 5), mat('#6b6f76'), { shadow: false });
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -25.8); W.root.add(road);
  // food carts with umbrellas + tiny plastic stools
  for (const [x, z, c] of [[-9, 4, '#3fae6a'], [10, -3, '#2f8cff'], [-3, 10, '#ff4f9a']]) {
    W.box(1.8, 1, 1, '#e9eef5', x, 0, z, { edge: true });
    W.cyl(0.04, 0.04, 2.4, '#555', x, 0, z, { collide: false, seg: 6 });
    W.cone(1.4, 0.6, c, x, 2.3, z, { seg: 8 });
    for (let k = 0; k < 3; k++) W.cyl(0.2, 0.22, 0.4, ['#e8202e', '#2f8cff', '#ffcf1f'][k], x - 1 + k, 0, z + 1.3, { collide: false, seg: 8 });
  }
  lanternString(W, -8, -2, 8, -2);
  lanternString(W, -18, 12, -8, 16);
  // trees + flowers
  for (const [x, z] of [[-18, -16], [-18, -1], [18, 0], [17, 14], [-12, 16], [8, 16], [3, -7]]) tree(W, x, z, 1.15, '#4fae4a');
  flowers(W, -10, -12); flowers(W, 12, 5); flowers(W, 0, 6);
  edgeClouds(W);
  return { spawn: { x: 0, z: 17 }, clue: { x: px - 1.3, z: pz + 0.3, y: 2.9, hang: new THREE.Vector3(px - 1.3, 4.0, pz) } };
}

// ============================================================
//  Mr. Sugar's Lollipop Shop (title + ending)
// ============================================================
export function buildShop(W, { full = false } = {}) {
  makeGround(W, { color: '#e7dccb', spec: '#cdbfa8', kind: 'tiles', far: '#9bd37a' });
  const shopC = '#ffd9e8';
  building(W, 0, -6, 12, 5, 7, shopC, { win: windowsTex(shopC, '#ffe9f2', '#ffe9f2', 1, 1), roof: '#ff8fbd', collide: false });
  // big window
  const glass = mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0.55 }), { shadow: false });
  glass.position.set(-2.6, 2.3, -3.45); W.root.add(glass);
  W.box(5.4, 0.25, 0.5, '#ffffff', -2.6, 0.7, -3.4, { collide: false });
  W.box(5.4, 0.25, 0.5, '#ffffff', -2.6, 3.8, -3.4, { collide: false });
  // door
  W.box(1.8, 3.2, 0.12, '#ff5fa2', 3.2, 0, -3.47, { collide: false });
  W.sphere(0.1, '#ffd23f', 3.8, 1.6, -3.35);
  // awning
  const aw = mesh(new THREE.BoxGeometry(12.6, 0.15, 2.6), mat('#ffffff', { map: stripeTex('#ffffff', '#ff4f9a', 10, false) }));
  aw.position.set(0, 4.6, -2.6); aw.rotation.x = 0.35; outline(aw, 0.02); W.root.add(aw);
  // sign
  const sign = billboard(W, 0, 6.1, -3.45, 8, 1.2, textTex("Mr. Sugar's Lollipop Shop", { bg: '#ffffff', fg: '#ff3d8f', w: 1024, h: 150, font: 'bold 84px Fredoka, sans-serif', border: '#ffcf3a' }));
  const shelf = new THREE.Group();
  W.root.add(dyn(shelf));
  const cols = ['#ff4f9a', '#2f8cff', '#ffd23f', '#3fae6a', '#ff8a3d', '#b46cff'];
  const lollies = [];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 6; i++) {
      const l = makeLollipop(0.28, cols[(i + r * 2) % 6]);
      l.position.set(-4.7 + i * 0.85, 1.75 + r * 1.2, -3.6);
      l.visible = full;
      shelf.add(l);
      lollies.push(l);
    }
  }
  const sorry = billboard(W, -2.6, 2.3, -3.42, 2.8, 1.1, textTex('Sorry! No candy!', { bg: '#ffffff', fg: '#e2412b', w: 512, h: 200, font: 'bold 64px Fredoka, sans-serif', border: '#e2412b' }));
  sorry.visible = !full;
  giantLolly(W, -7, -2.5, 0.9, '#ff4f9a', makeLollipop);
  giantLolly(W, 7, -2.5, 0.9, '#2f8cff', makeLollipop);
  // neighbours + trees
  building(W, -12.5, -6, 12, 5, 9, '#c9d7ef', { roof: '#8aa3c7', collide: false });
  building(W, 12.5, -6, 12, 5, 8, '#f6d38c', { roof: '#e0a94a', collide: false });
  for (const [x, z] of [[-10, 2], [10, 2], [-16, 4], [16, 5]]) tree(W, x, z, 1.1);
  // New York City touches: yellow taxis, a fire hydrant and the skyline
  car(W, -8.5, 4.6, Math.PI / 2, '#ffcf1f', true);
  car(W, 11, 5.2, -Math.PI / 2, '#ffcf1f', true);
  W.cyl(0.2, 0.25, 0.7, '#e2412b', 6.2, 0, 1.2, { seg: 8 }); W.sphere(0.2, '#e2412b', 6.2, 0.75, 1.2);
  for (const [x, z, w, h, c] of [[-22, -22, 7, 20, '#b8c4d6'], [-12, -26, 6, 28, '#c9b8a6'], [12, -26, 6, 24, '#aebfd4'], [22, -22, 7, 18, '#d6c2b0']]) building(W, x, z, w, w, h, c, { collide: false });
  // Empire State-style tower
  const es = [[7, 22], [5, 6], [3.4, 5], [2.2, 4]];
  let ey = 0;
  for (const [w, h] of es) { building(W, 2, -34, w, w, h, '#d9d2c3', { collide: false }); W.root.children[W.root.children.length - 1].position.y = ey + h / 2; ey += h; }
  W.cyl(0.25, 0.6, 6, '#d9d2c3', 2, ey, -34, { collide: false, seg: 8 });
  for (const [x, z] of [[-5, 1.5], [5, 1.5]]) lamp(W, x, z, '#2d3340');
  flowers(W, -9, -2); flowers(W, 9, -2);
  edgeClouds(W);
  return {
    setFull(v) { lollies.forEach((l) => { l.visible = v; }); sorry.visible = !v; },
    setSign(v) { sign.visible = v; },
  };
}

import * as THREE from 'three';
import { mat, basic, mesh, outline, textTex, bakeGroup } from './lib.js';
import { makeLollipop } from './characters.js';
import { LEVELS, GLOBE_CITIES } from './levels.js';

const R = 5;

// Very rough cartoon continents (lon, lat)
const LAND = [
  [[-168, 65], [-140, 70], [-110, 72], [-85, 70], [-65, 62], [-55, 52], [-66, 45], [-70, 42], [-76, 38], [-81, 31], [-80, 25], [-83, 29], [-90, 30], [-97, 27], [-97, 21], [-92, 18], [-87, 21], [-84, 15], [-78, 8], [-80, 7], [-86, 12], [-92, 15], [-105, 20], [-110, 24], [-112, 31], [-117, 33], [-121, 36], [-124, 41], [-124, 48], [-131, 54], [-140, 59], [-152, 58], [-162, 55], [-166, 60]],
  [[-45, 60], [-20, 70], [-20, 80], [-45, 83], [-70, 78], [-55, 68]],
  [[-80, 8], [-72, 12], [-62, 10], [-50, 1], [-35, -5], [-39, -15], [-48, -26], [-58, -34], [-65, -41], [-68, -52], [-74, -52], [-73, -40], [-71, -30], [-70, -18], [-76, -13], [-81, -5], [-78, 1]],
  [[-9, 37], [-9, 43], [-1, 46], [-4, 48], [2, 51], [8, 54], [10, 57], [6, 58], [5, 62], [14, 67], [22, 70], [30, 70], [42, 67], [60, 69], [70, 73], [80, 73], [100, 77], [112, 74], [130, 71], [140, 72], [160, 70], [170, 66], [180, 66], [180, 62], [163, 58], [156, 51], [142, 53], [140, 46], [135, 43], [130, 42], [127, 38], [126, 35], [121, 31], [122, 25], [117, 23], [110, 21], [106, 17], [109, 12], [105, 9], [103, 1], [100, 6], [98, 16], [94, 17], [92, 22], [88, 22], [80, 15], [77, 8], [73, 17], [72, 22], [66, 25], [57, 26], [56, 23], [59, 22], [52, 17], [44, 13], [42, 16], [35, 28], [33, 31], [35, 36], [27, 37], [26, 40], [23, 40], [20, 40], [16, 38], [12, 44], [8, 44], [3, 43], [-2, 37]],
  [[-17, 15], [-17, 21], [-13, 27], [-9, 31], [-6, 36], [10, 37], [11, 33], [20, 31], [25, 32], [32, 31], [34, 28], [39, 17], [43, 12], [51, 12], [47, 5], [40, -3], [40, -11], [35, -20], [35, -25], [32, -29], [27, -34], [20, -35], [18, -32], [15, -27], [12, -18], [13, -10], [9, -1], [9, 4], [4, 6], [-4, 5], [-8, 4], [-13, 8], [-17, 13]],
  [[44, -25], [48, -25], [50, -16], [47, -13], [44, -17]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -25], [151, -33], [145, -38], [138, -35], [131, -31], [118, -35], [115, -34]],
  [[-5, 50], [1, 51], [2, 53], [-1, 55], [-3, 58], [-6, 58], [-5, 55], [-3, 54], [-5, 52]],
  [[130, 31], [135, 34], [140, 35], [142, 40], [141, 45], [144, 44], [140, 38], [136, 36], [132, 34]],
  [[95, 5], [105, -6], [110, -8], [120, -9], [115, -4], [109, 1], [104, 1]],
  [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]],
  [[172, -35], [178, -38], [174, -41], [167, -46], [170, -46], [175, -40]],
  [[-24, 64], [-14, 64], [-14, 66], [-22, 66]],
  [[-180, -72], [180, -72], [180, -90], [-180, -90]],
];

function globeTexture() {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#5fc8f5'); grd.addColorStop(0.5, '#3fb1ee'); grd.addColorStop(1, '#5fc8f5');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // little wave marks
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 140; i++) {
    const x = (i * 397) % W, y = (i * 211) % H;
    g.beginPath(); g.arc(x, y, 10, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  }
  const P = ([lon, lat]) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  for (const poly of LAND) {
    g.beginPath();
    poly.forEach((p, i) => { const [x, y] = P(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath();
    g.fillStyle = '#7fd36a'; g.fill();
    g.lineJoin = 'round';
    g.strokeStyle = '#f7e8b0'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#7fd36a'; g.fill();
  }
  // snowy poles + deserts for fun
  g.fillStyle = '#ffffff'; g.fillRect(0, H * 0.9, W, H * 0.1); g.fillRect(0, 0, W, H * 0.04);
  g.fillStyle = 'rgba(240,210,140,0.9)';
  for (const [lon, lat, rx, ry] of [[15, 23, 60, 25], [45, 22, 25, 15], [133, -25, 25, 12]]) {
    const [x, y] = P([lon, lat]); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function latLonToVec(lat, lon, r = R) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

function makePlane() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.12, 0.6, 6, 12), mat('#ffffff')); body.rotation.x = Math.PI / 2; outline(body, 0.08); g.add(body);
  const wing = mesh(new THREE.BoxGeometry(0.9, 0.03, 0.2), mat('#ff5fa2')); wing.position.z = 0.02; g.add(wing);
  const tail = mesh(new THREE.BoxGeometry(0.34, 0.03, 0.12), mat('#ff5fa2')); tail.position.z = -0.35; g.add(tail);
  const fin = mesh(new THREE.BoxGeometry(0.03, 0.2, 0.14), mat('#4f8cff')); fin.position.set(0, 0.1, -0.35); g.add(fin);
  const win = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.4), mat('#9fd6ff')); win.position.set(0, 0.07, 0.05); g.add(win);
  g.scale.setScalar(0.9);
  return g;
}

export class Globe {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b1e4a');
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8888cc, 1.4));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4);
    dl.position.set(5, 6, 12);
    this.scene.add(dl);
    // starfield
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(60 + Math.random() * 30);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff7c2', size: 0.35 }));
    this.scene.add(this.stars);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40), mat('#ffffff', { map: globeTexture() }));
    outline(earth, 0.012);
    this.group.add(earth);
    this.earth = earth;
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 48, 32), new THREE.MeshBasicMaterial({ color: '#9fe3ff', transparent: true, opacity: 0.12, side: THREE.BackSide }));
    this.scene.add(atmo);

    // cloud puffs orbiting
    this.clouds = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const p = mesh(new THREE.SphereGeometry(0.25 + (k % 2) * 0.1, 8, 6), mat('#ffffff'), { shadow: false });
        p.position.x = (k - 1) * 0.28; c.add(p);
      }
      const v = latLonToVec(Math.random() * 120 - 60, Math.random() * 360 - 180, R + 0.45);
      c.position.copy(v);
      c.lookAt(0, 0, 0);
      this.clouds.add(c);
    }
    this.group.add(this.clouds);

    // pins
    this.pins = [];
    const pinCols = ['#ff4f9a', '#2f8cff', '#ffd23f', '#3fae6a', '#ff8a3d', '#b46cff', '#ff5d5d', '#5ad1ff'];
    GLOBE_CITIES.forEach((id, i) => {
      const c = LEVELS[id];
      const home = id === 'newyork';
      const pin = new THREE.Group();
      const base = latLonToVec(c.lat, c.lon, R);
      const n = base.clone().normalize();
      const l = makeLollipop(home ? 0.24 : 0.18, pinCols[i % pinCols.length]);
      l.position.y = 0.55;
      pin.add(l);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.5;
      hit.userData.cityId = id;
      pin.add(hit);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(home ? 'New York (Home)' : c.name, { bg: '#ffffff', fg: '#ff3d8f', w: 640, h: 128, font: 'bold 60px Fredoka, sans-serif', border: '#ffcf3a' }), depthTest: false, transparent: true }));
      label.scale.set(3.0, 0.6, 1);
      label.position.y = 1.4;
      label.renderOrder = 5;
      pin.add(label);
      const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex('★', { bg: '#00000000', fg: '#ffd23f', w: 128, h: 128, font: 'bold 120px sans-serif' }), transparent: true, depthTest: false }));
      star.scale.set(0.4, 0.4, 1);
      star.position.set(0.3, 0.75, 0);
      star.visible = false;
      star.renderOrder = 6;
      pin.add(star);
      pin.position.copy(base);
      pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      this.group.add(pin);
      this.pins.push({ pin, lolly: l, label, star, hit, id, home });
    });

    this.routeGroup = null;
    this.plane = makePlane();
    this.group.add(this.plane);
    this.targetQuat = new THREE.Quaternion();
    this.travelState = null;
    this.t = 0;
    this.raycaster = new THREE.Raycaster();
    this.open = new Set(['newyork']);
    this.nextId = 'newyork';
    this.placePlaneAt('newyork');
  }

  // 'finale' is the New York return trip, so it shares New York's pin
  pinId(id) { return id === 'finale' ? 'newyork' : id; }

  cityVec(id, r = R) {
    const c = LEVELS[id] || LEVELS.newyork;
    return latLonToVec(c.lat, c.lon, r);
  }

  // rotate the globe so this point faces the camera (+z), tilted a little
  quatFacing(v) {
    const n = v.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 0.25, 1).normalize());
  }

  focus(id, instant = false) {
    this.targetQuat.copy(this.quatFacing(this.cityVec(id)));
    if (instant) this.group.quaternion.copy(this.targetQuat);
  }

  placePlaneAt(id) {
    const v = this.cityVec(id, R + 0.35);
    this.plane.position.copy(v);
    this.plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
    this.planeId = id;
  }

  // route = ['newyork', ...shuffled..., 'finale']; unlocked = how many stops are done
  setProgress(route, unlocked, stars) {
    const upto = Math.min(unlocked, route.length - 1);
    this.open = new Set(route.slice(0, upto + 1).map((id) => this.pinId(id)));
    this.nextId = unlocked >= route.length ? null : this.pinId(route[upto]);
    this.pins.forEach((p) => {
      p.star.visible = (stars[p.id] || 0) > 0 || (p.home && (stars.finale || 0) > 0);
      p.label.material.opacity = this.open.has(p.id) ? 1 : 0.45;
    });
    // dotted line only along the part of the trip already revealed (keeps the rest a surprise)
    if (this.routeGroup) { this.group.remove(this.routeGroup); this.routeGroup.traverse((o) => o.geometry && o.geometry.dispose()); }
    const g = new THREE.Group();
    const dotGeo = new THREE.SphereGeometry(0.045, 6, 4);
    const dotMat = basic('#ffffff');
    for (let i = 0; i < upto; i++) {
      const a = this.cityVec(route[i], 1).normalize();
      const b = this.cityVec(route[i + 1], 1).normalize();
      const n = Math.max(6, Math.floor(a.angleTo(b) * 14));
      for (let k = 1; k < n; k++) {
        const d = new THREE.Mesh(dotGeo, dotMat);
        d.position.copy(slerpVec(a, b, k / n).multiplyScalar(R + 0.06 + Math.sin((k / n) * Math.PI) * 0.4));
        g.add(d);
      }
    }
    if (g.children.length) bakeGroup(g);
    this.group.add(g);
    this.routeGroup = g;
  }

  travel(from, to, onDone) {
    this.travelState = { from, to, t: 0, dur: 3.6, onDone };
  }

  pick(ndc, camera) {
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObjects(this.pins.map((p) => p.hit), false);
    if (!hits.length) return null;
    const h = hits[0];
    const wp = h.object.getWorldPosition(new THREE.Vector3());
    if (wp.z < 0) return null; // only pins on the visible side
    return h.object.userData.cityId;
  }

  update(dt, camera) {
    this.t += dt;
    const aspect = window.innerWidth / window.innerHeight;
    const dist = aspect < 0.75 ? 25 : aspect < 1.1 ? 20 : 16;
    camera.position.set(0, 1.2, dist);
    camera.lookAt(0, aspect < 0.75 ? -0.8 : 0.3, 0);
    this.clouds.rotation.y += dt * 0.03;
    this.stars.rotation.y += dt * 0.005;
    const here = this.pinId(this.travelState ? this.travelState.to : this.planeId);
    this.pins.forEach((p, i) => {
      const next = p.id === this.nextId;
      const open = this.open.has(p.id);
      p.label.visible = next || p.id === here || p.home;
      const s = next ? 1 + Math.sin(this.t * 5) * 0.18 : 1;
      p.lolly.scale.setScalar((open || next ? 1 : 0.6) * s);
      p.lolly.rotation.y = this.t * (next ? 2 : 0.5) + i;
    });
    const ts = this.travelState;
    if (ts) {
      ts.t += dt / ts.dur;
      const k = Math.min(1, ts.t);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const a = this.cityVec(ts.from, 1).normalize();
      const b = this.cityVec(ts.to, 1).normalize();
      const p = slerpVec(a, b, e);
      const h = R + 0.35 + Math.sin(e * Math.PI) * 1.6;
      this.plane.position.copy(p).multiplyScalar(h);
      const e2 = Math.min(1, e + 0.02);
      const ahead = slerpVec(a, b, e2).multiplyScalar(R + 0.35 + Math.sin(e2 * Math.PI) * 1.6);
      const m = new THREE.Matrix4().lookAt(ahead, this.plane.position, p.clone().normalize());
      if (k < 0.99) this.plane.quaternion.setFromRotationMatrix(m);
      this.targetQuat.copy(this.quatFacing(p));
      this.group.quaternion.slerp(this.targetQuat, 1 - Math.exp(-6 * dt));
      if (k >= 1) {
        this.travelState = null;
        this.placePlaneAt(ts.to);
        ts.onDone && ts.onDone();
      }
    } else {
      this.group.quaternion.slerp(this.targetQuat, 1 - Math.exp(-3 * dt));
      const v = this.cityVec(this.planeId || 'newyork', R + 0.35 + Math.sin(this.t * 3) * 0.06);
      this.plane.position.copy(v);
    }
  }
}

function slerpVec(a, b, t) {
  const ang = a.angleTo(b);
  if (ang < 1e-5) return a.clone();
  const s = Math.sin(ang);
  return a.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(b.clone().multiplyScalar(Math.sin(t * ang) / s));
}

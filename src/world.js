import * as THREE from 'three';
import { mat, basic, mesh, outline, rng, stripeTex, windowsTex, textTex, groundTex } from './lib.js';
export function dyn(o) { o.userData.dynamic = true; return o; }

// ============================================================
//  WorldBuilder: places props and records simple colliders
//  (circles + axis-aligned boxes on the ground plane)
// ============================================================
export class WorldBuilder {
  constructor(root, S, seed = 1) {
    this.root = root;
    this.S = S;
    this.colliders = [];
    this.animated = []; // functions (dt, t) => void
    this.rand = rng(seed);
  }
  add(obj, x = 0, y = 0, z = 0, rotY = 0) {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    this.root.add(obj);
    return obj;
  }
  colBox(x, z, w, d) { this.colliders.push({ t: 'b', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }); }
  colCircle(x, z, r) { this.colliders.push({ t: 'c', x, z, r }); }
  box(w, h, d, color, x, y, z, { collide = true, map = null, rotY = 0, shadow = true, material = null, edge = false } = {}) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), material || (map ? mat('#ffffff', { map }) : mat(color)), { shadow });
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rotY;
    if (edge) outline(m, 0.02);
    this.root.add(m);
    if (collide) {
      const swap = Math.abs(Math.sin(rotY)) > 0.7;
      this.colBox(x, z, swap ? d : w, swap ? w : d);
    }
    return m;
  }
  cyl(rt, rb, h, color, x, y, z, { collide = true, seg = 16, map = null, material = null, shadow = true } = {}) {
    const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material || (map ? mat('#ffffff', { map }) : mat(color)), { shadow });
    m.position.set(x, y + h / 2, z);
    this.root.add(m);
    if (collide) this.colCircle(x, z, Math.max(rt, rb));
    return m;
  }
  sphere(r, color, x, y, z, { sx = 1, sy = 1, sz = 1, collide = false, seg = 16, material = null } = {}) {
    const m = mesh(new THREE.SphereGeometry(r, seg, Math.floor(seg * 0.75)), material || mat(color));
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    this.root.add(m);
    if (collide) this.colCircle(x, z, r * Math.max(sx, sz));
    return m;
  }
  cone(r, h, color, x, y, z, { seg = 16, collide = false, material = null } = {}) {
    const m = mesh(new THREE.ConeGeometry(r, h, seg), material || mat(color));
    m.position.set(x, y + h / 2, z);
    this.root.add(m);
    if (collide) this.colCircle(x, z, r);
    return m;
  }
  // Is a point on the walkable ground (inside bounds and away from colliders)?
  free(x, z, margin = 0.5) {
    const S = this.S - 1.2;
    if (x < -S || x > S || z < -S || z > S) return false;
    for (const c of this.colliders) {
      if (c.t === 'c') {
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz < (c.r + margin) ** 2) return false;
      } else if (x > c.minX - margin && x < c.maxX + margin && z > c.minZ - margin && z < c.maxZ + margin) return false;
    }
    return true;
  }
}

// Push a circle (x,z,r) out of every collider. Returns true if it hit something.
export function resolveCollisions(pos, r, colliders, S) {
  let hit = false;
  for (const c of colliders) {
    if (c.t === 'c') {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d2 = dx * dx + dz * dz, rr = c.r + r;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.0001;
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
        hit = true;
      }
    } else {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
        } else {
          // centre is inside the box: push out the shortest way
          const opts = [
            [pos.x - c.minX, -1, 0], [c.maxX - pos.x, 1, 0],
            [pos.z - c.minZ, 0, -1], [c.maxZ - pos.z, 0, 1],
          ].sort((a, b) => a[0] - b[0]);
          const [, sx, sz] = opts[0];
          if (sx) pos.x = sx < 0 ? c.minX - r : c.maxX + r;
          if (sz) pos.z = sz < 0 ? c.minZ - r : c.maxZ + r;
        }
        hit = true;
      }
    }
  }
  const S2 = S - 0.8;
  if (pos.x < -S2) { pos.x = -S2; hit = true; }
  if (pos.x > S2) { pos.x = S2; hit = true; }
  if (pos.z < -S2) { pos.z = -S2; hit = true; }
  if (pos.z > S2) { pos.z = S2; hit = true; }
  return hit;
}

// ============================================================
//  Sky, ground, border, weather
// ============================================================
export function makeSky(top, bottom) {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
  });
  const sky = new THREE.Mesh(geo, m);
  sky.renderOrder = -1;
  return sky;
}

export function makeGround(W, { color, spec, kind = 'dots', far = null }) {
  const S = W.S;
  const g = mesh(new THREE.PlaneGeometry(S * 2 + 6, S * 2 + 6), mat('#ffffff', { map: groundTex(color, spec, kind, Math.round(S / 2)) }), { shadow: false });
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  W.root.add(g);
  const outer = mesh(new THREE.PlaneGeometry(600, 600), mat(far || color), { shadow: false });
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  outer.receiveShadow = true;
  W.root.add(outer);
  return g;
}

// Candy-cane fence all around the play area so kids can see the edge.
export function candyFence(W, stripe = '#ff3355') {
  const S = W.S - 0.3;
  const m = mat('#ffffff', { map: stripeTex('#ffffff', stripe, 6, true) });
  const postGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.3, 10);
  const capGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const ropeM = mat(stripe);
  const positions = [];
  for (let i = -S; i <= S + 0.01; i += 2.5) {
    positions.push([i, -S], [i, S], [-S, i], [S, i]);
  }
  const posts = new THREE.InstancedMesh(postGeo, m, positions.length);
  const caps = new THREE.InstancedMesh(capGeo, ropeM, positions.length);
  const d = new THREE.Object3D();
  positions.forEach(([x, z], i) => {
    d.position.set(x, 0.65, z); d.updateMatrix(); posts.setMatrixAt(i, d.matrix);
    d.position.set(x, 1.35, z); d.updateMatrix(); caps.setMatrixAt(i, d.matrix);
  });
  posts.castShadow = true;
  W.root.add(posts, caps);
  for (const [x1, z1, x2, z2] of [[-S, -S, S, -S], [-S, S, S, S], [-S, -S, -S, S], [S, -S, S, S]]) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const r = mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 6), ropeM, { shadow: false });
    r.position.set((x1 + x2) / 2, 1.0, (z1 + z2) / 2);
    r.rotation.z = Math.PI / 2;
    if (x1 === x2) r.rotation.set(Math.PI / 2, 0, 0);
    W.root.add(r);
  }
}

export function makeWeather(kind, S) {
  if (!kind) return null;
  const N = kind === 'snow' ? 600 : 260;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const r = rng(99);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (r() - 0.5) * S * 2.4;
    pos[i * 3 + 1] = r() * 18;
    pos[i * 3 + 2] = (r() - 0.5) * S * 2.4;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (kind === 'snow') {
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  } else {
    g.fillStyle = '#ffb7d5'; g.beginPath(); g.ellipse(16, 16, 12, 7, 0.5, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.PointsMaterial({ size: kind === 'snow' ? 0.35 : 0.45, map: tex, transparent: true, depthWrite: false });
  const pts = new THREE.Points(geo, m);
  pts.userData.update = (dt, t) => {
    const a = geo.attributes.position.array;
    const fall = kind === 'snow' ? 1.6 : 1.1;
    for (let i = 0; i < N; i++) {
      a[i * 3 + 1] -= fall * dt;
      a[i * 3] += Math.sin(t + i) * dt * 0.6;
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 16 + r() * 3;
    }
    geo.attributes.position.needsUpdate = true;
  };
  pts.frustumCulled = false;
  return pts;
}

// ============================================================
//  Generic props
// ============================================================
export function tree(W, x, z, s = 1, leaf = '#5cc35a') {
  W.cyl(0.18 * s, 0.25 * s, 1.4 * s, '#8a5a36', x, 0, z, { collide: false, seg: 8 });
  const l = W.sphere(1.1 * s, leaf, x, 2.2 * s, z, { seg: 12 });
  outline(l, 0.03);
  W.sphere(0.75 * s, leaf, x + 0.6 * s, 1.8 * s, z + 0.2 * s, { seg: 10 });
  W.colCircle(x, z, 0.45 * s);
}
export function blossom(W, x, z, s = 1) {
  W.cyl(0.18 * s, 0.28 * s, 1.6 * s, '#6b4432', x, 0, z, { collide: false, seg: 8 });
  const cols = ['#ffc1dc', '#ffb0d0', '#ffd6e8'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    W.sphere(0.8 * s, cols[i % 3], x + Math.cos(a) * 0.7 * s, 2.3 * s + (i % 2) * 0.3, z + Math.sin(a) * 0.7 * s, { seg: 10 });
  }
  W.sphere(0.9 * s, cols[0], x, 2.9 * s, z, { seg: 10 });
  W.colCircle(x, z, 0.45 * s);
}
export function pine(W, x, z, s = 1, snow = false) {
  W.cyl(0.18 * s, 0.22 * s, 0.8 * s, '#6b4432', x, 0, z, { collide: false, seg: 8 });
  for (let i = 0; i < 3; i++) {
    const r = (1.3 - i * 0.35) * s;
    const c = W.cone(r, 1.4 * s, '#2f8f5b', x, (0.7 + i * 0.8) * s, z, { seg: 10 });
    outline(c, 0.03);
    if (snow) W.cone(r * 0.55, 0.6 * s, '#ffffff', x, (1.55 + i * 0.8) * s, z, { seg: 10 });
  }
  W.colCircle(x, z, 0.5 * s);
}
export function palm(W, x, z, h = 4, lean = 0.15) {
  const g = new THREE.Group();
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const m = mesh(new THREE.CylinderGeometry(0.17, 0.22, h / segs + 0.05, 8), mat(i % 2 ? '#a0733f' : '#8b6234'));
    m.position.set(Math.sin(i / segs) * lean * i, (i + 0.5) * (h / segs), 0);
    g.add(m);
  }
  const top = new THREE.Vector3(Math.sin(1) * lean * segs, h, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = mesh(new THREE.SphereGeometry(1, 8, 6), mat(i % 2 ? '#3fae4f' : '#4cc35c'));
    leaf.scale.set(0.35, 0.08, 1.4);
    leaf.position.copy(top).add(new THREE.Vector3(Math.sin(a) * 1.1, -0.25, Math.cos(a) * 1.1));
    leaf.rotation.y = a;
    leaf.rotation.x = 0.35;
    g.add(leaf);
  }
  for (let i = 0; i < 3; i++) {
    const c = mesh(new THREE.SphereGeometry(0.16, 8, 6), mat('#6b4a2a'));
    c.position.copy(top).add(new THREE.Vector3(Math.cos(i * 2) * 0.25, -0.3, Math.sin(i * 2) * 0.25));
    g.add(c);
  }
  W.add(g, x, 0, z);
  W.colCircle(x, z, 0.35);
  g.userData.top = top.clone().add(new THREE.Vector3(x, 0, z));
  return g;
}
export function lamp(W, x, z, color = '#2f3440', glow = '#fff3b0') {
  W.cyl(0.08, 0.12, 3, color, x, 0, z, { seg: 8 });
  W.box(0.4, 0.5, 0.4, color, x, 3, z, { collide: false });
  W.sphere(0.18, glow, x, 3.25, z, { material: basic(glow) });
}
export function bench(W, x, z, rotY = 0, color = '#7a4b2c') {
  const g = new THREE.Group();
  const seat = mesh(new THREE.BoxGeometry(2, 0.12, 0.6), mat(color)); seat.position.y = 0.5; g.add(seat);
  const back = mesh(new THREE.BoxGeometry(2, 0.5, 0.1), mat(color)); back.position.set(0, 0.85, -0.28); g.add(back);
  for (const sx of [-0.85, 0.85]) {
    const leg = mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), mat('#333')); leg.position.set(sx, 0.25, 0); g.add(leg);
  }
  W.add(g, x, 0, z, rotY);
  W.colCircle(x, z, 0.9);
}
export function flowers(W, x, z, n = 7) {
  const cols = ['#ff5d8f', '#ffd23f', '#ffffff', '#b46cff', '#ff8a3d'];
  for (let i = 0; i < n; i++) {
    const a = W.rand() * Math.PI * 2, r = W.rand() * 1.1;
    const fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r;
    W.cyl(0.03, 0.03, 0.4, '#3a9a4a', fx, 0, fz, { collide: false, seg: 4, shadow: false });
    W.sphere(0.13, cols[i % cols.length], fx, 0.45, fz, { seg: 8 });
  }
}
export function bush(W, x, z, s = 1, color = '#4fb556') {
  const b = W.sphere(0.7 * s, color, x, 0.45 * s, z, { sy: 0.8, seg: 10 });
  outline(b, 0.04);
  W.sphere(0.5 * s, color, x + 0.5 * s, 0.35 * s, z + 0.2, { seg: 8 });
  W.colCircle(x, z, 0.75 * s);
}
export function rock(W, x, z, s = 1, color = '#9a9aa3') {
  const m = mesh(new THREE.DodecahedronGeometry(0.7 * s, 0), mat(color));
  m.position.set(x, 0.35 * s, z);
  m.rotation.set(W.rand(), W.rand(), W.rand());
  W.root.add(m);
  W.colCircle(x, z, 0.6 * s);
}
export function cloud(W, x, y, z, s = 1) {
  const g = new THREE.Group();
  const m = mat('#ffffff');
  for (let i = 0; i < 5; i++) {
    const c = mesh(new THREE.SphereGeometry((1 + (i % 2) * 0.4) * s, 10, 8), m, { shadow: false });
    c.position.set((i - 2) * 1.1 * s, (i % 2) * 0.4 * s, 0);
    g.add(c);
  }
  W.add(g, x, y, z);
  dyn(g);
  const speed = 0.3 + W.rand() * 0.4;
  W.animated.push((dt) => { g.position.x += dt * speed; if (g.position.x > 70) g.position.x = -70; });
}
export function building(W, x, z, w, d, h, color, { roof = null, win = null, collide = true, rotY = 0, roofType = 'flat' } = {}) {
  const wt = win || windowsTex(color, '#dff3ff', '#ffe28a', Math.max(2, Math.round(w / 1.4)), Math.max(2, Math.round(h / 1.6)));
  const side = mat('#ffffff', { map: wt });
  const top = mat(roof || color);
  const m = mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, side, side]);
  m.position.set(x, h / 2, z);
  m.rotation.y = rotY;
  outline(m, 0.015);
  W.root.add(m);
  if (roofType === 'gable') {
    const r = mesh(new THREE.CylinderGeometry(0.01, d * 0.72, w + 0.3, 4, 1), mat(roof || '#b5503a'));
    r.rotation.z = Math.PI / 2;
    r.rotation.x = Math.PI / 4;
    r.scale.set(1, 1, 0.6);
    r.position.set(x, h + d * 0.18, z);
    W.root.add(r);
  }
  if (collide) {
    const swap = Math.abs(Math.sin(rotY)) > 0.7;
    W.colBox(x, z, swap ? d : w, swap ? w : d);
  }
  return m;
}
export function car(W, x, z, rotY = 0, color = '#ffcf1f', taxi = false) {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(1.6, 0.7, 3.2), mat(color)); body.position.y = 0.6; outline(body, 0.03); g.add(body);
  const cab = mesh(new THREE.BoxGeometry(1.4, 0.6, 1.7), mat(color)); cab.position.set(0, 1.2, -0.1); g.add(cab);
  const glass = mesh(new THREE.BoxGeometry(1.45, 0.42, 1.5), mat('#9fd6ff')); glass.position.set(0, 1.2, -0.1); g.add(glass);
  for (const [wx, wz] of [[-0.8, 1], [0.8, 1], [-0.8, -1], [0.8, -1]]) {
    const wh = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 12), mat('#222'));
    wh.rotation.z = Math.PI / 2; wh.position.set(wx, 0.33, wz); g.add(wh);
  }
  if (taxi) {
    const sign = mesh(new THREE.BoxGeometry(0.6, 0.25, 0.3), mat('#fff6c2')); sign.position.set(0, 1.6, -0.1); g.add(sign);
    const chk = mesh(new THREE.BoxGeometry(1.62, 0.12, 3.22), mat('#222')); chk.position.y = 0.75; g.add(chk);
  }
  W.add(g, x, 0, z, rotY);
  const swap = Math.abs(Math.sin(rotY)) > 0.7;
  W.colBox(x, z, swap ? 3.2 : 1.6, swap ? 1.6 : 3.2);
  return g;
}
export function billboard(W, x, y, z, w, h, tex, rotY = 0) {
  const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), { shadow: false });
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  W.root.add(m);
  return m;
}
export function waterMat(color = '#4fb6f0') {
  return new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.9 });
}
export function giantLolly(W, x, z, size = 0.9, color = '#ff4f9a', lollyFn) {
  const l = lollyFn(size, color);
  l.position.set(x, size * 2.6, z);
  W.root.add(l);
  W.colCircle(x, z, 0.3);
  return l;
}
export { textTex };

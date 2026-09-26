import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

// ---------- Toon materials ----------
let gradientMap = null;
function getGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([90, 170, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const matCache = new Map();
export function mat(color, opts = {}) {
  if (opts.map) return new THREE.MeshToonMaterial({ color, gradientMap: getGradient(), ...opts });
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: getGradient(), ...opts });
  matCache.set(key, m);
  return m;
}
export function basic(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a1a14, side: THREE.BackSide });
export function outline(mesh, amount = 0.05) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.setScalar(1 + amount);
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.isOutline = true;
  mesh.add(o);
  return mesh;
}

export function mesh(geo, material, { shadow = true, x = 0, y = 0, z = 0 } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

// ---------- Seeded random ----------
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Canvas textures ----------
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const texCache = new Map();
function cached(key, fn) {
  if (!texCache.has(key)) texCache.set(key, fn());
  return texCache.get(key);
}

export function swirlTex(c1 = '#ff4f9a', c2 = '#ffffff', c3 = '#ffd23f') {
  return cached('swirl' + c1 + c2 + c3, () => canvasTex(256, 256, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    g.fillStyle = c2; g.fillRect(0, 0, w, h);
    const cols = [c1, c3, c1, '#5ad1ff'];
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = cols[k];
      g.lineWidth = 20;
      g.beginPath();
      for (let a = 0; a < Math.PI * 7; a += 0.05) {
        const r = 4 + a * 5.6;
        const x = cx + Math.cos(a + k * Math.PI / 2) * r;
        const y = cy + Math.sin(a + k * Math.PI / 2) * r;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  }));
}

export function stripeTex(a = '#ffffff', b = '#ff3355', n = 8, diag = true) {
  return cached('stripe' + a + b + n + diag, () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    const step = w / n;
    for (let i = -n; i < n * 2; i += 2) {
      g.beginPath();
      if (diag) {
        g.moveTo(i * step, 0); g.lineTo((i + 1) * step, 0);
        g.lineTo((i + 1) * step + h, h); g.lineTo(i * step + h, h);
      } else {
        g.rect(i * step, 0, step, h);
      }
      g.fill();
    }
  }, [1, 1]));
}

export function floralTex(bg, dots, leaf = '#8fb58a') {
  return cached('floral' + bg + dots.join(), () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 46; i++) {
      const x = r() * w, y = r() * h;
      g.fillStyle = leaf;
      g.beginPath(); g.ellipse(x + 9, y + 3, 7, 3.5, 0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = dots[i % dots.length];
      g.beginPath(); g.ellipse(x, y, 8, 7, 0, 0, Math.PI * 2); g.fill();
    }
  }, [2, 2]));
}

export function clockTex() {
  return cached('clock', () => canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#c9a86b'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#fbf6e6'; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2d2a26'; g.lineWidth = 8; g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = '#2d2a26';
      g.beginPath(); g.arc(128 + Math.sin(a) * 90, 128 - Math.cos(a) * 90, 7, 0, Math.PI * 2); g.fill();
    }
    g.lineCap = 'round';
    g.lineWidth = 10; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 55); g.stroke();
    g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(180, 128); g.stroke();
  }));
}

export function windowsTex(wall = '#8aa3c7', win = '#dff3ff', lit = '#ffe28a', cols = 4, rows = 8) {
  return cached('win' + wall + win + cols + rows, () => canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const r = rng(cols * 31 + rows);
    const cw = w / cols, rh = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      g.fillStyle = r() < 0.25 ? lit : win;
      g.fillRect(i * cw + cw * 0.18, j * rh + rh * 0.2, cw * 0.64, rh * 0.55);
    }
  }));
}

export function textTex(text, { bg = '#ffffff', fg = '#222', w = 512, h = 256, font = 'bold 110px Fredoka, sans-serif', border = null, emoji = null } = {}) {
  return cached('txt' + text + bg + fg + w + h + font + emoji, () => canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18); }
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font;
    if (emoji) {
      g.font = `${Math.floor(h * 0.55)}px sans-serif`;
      g.fillText(emoji, w * 0.2, h / 2 + 6);
      g.font = font;
      g.fillText(text, w * 0.6, h / 2 + 6);
    } else {
      g.fillText(text, w / 2, h / 2 + 6);
    }
  }));
}

export function groundTex(base, spec, kind = 'dots', rep = 12) {
  return cached('ground' + base + spec + kind + rep, () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = rng(11);
    if (kind === 'cobble') {
      g.strokeStyle = spec; g.lineWidth = 3;
      for (let y = 0; y < h; y += 32) {
        const off = (y / 32) % 2 ? 16 : 0;
        for (let x = -32; x < w; x += 32) {
          g.beginPath(); g.roundRect(x + off + 2, y + 2, 28, 28, 7); g.stroke();
        }
      }
    } else if (kind === 'tiles') {
      g.strokeStyle = spec; g.lineWidth = 3;
      for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    } else {
      for (let i = 0; i < 160; i++) {
        g.fillStyle = spec;
        g.globalAlpha = 0.25 + r() * 0.35;
        g.beginPath(); g.arc(r() * w, r() * h, 1.5 + r() * 3.5, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
  }, [rep, rep]));
}

export function questionTex() {
  return cached('question', () => canvasTex(128, 128, (g) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ff4f9a'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#ff4f9a'; g.font = 'bold 92px Fredoka, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 64, 70);
  }));
}

export function sparkleTex() {
  return cached('sparkle', () => canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,240,170,0.9)');
    grd.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'white';
    g.beginPath(); g.moveTo(32, 2); g.lineTo(36, 28); g.lineTo(62, 32); g.lineTo(36, 36); g.lineTo(32, 62); g.lineTo(28, 36); g.lineTo(2, 32); g.lineTo(28, 28); g.closePath(); g.fill();
  }));
}

export function heartShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.9 * s);
  sh.bezierCurveTo(-0.2 * s, -0.6 * s, -1 * s, -0.2 * s, -1 * s, 0.3 * s);
  sh.bezierCurveTo(-1 * s, 0.85 * s, -0.3 * s, 1 * s, 0, 0.5 * s);
  sh.bezierCurveTo(0.3 * s, 1 * s, 1 * s, 0.85 * s, 1 * s, 0.3 * s);
  sh.bezierCurveTo(1 * s, -0.2 * s, 0.2 * s, -0.6 * s, 0, -0.9 * s);
  return sh;
}

export function starShape(r1 = 1, r2 = 0.45, n = 5) {
  const sh = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  sh.closePath();
  return sh;
}

export const V3 = THREE.Vector3;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function angleDamp(a, b, lambda, dt) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

// ============================================================
//  bakeGroup: merge all simple (untextured, opaque) meshes under
//  `root` into a few vertex-coloured meshes. Massively cuts draw
//  calls on phones/tablets. Subtrees flagged userData.dynamic are
//  left alone (things that animate on their own).
// ============================================================
let bakedToon = null, bakedBasic = null;
const bakeOutline = outlineMat;
function prepGeo(m, rel, color) {
  let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', g.getAttribute('position'));
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  ng.setAttribute('normal', g.getAttribute('normal'));
  ng.applyMatrix4(rel);
  const n = ng.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return ng;
}
export function bakeGroup(root) {
  if (!bakedToon) {
    bakedToon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient() });
    bakedBasic = new THREE.MeshBasicMaterial({ vertexColors: true });
  }
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = { toon: [], basic: [], outline: [] };
  const baked = new Set();
  const rel = new THREE.Matrix4();
  const black = new THREE.Color(0, 0, 0);
  const visit = (obj) => {
    for (const c of obj.children) {
      if (c.userData.dynamic) continue;
      if (c.isMesh && !c.isInstancedMesh && c.visible) {
        const m = c.material;
        let kind = null;
        if (c.userData.isOutline) kind = 'outline';
        else if (!Array.isArray(m) && !m.map && !m.transparent && m.visible !== false && m.side === THREE.FrontSide) {
          if (m.type === 'MeshToonMaterial' && !m.vertexColors) kind = 'toon';
          else if (m.type === 'MeshBasicMaterial' && !m.vertexColors) kind = 'basic';
        }
        if (kind) {
          rel.multiplyMatrices(inv, c.matrixWorld);
          buckets[kind].push({ geo: prepGeo(c, rel, kind === 'outline' ? black : m.color), shadow: c.castShadow });
          baked.add(c);
        }
      }
      if (!c.isSprite && !c.isPoints) visit(c);
    }
  };
  visit(root);
  if (baked.size < 2) return root;
  for (const m of baked) {
    for (const ch of [...m.children]) if (!baked.has(ch)) root.attach(ch);
    m.parent && m.parent.remove(m);
  }
  const addMerged = (list, material, shadow) => {
    if (!list.length) return;
    const geo = mergeGeometries(list.map((x) => x.geo), false);
    list.forEach((x) => x.geo.dispose());
    if (!geo) return;
    const mm = new THREE.Mesh(geo, material);
    mm.castShadow = shadow;
    mm.receiveShadow = shadow && root.userData.receiveShadow !== false;
    mm.userData.baked = true;
    root.add(mm);
  };
  addMerged(buckets.toon, bakedToon, true);
  addMerged(buckets.basic, bakedBasic, false);
  addMerged(buckets.outline, bakeOutline, false);
  return root;
}

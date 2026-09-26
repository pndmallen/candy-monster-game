import * as THREE from 'three';
import { mat, basic, outline, mesh, floralTex, heartShape, swirlTex, starShape, bakeGroup } from './lib.js';

// ============================================================
//  The family (cartoon versions based on the photos)
// ============================================================
export const FAMILY = [
  { id: 'dad', name: 'Dad', realName: 'Peter', color: '#4f8cff', cheer: "Let's go, team!" },
  { id: 'mom', name: 'Mom', realName: 'Pardis', color: '#ff6fb5', cheer: 'Woo-hoo! Here we go!' },
  { id: 'rumia', name: 'Rumia', realName: 'Rumia', color: '#ffb23f', cheer: "I'll find the clue!" },
  { id: 'delana', name: 'Delana', realName: 'Delana', color: '#b46cff', cheer: 'Candy! Candy!' },
];

const Z = new THREE.Vector3(0, 0, 1);
const D = Math.PI / 180;

function dirFrom(yaw, pitch) {
  return new THREE.Vector3(
    Math.sin(yaw * D) * Math.cos(pitch * D),
    Math.sin(pitch * D),
    Math.cos(yaw * D) * Math.cos(pitch * D),
  );
}
function placeOn(parent, obj, R, yaw, pitch, off = 0) {
  const n = dirFrom(yaw, pitch);
  obj.position.copy(n).multiplyScalar(R + off);
  obj.quaternion.setFromUnitVectors(Z, n);
  parent.add(obj);
  return obj;
}
function beam(p1, p2, thick, material) {
  const len = p1.distanceTo(p2);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), material);
  m.position.copy(p1).add(p2).multiplyScalar(0.5);
  m.lookAt(p2);
  return m;
}
function ball(r, color, sx = 1, sy = 1, sz = 1, seg = 18) {
  const m = mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.floor(seg * 0.75))), typeof color === 'string' ? mat(color) : color);
  m.scale.set(sx, sy, sz);
  return m;
}
function capsule(r, len, color) {
  return mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 14), typeof color === 'string' ? mat(color) : color);
}

// ---------- face parts ----------
function makeEye(size, irisColor, lashes = false) {
  const g = new THREE.Group();
  const white = mesh(new THREE.SphereGeometry(size, 20, 14), mat('#ffffff'), { shadow: false });
  white.scale.set(1, 1.2, 0.45);
  g.add(white);
  const iris = mesh(new THREE.SphereGeometry(size * 0.7, 20, 14), mat(irisColor), { shadow: false });
  iris.scale.set(1, 1.1, 0.4);
  iris.position.set(0, -size * 0.1, size * 0.3);
  g.add(iris);
  const pupil = mesh(new THREE.SphereGeometry(size * 0.4, 16, 10), basic('#120a06'), { shadow: false });
  pupil.scale.set(1, 1.1, 0.4);
  pupil.position.set(0, -size * 0.1, size * 0.45);
  g.add(pupil);
  const hi = mesh(new THREE.SphereGeometry(size * 0.2, 10, 8), basic('#ffffff'), { shadow: false });
  hi.position.set(size * 0.25, size * 0.2, size * 0.58);
  g.add(hi);
  const hi2 = mesh(new THREE.SphereGeometry(size * 0.1, 8, 6), basic('#ffffff'), { shadow: false });
  hi2.position.set(-size * 0.22, -size * 0.35, size * 0.55);
  g.add(hi2);
  if (lashes) {
    const lm = basic('#150d0a');
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(size * 0.12, size * 0.45, size * 0.08), lm);
      const a = (-0.2 + i * 0.35);
      l.position.set(Math.sin(a) * size * 0.95, Math.cos(a) * size * 1.15, size * 0.2);
      l.rotation.z = -a * 1.2;
      g.add(l);
    }
  }
  return g;
}

function makeOpenSmile(w, { teeth = true, tongue = true } = {}) {
  const g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(-w, 0);
  sh.absarc(0, 0, w, Math.PI, Math.PI * 2, false);
  sh.lineTo(-w, 0);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 20), basic('#6b1a24'));
  m.scale.y = 0.72;
  g.add(m);
  if (teeth) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.7, w * 0.26), basic('#ffffff'));
    t.position.set(0, -w * 0.13, 0.002);
    g.add(t);
  }
  if (tongue) {
    const tg = new THREE.Mesh(new THREE.CircleGeometry(w * 0.34, 16), basic('#ff7b8e'));
    tg.scale.y = 0.55;
    tg.position.set(0, -w * 0.5, 0.003);
    g.add(tg);
  }
  return g;
}
function makeClosedSmile(w, color = '#7a2530') {
  const m = new THREE.Mesh(new THREE.TorusGeometry(w, w * 0.14, 8, 20, Math.PI), basic(color));
  m.rotation.z = Math.PI;
  return m;
}
function makeBrow(len, thick, color) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(thick, len, 4, 8), basic(color));
  m.rotation.z = Math.PI / 2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}
function blush(r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), basic('#ff8a9a', { transparent: true, opacity: 0.45, depthWrite: false }));
  m.scale.y = 0.65;
  return m;
}

// ============================================================
//  Generic chibi person
// ============================================================
function buildPerson(s) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const hipY = s.legLen + s.legR * 0.45;
  const torsoY = hipY + s.torsoLen / 2 + s.torsoR * 0.35;
  const torsoTop = torsoY + s.torsoLen / 2 + s.torsoR;
  const headY = torsoTop + s.headR * 0.78;

  // ---- legs ----
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * s.hipW, hipY, 0);
    const legMat = s.legColor || s.skin;
    const leg = capsule(s.legR, s.legLen - s.legR * 2, legMat);
    leg.position.y = -s.legLen / 2;
    outline(leg, 0.08);
    pivot.add(leg);
    if (s.shorts) {
      const sh = capsule(s.legR * 1.25, s.legLen * 0.32, s.shorts);
      sh.position.y = -s.legLen * 0.22;
      pivot.add(sh);
    }
    const shoe = ball(s.legR * 1.3, s.shoes, 1, 0.62, 1.55);
    shoe.position.set(0, -s.legLen + s.legR * 0.3, s.legR * 0.45);
    outline(shoe, 0.08);
    pivot.add(shoe);
    if (s.shoeDetail) s.shoeDetail(shoe, pivot, side);
    rig.add(pivot);
    legs.push(pivot);
  }

  // ---- torso ----
  const body = capsule(s.torsoR, s.torsoLen, s.topMat || s.top);
  body.position.y = torsoY;
  body.scale.z = 0.85;
  outline(body, 0.05);
  rig.add(body);
  if (s.bodyExtra) s.bodyExtra(rig, { torsoY, torsoTop, hipY });

  // ---- neck ----
  const neck = mesh(new THREE.CylinderGeometry(s.headR * 0.22, s.headR * 0.24, s.headR * 0.4, 12), mat(s.skin));
  neck.position.y = torsoTop;
  rig.add(neck);

  // ---- arms ----
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (s.torsoR * 0.95 + s.armR * 0.6), torsoTop - s.torsoR * 0.55, 0);
    pivot.rotation.z = side * 0.12;
    const arm = capsule(s.armR, s.armLen - s.armR * 2, s.skin);
    arm.position.y = -s.armLen / 2;
    outline(arm, 0.08);
    pivot.add(arm);
    if (s.sleeve) {
      const sl = capsule(s.armR * 1.28, s.armLen * 0.22, s.sleeve);
      sl.position.y = -s.armLen * 0.18;
      outline(sl, 0.06);
      pivot.add(sl);
    }
    if (s.ruffle) {
      const rf = ball(s.armR * 2.1, s.ruffle, 1, 0.55, 1.1);
      rf.position.y = -s.armR * 0.4;
      pivot.add(rf);
    }
    const hand = ball(s.armR * 1.25, s.skin);
    hand.position.y = -s.armLen - s.armR * 0.2;
    pivot.add(hand);
    rig.add(pivot);
    arms.push(pivot);
  }

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = headY;
  rig.add(head);
  const R = s.headR;
  const skull = ball(R, s.skin, ...(s.headScale || [1, 1, 1]), 40);
  outline(skull, 0.035);
  head.add(skull);

  // ears
  for (const side of [-1, 1]) {
    const ear = ball(R * 0.18, s.skin, 0.6, 1, 0.9);
    placeOn(head, ear, R, side * 88, -6, -0.02);
  }
  // eyes
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = makeEye(R * s.eyeSize, s.iris, s.lashes);
    placeOn(head, eye, R * (s.headScale ? s.headScale[2] : 1), side * s.eyeYaw, s.eyePitch, -R * s.eyeSize * 0.08);
    eyes.push(eye);
  }
  // brows
  for (const side of [-1, 1]) {
    const b = makeBrow(R * s.browLen, R * s.browThick, s.browColor || s.hair);
    placeOn(head, b, R, side * (s.eyeYaw + 1), s.eyePitch + s.browPitch, 0.005);
    b.children[0].rotation.z = Math.PI / 2 + side * (s.browTilt || 0);
  }
  // nose
  const nose = ball(R * 0.075, s.skin, 1, 0.9, 1);
  placeOn(head, nose, R, 0, s.eyePitch - 12, -0.01);
  // mouth
  const mouth = s.smile === 'closed' ? makeClosedSmile(R * s.mouthW) : makeOpenSmile(R * s.mouthW, { teeth: s.teeth !== false });
  placeOn(head, mouth, R * (s.headScale ? s.headScale[2] : 1), 0, s.mouthPitch, 0.012);
  // cheeks
  if (s.blush) {
    for (const side of [-1, 1]) placeOn(head, blush(R * s.blush), R, side * 36, s.eyePitch - 16, 0.012);
  }

  if (s.hairFn) s.hairFn(head, R, s);
  if (s.faceExtra) s.faceExtra(head, R, s);

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = false;
    o.castShadow = !o.userData.isOutline && o.material && o.material.type !== 'MeshBasicMaterial';
  });
  // merge static parts to keep draw calls low (eyes/arms/legs/head animate separately)
  for (const g of [...eyes, ...arms, ...legs]) { bakeGroup(g); g.userData.dynamic = true; }
  bakeGroup(head); head.userData.dynamic = true;
  bakeGroup(rig);
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });

  const height = headY + R;
  const ch = {
    group: root, rig, head, arms, legs, eyes, body, height, spec: s,
    phase: Math.random() * 6, blinkT: 1 + Math.random() * 3, blinkDur: 0,
    state: { speed: 0, airborne: false, celebrate: false, sad: false },
  };
  ch.update = (dt, t) => animatePerson(ch, dt, t);
  root.scale.setScalar(s.scale || 1);
  root.userData.character = ch;
  return ch;
}

function animatePerson(ch, dt, t) {
  const st = ch.state;
  const move = Math.min(1, st.speed / 4);
  ch.phase += dt * (4 + st.speed * 2.2);
  const sw = Math.sin(ch.phase);
  let legA = sw * 0.8 * move;
  let armA = -sw * 0.7 * move;
  let armZ = 0.12;
  ch.rig.position.y = Math.abs(Math.cos(ch.phase)) * 0.07 * move;
  ch.rig.rotation.z = 0;
  ch.head.rotation.x = 0;
  if (st.airborne) {
    legA = 0.5; armA = -2.6; armZ = 0.5;
  }
  if (st.celebrate) {
    const b = Math.abs(Math.sin(t * 7));
    ch.rig.position.y = b * 0.35;
    armA = -2.7 + Math.sin(t * 14) * 0.3;
    armZ = 0.45;
    legA = 0;
  }
  if (st.sad) {
    ch.head.rotation.x = 0.25;
  }
  if (st.wave) {
    ch.arms[1].rotation.x = -2.8;
    ch.arms[1].rotation.z = 0.4 + Math.sin(t * 10) * 0.35;
    ch.arms[0].rotation.x = armA;
    ch.arms[0].rotation.z = -armZ;
  } else {
    ch.arms[0].rotation.x = armA;
    ch.arms[1].rotation.x = st.celebrate ? armA : -armA;
    ch.arms[0].rotation.z = -armZ;
    ch.arms[1].rotation.z = armZ;
  }
  ch.legs[0].rotation.x = legA;
  ch.legs[1].rotation.x = st.airborne ? -0.2 : -legA;
  // idle breathing + little head tilt
  if (move < 0.1 && !st.celebrate) {
    ch.head.rotation.z = Math.sin(t * 1.3 + ch.phase) * 0.05;
    ch.body.scale.y = 1 + Math.sin(t * 2.4) * 0.015;
  } else {
    ch.head.rotation.z = 0;
  }
  // blink
  ch.blinkT -= dt;
  if (ch.blinkT <= 0) { ch.blinkDur = 0.13; ch.blinkT = 2 + Math.random() * 3.5; }
  if (ch.blinkDur > 0) ch.blinkDur -= dt;
  const eyeY = ch.blinkDur > 0 ? 0.1 : 1;
  for (const e of ch.eyes) e.scale.y = eyeY;
}

// ============================================================
//  Individual looks
// ============================================================
function hairShell(head, R, color, { r = 1.06, y = 0.1, z = -0.1, sx = 1, sy = 1, sz = 1 } = {}) {
  const h = ball(R * r, color, sx, sy, sz, 40);
  h.position.set(0, R * y, R * z);
  outline(h, 0.03);
  head.add(h);
  return h;
}

function makeDad() {
  const hair = '#1b1512';
  return buildPerson({
    id: 'dad', scale: 1.0,
    skin: '#e3ab82', hair, iris: '#3a2417',
    top: '#3a3f47', sleeve: '#3a3f47', shorts: '#8d8577', legColor: '#e3ab82', shoes: '#2e3548',
    legLen: 0.6, legR: 0.12, hipW: 0.15, torsoR: 0.34, torsoLen: 0.3,
    headR: 0.5, armLen: 0.52, armR: 0.1,
    eyeSize: 0.15, eyeYaw: 21, eyePitch: 3,
    browLen: 0.2, browThick: 0.035, browPitch: 16, browTilt: -0.08,
    mouthW: 0.24, mouthPitch: -25, blush: 0,
    shoeDetail: (shoe) => {
      const sole = mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.03, 16), mat('#f4f4f4'));
      sole.position.y = -0.065; shoe.add(sole);
    },
    hairFn: (head, R) => {
      hairShell(head, R, hair, { r: 1.06, y: 0.12, z: -0.1 });
      // quiff swept up in front
      for (const [yaw, pitch, sc] of [[-18, 50, 1], [0, 54, 1.15], [18, 50, 1], [-8, 60, 0.9], [10, 60, 0.9]]) {
        const q = ball(R * 0.22 * sc, hair, 1.2, 0.7, 1);
        placeOn(head, q, R, yaw, pitch, R * 0.04);
        q.rotateX(-0.5);
      }
      // sideburns
      for (const side of [-1, 1]) {
        const sb = ball(R * 0.12, hair, 0.5, 1.4, 0.8);
        placeOn(head, sb, R, side * 72, 8, -0.01);
      }
    },
    faceExtra: (head, R) => {
      // light stubble
      const stub = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.008, 28, 14, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.6, Math.PI * 0.28),
        new THREE.MeshBasicMaterial({ color: '#3a2a22', transparent: true, opacity: 0.12, depthWrite: false }),
      );
      head.add(stub);
      // rectangular glasses
      const gm = mat('#26262c');
      const lensW = R * 0.36, lensH = R * 0.25, t = R * 0.035;
      const eyeX = R * Math.sin(21 * D), zF = R * 1.1, yC = R * 0.05;
      const glasses = new THREE.Group();
      for (const side of [-1, 1]) {
        const lens = new THREE.Group();
        const parts = [
          [lensW + t, t, t, 0, lensH / 2], [lensW + t, t, t, 0, -lensH / 2],
          [t, lensH, t, -lensW / 2, 0], [t, lensH, t, lensW / 2, 0],
        ];
        for (const [w, h, d, x, y] of parts) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gm);
          b.position.set(x, y, 0);
          lens.add(b);
        }
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(lensW, lensH), new THREE.MeshBasicMaterial({ color: '#d8efff', transparent: true, opacity: 0.22, depthWrite: false }));
        lens.add(glass);
        lens.position.set(side * eyeX * 1.05, yC, zF - Math.abs(eyeX) * 0.25);
        lens.rotation.y = side * 0.28;
        glasses.add(lens);
        // temple arm back to the ear
        const outer = new THREE.Vector3(side * (eyeX * 1.05 + lensW / 2 * Math.cos(0.28)), yC + lensH * 0.3, zF - Math.abs(eyeX) * 0.25 - (lensW / 2) * Math.sin(0.28));
        const ear = new THREE.Vector3(side * R * 1.0, yC, -R * 0.1);
        glasses.add(beam(outer, ear, t * 0.9, gm));
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(eyeX * 2 - lensW * 0.95, t, t), gm);
      bridge.position.set(0, yC + lensH * 0.2, zF - 0.01);
      glasses.add(bridge);
      head.add(glasses);
    },
  });
}

function makeMom() {
  const hair = '#17110e';
  return buildPerson({
    id: 'mom', scale: 0.98,
    skin: '#f1c6a6', hair, iris: '#3b2416', lashes: true,
    top: '#1e1f25', legColor: '#f1eee8', shoes: '#dcae3f',
    legLen: 0.66, legR: 0.105, hipW: 0.13, torsoR: 0.27, torsoLen: 0.34,
    headR: 0.47, armLen: 0.5, armR: 0.085,
    eyeSize: 0.16, eyeYaw: 21, eyePitch: 3,
    browLen: 0.22, browThick: 0.03, browPitch: 17, browTilt: 0.12,
    mouthW: 0.25, mouthPitch: -24, blush: 0.12,
    shoeDetail: (shoe) => {
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.08), mat('#d8323a'));
      lace.position.set(0, 0.075, 0.03); shoe.add(lace);
    },
    bodyExtra: (rig, { torsoTop }) => {
      // tank-top straps
      for (const side of [-1, 1]) {
        const st = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.2), mat('#1e1f25'));
        st.position.set(side * 0.15, torsoTop - 0.05, 0);
        rig.add(st);
      }
      // gold necklace + name-plate pendant
      const neck = mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 30), mat('#f3c64a'), { shadow: false });
      neck.rotation.x = Math.PI / 2 - 0.5;
      neck.position.set(0, torsoTop - 0.02, 0.03);
      rig.add(neck);
      const pend = mesh(new THREE.BoxGeometry(0.1, 0.035, 0.02), mat('#f3c64a'), { shadow: false });
      pend.position.set(0, torsoTop - 0.1, 0.22);
      rig.add(pend);
    },
    hairFn: (head, R) => {
      hairShell(head, R, hair, { r: 1.05, y: 0.14, z: -0.13, sx: 1.02 });
      // pulled-back bun + ponytail
      const bun = ball(R * 0.34, hair);
      bun.position.set(0, R * 0.45, -R * 0.9);
      outline(bun, 0.05);
      head.add(bun);
      const tail = capsule(R * 0.17, R * 0.9, hair);
      tail.position.set(0, -R * 0.15, -R * 1.12);
      tail.rotation.x = 0.25;
      head.add(tail);
      // headband
      const band = mesh(new THREE.TorusGeometry(R * 1.07, R * 0.07, 8, 32, Math.PI), mat('#e9e3dc'));
      band.rotation.x = 0.55;
      band.scale.set(1, 1, 1.4);
      head.add(band);
      // heart-shaped sunglasses pushed up on her head
      const sg = new THREE.Group();
      const frameM = mat('#9a3b2a');
      const lensM = new THREE.MeshBasicMaterial({ color: '#f38aa6', transparent: true, opacity: 0.85 });
      for (const side of [-1, 1]) {
        const shp = heartShape(R * 0.17);
        const f = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: R * 0.04, bevelEnabled: false }), frameM);
        f.position.x = side * R * 0.22;
        sg.add(f);
        const l = new THREE.Mesh(new THREE.ShapeGeometry(heartShape(R * 0.13)), lensM);
        l.position.set(side * R * 0.22, 0, R * 0.045);
        sg.add(l);
      }
      placeOn(head, sg, R, 0, 60, R * 0.12);
      sg.rotateX(0.8);
    },
    faceExtra: (head, R) => {
      for (const side of [-1, 1]) {
        const hoop = mesh(new THREE.TorusGeometry(R * 0.07, R * 0.018, 6, 16), mat('#f3c64a'), { shadow: false });
        placeOn(head, hoop, R, side * 86, -26, R * 0.02);
        hoop.rotateY(Math.PI / 2);
      }
    },
  });
}

function makeRumia() {
  const hair = '#2a1a12';
  const dress = floralTex('#fbf0dc', ['#f2b25a', '#f6d36c', '#ec8f7c'], '#86a883');
  const dressMat = mat('#ffffff', { map: dress });
  return buildPerson({
    id: 'rumia', scale: 0.86,
    skin: '#e8b793', hair, iris: '#2e1a10',
    topMat: dressMat, ruffle: dressMat, legColor: '#e8b793', shoes: '#d9dbe6',
    legLen: 0.38, legR: 0.085, hipW: 0.1, torsoR: 0.21, torsoLen: 0.16,
    headR: 0.46, armLen: 0.32, armR: 0.066,
    eyeSize: 0.2, eyeYaw: 23, eyePitch: -3, lashes: true,
    browLen: 0.18, browThick: 0.028, browPitch: 17, browTilt: 0.05,
    mouthW: 0.17, mouthPitch: -25, blush: 0.14,
    bodyExtra: (rig, { torsoY }) => {
      const skirt = mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.34, 24, 1), dressMat);
      skirt.position.y = torsoY - 0.2;
      outline(skirt, 0.04);
      rig.add(skirt);
      const hem = mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 32), mat('#f7c9a7'));
      hem.rotation.x = Math.PI / 2;
      hem.position.y = torsoY - 0.37;
      rig.add(hem);
    },
    hairFn: (head, R) => {
      hairShell(head, R, hair, { r: 1.08, y: 0.13, z: -0.15, sx: 1.06, sz: 1.04 });
      // long curly hair cascading down the back and sides
      const rnd = mulberry(5);
      const hm = mat(hair);
      for (let row = 0; row < 7; row++) {
        const y = R * (0.15 - row * 0.3);
        const below = row >= 3;
        const rad = R * (row < 3 ? 1.02 : 0.95 - (row - 3) * 0.03);
        const a0 = below ? 100 : 84, a1 = below ? 260 : 276;
        for (let a = a0; a <= a1; a += 20) {
          const ang = (a + (rnd() - 0.5) * 10) * D;
          const c = mesh(new THREE.SphereGeometry(R * (0.2 + rnd() * 0.07), 10, 8), hm);
          c.position.set(Math.sin(ang) * rad, y + (rnd() - 0.5) * R * 0.12, Math.cos(ang) * rad - R * 0.05);
          head.add(c);
        }
      }
      // little half-up ponytail with pink hair tie
      const tie = mesh(new THREE.TorusGeometry(R * 0.1, R * 0.04, 6, 14), mat('#ff4f7b'));
      placeOn(head, tie, R * 1.08, 0, 42, R * 0.02);
      tie.position.z -= R * 0.55; tie.position.y += R * 0.1;
      const puff = ball(R * 0.2, hair);
      puff.position.set(0, R * 0.95, -R * 0.62);
      head.add(puff);
    },
    faceExtra: (head, R) => {
      for (const side of [-1, 1]) {
        const stud = ball(R * 0.035, '#f6d26b');
        placeOn(head, stud, R, side * 88, -22, R * 0.05);
      }
    },
  });
}

function makeDelana() {
  const hair = '#3a2416';
  const topTex = floralTex('#fffaf3', ['#f4b3c6', '#f7d774', '#a9cdef'], '#9cc39a');
  const topMat = mat('#ffffff', { map: topTex });
  return buildPerson({
    id: 'delana', scale: 0.76,
    skin: '#efc39f', hair, iris: '#2d190f',
    topMat, ruffle: topMat, legColor: '#efc39f', shoes: '#e7c38f',
    legLen: 0.29, legR: 0.085, hipW: 0.09, torsoR: 0.22, torsoLen: 0.1,
    headR: 0.46, armLen: 0.26, armR: 0.07, headScale: [1.06, 0.97, 1],
    eyeSize: 0.22, eyeYaw: 24, eyePitch: -6,
    browLen: 0.16, browThick: 0.025, browPitch: 17, browTilt: -0.05,
    mouthW: 0.12, mouthPitch: -27, blush: 0.16, teeth: false,
    bodyExtra: (rig, { torsoY }) => {
      // pink tutu
      const tm = mat('#ff9cc0', { transparent: true, opacity: 0.92 });
      const t1 = mesh(new THREE.CylinderGeometry(0.24, 0.46, 0.18, 24, 1), tm);
      t1.position.y = torsoY - 0.1;
      rig.add(t1);
      const t2 = mesh(new THREE.CylinderGeometry(0.3, 0.52, 0.14, 24, 1), mat('#ffb3cf', { transparent: true, opacity: 0.85 }));
      t2.position.y = torsoY - 0.2;
      rig.add(t2);
      const r = mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 28), mat('#ffc3da'));
      r.rotation.x = Math.PI / 2;
      r.position.y = torsoY - 0.27;
      rig.add(r);
    },
    hairFn: (head, R) => {
      hairShell(head, R, hair, { r: 1.07, y: 0.08, z: -0.1, sx: 1.08 });
      // straight bangs
      const bangs = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.075, 28, 12, Math.PI / 2 - 0.95, 1.9, 18 * D, 50 * D),
        mat(hair, { side: THREE.DoubleSide }),
      );
      bangs.scale.set(1.06, 0.97, 1);
      head.add(bangs);
      // chin-length sides + back
      for (const side of [-1, 1]) {
        const lock = capsule(R * 0.2, R * 0.55, hair);
        lock.position.set(side * R * 0.86, -R * 0.2, -R * 0.12);
        lock.rotation.z = side * 0.12;
        head.add(lock);
      }
      const back = ball(R * 0.95, hair, 1.08, 0.75, 0.8);
      back.position.set(0, -R * 0.25, -R * 0.35);
      head.add(back);
      // top-knot "pineapple" with pink hair tie
      const tie = mesh(new THREE.TorusGeometry(R * 0.11, R * 0.045, 6, 14), mat('#ff4f7b'));
      tie.rotation.x = Math.PI / 2;
      tie.position.set(0, R * 1.08, R * 0.05);
      head.add(tie);
      const hm = mat(hair);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = mesh(new THREE.SphereGeometry(R * 0.09, 8, 6), hm);
        sp.scale.set(0.8, 2.4, 0.8);
        sp.position.set(Math.cos(a) * R * 0.1, R * 1.3, R * 0.05 + Math.sin(a) * R * 0.1);
        sp.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        head.add(sp);
      }
    },
    faceExtra: (head, R) => {
      for (const side of [-1, 1]) {
        const star = mesh(new THREE.ShapeGeometry(starShape(R * 0.06, R * 0.028)), basic('#f6d26b'));
        placeOn(head, star, R, side * 86, -24, R * 0.06);
      }
    },
  });
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAKERS = { dad: makeDad, mom: makeMom, rumia: makeRumia, delana: makeDelana };
export function makeCharacter(id) {
  const ch = MAKERS[id]();
  ch.id = id;
  ch.info = FAMILY.find((f) => f.id === id);
  return ch;
}

// ============================================================
//  The Candy Monster (original design: fuzzy, purple, sweet-toothed)
// ============================================================
export function makeMonster() {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const body = mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshLambertMaterial({ color: '#a970ff', flatShading: true }));
  body.position.y = 1.25;
  body.scale.set(1, 1.05, 0.95);
  outline(body, 0.03);
  rig.add(body);

  const belly = ball(0.72, '#ffe6a6', 1, 1.05, 0.45);
  belly.position.set(0, 1.05, 0.72);
  rig.add(belly);

  // rainbow sprinkles
  const cols = ['#ff4f9a', '#ffd23f', '#5ad1ff', '#7cff6b', '#ff8a3d', '#ffffff'];
  const r = mulberry(3);
  for (let i = 0; i < 40; i++) {
    const n = new THREE.Vector3(r() - 0.5, r() * 0.9 + 0.1, r() - 0.5).normalize();
    if (n.z > 0.45 && n.y < 0.5) continue; // keep the belly clear
    const sp = mesh(new THREE.CapsuleGeometry(0.035, 0.12, 3, 6), basic(cols[i % cols.length]), { shadow: false });
    sp.position.copy(n).multiplyScalar(1.02);
    sp.position.y = sp.position.y * 1.05 + 1.25;
    sp.rotation.set(r() * 3, r() * 3, r() * 3);
    rig.add(sp);
  }

  const head = new THREE.Group();
  head.position.y = 1.25;
  rig.add(head);
  const eyes = [];
  for (const side of [-1, 1]) {
    const e = makeEye(0.26, '#3bb54a');
    placeOn(head, e, 1.0, side * 24, 32, -0.02);
    eyes.push(e);
    const brow = makeBrow(0.2, 0.05, '#5b2ca8');
    placeOn(head, brow, 1.0, side * 26, 50, 0.02);
    brow.children[0].rotation.z = Math.PI / 2 - side * 0.3;
  }
  const mouth = makeOpenSmile(0.42, { teeth: false });
  placeOn(head, mouth, 1.0, 0, 2, 0.075);
  for (const side of [-1, 1]) {
    const fang = mesh(new THREE.ConeGeometry(0.07, 0.14, 8), mat('#ffffff'), { shadow: false });
    fang.rotation.x = Math.PI;
    fang.position.set(side * 0.2, 0.03 - 0.07, 0);
    mouth.add(fang);
  }
  // candy-corn horns
  for (const side of [-1, 1]) {
    const horn = new THREE.Group();
    const seg = [['#ffd23f', 0.2, 0.15, 0.14], ['#ff8a3d', 0.15, 0.08, 0.16], ['#ffffff', 0.08, 0.0, 0.14]];
    let y = 0;
    for (const [c, r1, r2, h] of seg) {
      const m = mesh(new THREE.CylinderGeometry(r2, r1, h, 10), mat(c));
      m.position.y = y + h / 2;
      y += h;
      horn.add(m);
    }
    placeOn(head, horn, 1.0, side * 38, 62, -0.05);
    horn.rotateX(Math.PI / 2);
  }
  // arms
  const arms = [];
  for (const side of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(side * 0.92, 1.35, 0);
    const a = capsule(0.17, 0.45, '#a970ff');
    a.position.y = -0.35;
    outline(a, 0.06);
    p.add(a);
    const h = ball(0.22, '#8f55f0');
    h.position.y = -0.7;
    p.add(h);
    p.rotation.z = side * 0.5;
    rig.add(p);
    arms.push(p);
  }
  // lollipop in hand
  const lolly = makeLollipop(0.35, '#ff4f9a');
  lolly.position.set(0, -0.75, 0.15);
  lolly.rotation.x = -0.3;
  arms[1].add(lolly);
  // feet
  const feet = [];
  for (const side of [-1, 1]) {
    const f = ball(0.3, '#ff9e4a', 1, 0.55, 1.4);
    f.position.set(side * 0.45, 0.15, 0.15);
    outline(f, 0.06);
    rig.add(f);
    feet.push(f);
  }
  // candy sack on the back
  const sack = ball(0.65, '#b5824a', 1, 1.1, 0.9);
  sack.position.set(0, 1.6, -1.05);
  outline(sack, 0.04);
  rig.add(sack);
  const knot = mesh(new THREE.ConeGeometry(0.18, 0.3, 8), mat('#9a6a38'));
  knot.position.set(0, 2.35, -1.05);
  rig.add(knot);
  for (let i = 0; i < 3; i++) {
    const c = makeLollipop(0.14, ['#5ad1ff', '#ffd23f', '#7cff6b'][i]);
    c.position.set(-0.2 + i * 0.2, 2.35, -0.95);
    c.rotation.z = -0.4 + i * 0.4;
    rig.add(c);
  }

  root.traverse((o) => { if (o.isMesh) { o.receiveShadow = false; o.castShadow = !o.userData.isOutline; } });
  for (const g of [...eyes, ...arms, ...feet]) { bakeGroup(g); g.userData.dynamic = true; }
  bakeGroup(head); head.userData.dynamic = true;
  bakeGroup(rig);
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });

  const m = { group: root, rig, eyes, arms, feet, head, phase: 0, blinkT: 2, state: { speed: 0, happy: false, sad: false } };
  m.update = (dt, t) => {
    const move = Math.min(1, m.state.speed / 3);
    m.phase += dt * (3 + m.state.speed * 2);
    rig.position.y = Math.abs(Math.sin(m.phase)) * 0.15 * (0.3 + move);
    rig.rotation.z = Math.sin(m.phase) * 0.08 * (0.3 + move);
    feet[0].position.z = 0.15 + Math.sin(m.phase) * 0.25 * move;
    feet[1].position.z = 0.15 - Math.sin(m.phase) * 0.25 * move;
    if (m.state.happy) {
      arms[0].rotation.z = -2.2 + Math.sin(t * 8) * 0.3;
      arms[1].rotation.z = 2.2 - Math.sin(t * 8) * 0.3;
      rig.position.y = Math.abs(Math.sin(t * 6)) * 0.4;
    } else {
      arms[0].rotation.z = -0.5 - Math.sin(m.phase) * 0.2;
      arms[1].rotation.z = 0.5 + Math.sin(m.phase) * 0.2;
    }
    head.rotation.x = m.state.sad ? 0.2 : 0;
    m.blinkT -= dt;
    const blink = m.blinkT < 0.12;
    if (m.blinkT < 0) m.blinkT = 2 + Math.random() * 3;
    for (const e of eyes) e.scale.y = blink ? 0.1 : 1;
  };
  return m;
}

// ============================================================
//  Sour Gummy blob (hard-mode helper of the monster)
// ============================================================
export function makeGummy(color = '#57e36b') {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const b = mesh(new THREE.SphereGeometry(0.55, 20, 14), mat(color, { transparent: true, opacity: 0.88 }));
  b.scale.set(1, 0.85, 1);
  b.position.y = 0.47;
  outline(b, 0.05);
  rig.add(b);
  const head = new THREE.Group();
  head.position.y = 0.47;
  rig.add(head);
  for (const side of [-1, 1]) {
    const e = makeEye(0.12, '#222');
    placeOn(head, e, 0.55, side * 25, 15, -0.03);
    const br = makeBrow(0.12, 0.03, '#222');
    placeOn(head, br, 0.55, side * 25, 35, 0.01);
    br.children[0].rotation.z = Math.PI / 2 - side * 0.45;
  }
  const mouth = makeClosedSmile(0.1, '#222');
  placeOn(head, mouth, 0.55, 0, -12, 0.01);
  mouth.rotation.z += Math.PI;
  bakeGroup(rig);
  const g = { group: root, rig, phase: Math.random() * 6 };
  g.update = (dt) => {
    g.phase += dt * 7;
    const s = Math.abs(Math.sin(g.phase));
    rig.position.y = s * 0.45;
    rig.scale.set(1 + (1 - s) * 0.15, 1 - (1 - s) * 0.15, 1 + (1 - s) * 0.15);
  };
  return g;
}

// ============================================================
//  Lollipop helper (used everywhere)
// ============================================================
const lollyMats = new Map();
function lollyFaceMat(color) {
  if (!lollyMats.has(color)) lollyMats.set(color, mat('#ffffff', { map: swirlTex(color) }));
  return lollyMats.get(color);
}
export function makeLollipop(size = 0.3, color = '#ff4f9a') {
  const g = new THREE.Group();
  const stick = mesh(new THREE.CylinderGeometry(size * 0.08, size * 0.08, size * 2.6, 6), mat('#ffffff'));
  stick.position.y = -size * 1.3;
  g.add(stick);
  const face = lollyFaceMat(color);
  const candy = mesh(new THREE.CylinderGeometry(size, size, size * 0.35, 24), [mat(color), face, face]);
  candy.rotation.x = Math.PI / 2;
  g.add(candy);
  return g;
}

// ============================================================
//  Portrait snapshots (for menus + HUD)
// ============================================================
export function renderPortraits() {
  const out = {};
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) {
    return out;
  }
  r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffe0f0, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6);
  dl.position.set(2, 4, 5);
  scene.add(dl);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const shots = [...FAMILY.map((f) => f.id), 'monster'];
  for (const id of shots) {
    const ch = id === 'monster' ? makeMonster() : makeCharacter(id);
    ch.group.rotation.y = id === 'monster' ? 0 : 0.28;
    if (ch.state) ch.state.speed = 0;
    ch.update(0.016, 0);
    for (const e of ch.eyes || []) e.scale.y = 1;
    scene.add(ch.group);
    const s = ch.group.scale.x;
    const h = id === 'monster' ? 2.5 : ch.height * s;
    const headY = id === 'monster' ? 1.5 : (ch.head.position.y) * s;
    const headR = id === 'monster' ? 1.2 : ch.spec.headR * s;
    // face shot
    r.setSize(256, 256, false);
    cam.aspect = 1; cam.fov = 26; cam.updateProjectionMatrix();
    cam.position.set(0.35 * headR, headY + headR * 0.1, headR * 6.6);
    cam.lookAt(0, headY - headR * 0.05, 0);
    r.render(scene, cam);
    const face = r.domElement.toDataURL('image/png');
    // full body shot
    r.setSize(240, 320, false);
    cam.aspect = 240 / 320; cam.fov = 30; cam.updateProjectionMatrix();
    cam.position.set(0.6, h * 0.55, h * 2.35 + 0.5);
    cam.lookAt(0, h * 0.5, 0);
    r.render(scene, cam);
    const full = r.domElement.toDataURL('image/png');
    out[id] = { face, full };
    scene.remove(ch.group);
  }
  r.dispose();
  try { r.forceContextLoss(); } catch (e) { /* */ }
  return out;
}

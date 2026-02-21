/**
 * ringBuilder.js — procedural Enterprise-D circular corridor ring geometry.
 *
 * Performance budget (Quest 3 / 3S):
 *   • ~30 draw calls  (InstancedMesh for lights / panels / wall insets)
 *   • ≤ 3 scene lights  (HemisphereLight + 2 PointLights, no shadows)
 *   • MeshStandardMaterial (high roughness, matte)
 *   • Canvas textures ≤ 512 px, reused via material sharing
 *
 * Construction:
 *   Shell = 4 continuous ring meshes (floor, inner wall, outer wall, arch ceiling)
 *   Decorative repeats = InstancedMesh (ceiling lights, wall panels)
 *   Doors / LCARS = small individual groups
 *
 * Returns { root, resources } where resources holds refs for animation.
 */

import * as THREE from 'three';
import { RING, TAU }               from './ringConfig.js';
import {
  createCarpetTexture,
  createWallTexture,
  createLCARSPanelTexture,
} from './textures.js';

// ── Helpers ──────────────────────────────────────────────────────────────

const _obj = new THREE.Object3D();

function makeMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.82,
    metalness: opts.metalness ?? 0,
    side:      opts.side ?? THREE.FrontSide,
    ...opts,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC — buildCorridorRing()
// ═══════════════════════════════════════════════════════════════════════════

export function buildCorridorRing() {
  const root = new THREE.Group();
  const P    = RING.palette;

  // Shared wall texture (one canvas, two material instances for side differ)
  const wallTex = createWallTexture(P.wall);

  const mats = {
    carpet:    makeMat(P.carpet,    { roughness: 0.92, map: createCarpetTexture(P.carpet) }),
    wallInner: makeMat(P.wall,      { roughness: 0.78, map: wallTex }),
    wallOuter: makeMat(P.wall,      { roughness: 0.78, side: THREE.BackSide, map: wallTex }),
    wallTrim:  makeMat(P.wallTrim,  { roughness: 0.5, metalness: 0.15 }),
    wallPanel: makeMat(P.wallPanel, { roughness: 0.65 }),
    ceiling:   makeMat(P.ceiling,   { roughness: 0.7 }),
    ceilLight: new THREE.MeshStandardMaterial({
      color: P.ceilLight, emissive: P.ceilLight, emissiveIntensity: 1.2,
    }),
    doorFrame: makeMat(P.doorFrame, { roughness: 0.4, metalness: 0.5 }),
    doorPanel: makeMat(P.doorPanel, { roughness: 0.5 }),
  };

  const doors = [];
  const resources = {
    doors,
    mats,
    ceilLightMat: mats.ceilLight,
    accentLights: [],
  };

  // ── Build all sections ────────────────────────────────────────────────
  root.add(buildFloor(mats));
  root.add(buildWalls(mats));
  root.add(buildCeiling(mats));
  root.add(buildTrimBands(mats));
  root.add(buildCeilingLights(mats));
  root.add(buildWallPanels(mats));
  root.add(buildLCARSPanels());
  root.add(buildDoors(mats, doors));
  buildLighting(root, resources);

  return { root, resources };
}

// ═══════════════════════════════════════════════════════════════════════════
//  FLOOR
// ═══════════════════════════════════════════════════════════════════════════

function buildFloor(mats) {
  const geo = new THREE.RingGeometry(RING.innerR, RING.outerR, RING.segments);
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, mats.carpet);
}

// ═══════════════════════════════════════════════════════════════════════════
//  WALLS (inner = FrontSide, outer = BackSide)
// ═══════════════════════════════════════════════════════════════════════════

function buildWalls(mats) {
  const g = new THREE.Group();
  const { innerR, outerR, wallHeight, segments } = RING;

  // Inner wall — we stand outside it looking at FrontSide
  const innerGeo = new THREE.CylinderGeometry(
    innerR, innerR, wallHeight, segments, 1, true,
  );
  const inner = new THREE.Mesh(innerGeo, mats.wallInner);
  inner.position.y = wallHeight / 2;
  g.add(inner);

  // Outer wall — we stand inside it looking at BackSide
  const outerGeo = new THREE.CylinderGeometry(
    outerR, outerR, wallHeight, segments, 1, true,
  );
  const outer = new THREE.Mesh(outerGeo, mats.wallOuter);
  outer.position.y = wallHeight / 2;
  g.add(outer);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CEILING — arched BufferGeometry swept around the ring
// ═══════════════════════════════════════════════════════════════════════════

function buildCeiling(mats) {
  const { innerR, outerR, wallHeight, archHeight, segments, archRes } = RING;

  const positions = [];
  const uvs       = [];
  const indices   = [];

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * TAU;
    const sinT  = Math.sin(theta);
    const cosT  = Math.cos(theta);

    for (let j = 0; j <= archRes; j++) {
      const t = j / archRes;                           // 0 = inner, 1 = outer
      const r = innerR + t * (outerR - innerR);
      const y = wallHeight + archHeight * Math.sin(Math.PI * t);
      positions.push(sinT * r, y, cosT * r);
      uvs.push(i / segments, t);
    }
  }

  // Wind triangles for downward-facing normals (visible from corridor below)
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < archRes; j++) {
      const a = i * (archRes + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (archRes + 1) + j;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return new THREE.Mesh(geo, mats.ceiling);
}

// ═══════════════════════════════════════════════════════════════════════════
//  TRIM BANDS — 4 toroidal accent strips at 0.4 m and 1.6 m on each wall
// ═══════════════════════════════════════════════════════════════════════════

function buildTrimBands(mats) {
  const g = new THREE.Group();
  const { innerR, outerR, segments, trimLow, trimHigh } = RING;

  const addBand = (r, y) => {
    const geo = new THREE.TorusGeometry(r, 0.035, 8, segments);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mats.wallTrim);
    mesh.position.y = y;
    g.add(mesh);
  };

  // Inner wall bands (slightly proud of wall surface)
  addBand(innerR + 0.015, trimLow);
  addBand(innerR + 0.015, trimHigh);

  // Outer wall bands
  addBand(outerR - 0.015, trimLow);
  addBand(outerR - 0.015, trimHigh);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CEILING LIGHT STRIPS  (InstancedMesh — one per segment)
// ═══════════════════════════════════════════════════════════════════════════

function buildCeilingLights(mats) {
  const N      = RING.segCount;
  const segArc = TAU * RING.radius / N;
  const stripL = segArc * 0.70;   // length along corridor (tangent)

  // Box: tangent (X) × thin (Y) × narrow across corridor (Z)
  const geo    = new THREE.BoxGeometry(stripL, 0.03, 0.14);
  const lights = new THREE.InstancedMesh(geo, mats.ceilLight, N);

  for (let i = 0; i < N; i++) {
    const theta = ((i + 0.5) / N) * TAU;       // centred between rib positions
    _obj.position.set(
      Math.sin(theta) * RING.radius,
      RING.wallHeight + RING.archHeight - 0.025,
      Math.cos(theta) * RING.radius,
    );
    _obj.rotation.set(0, theta, 0);
    _obj.scale.set(1, 1, 1);
    _obj.updateMatrix();
    lights.setMatrixAt(i, _obj.matrix);
  }
  lights.instanceMatrix.needsUpdate = true;
  return lights;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WALL PANEL INSETS  (InstancedMesh × 2 — inner + outer walls)
// ═══════════════════════════════════════════════════════════════════════════

function buildWallPanels(mats) {
  const g = new THREE.Group();
  const N = RING.segCount;
  const { innerR, outerR, trimLow, trimHigh } = RING;

  const panelH    = trimHigh - trimLow - 0.08;      // panel height between bands
  const midY      = (trimLow + trimHigh) / 2;
  const innerArcW = (TAU * innerR / N) * 0.82;
  const outerArcW = (TAU * outerR / N) * 0.82;

  // ── Inner wall panels (face outward — away from ring centre) ──────────
  const innerGeo    = new THREE.PlaneGeometry(innerArcW, panelH);
  const innerPanels = new THREE.InstancedMesh(innerGeo, mats.wallPanel, N);

  for (let i = 0; i < N; i++) {
    const theta = ((i + 0.5) / N) * TAU;
    _obj.position.set(
      Math.sin(theta) * (innerR + 0.025),
      midY,
      Math.cos(theta) * (innerR + 0.025),
    );
    _obj.rotation.set(0, theta, 0);         // +Z faces outward at this angle
    _obj.scale.set(1, 1, 1);
    _obj.updateMatrix();
    innerPanels.setMatrixAt(i, _obj.matrix);
  }
  innerPanels.instanceMatrix.needsUpdate = true;
  g.add(innerPanels);

  // ── Outer wall panels (face inward — toward ring centre) ──────────────
  const outerGeo    = new THREE.PlaneGeometry(outerArcW, panelH);
  const outerPanels = new THREE.InstancedMesh(outerGeo, mats.wallPanel, N);

  for (let i = 0; i < N; i++) {
    const theta = ((i + 0.5) / N) * TAU;
    _obj.position.set(
      Math.sin(theta) * (outerR - 0.025),
      midY,
      Math.cos(theta) * (outerR - 0.025),
    );
    _obj.rotation.set(0, theta + Math.PI, 0); // +Z faces inward
    _obj.scale.set(1, 1, 1);
    _obj.updateMatrix();
    outerPanels.setMatrixAt(i, _obj.matrix);
  }
  outerPanels.instanceMatrix.needsUpdate = true;
  g.add(outerPanels);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  LCARS PANELS  (individual — each has unique label texture)
// ═══════════════════════════════════════════════════════════════════════════

function buildLCARSPanels() {
  const g = new THREE.Group();
  const N = RING.segCount;

  // Door segment indices (to avoid overlap)
  const doorSegs = new Set();
  for (let d = 0; d < Math.floor(N / RING.doorEvery); d++) {
    doorSegs.add(d * RING.doorEvery);
  }

  const labels   = ['DECK 7', 'SYSTEMS', 'DIRECTORY', 'JUNCTION',
                     'LIFE SUPPORT', 'TURBOLIFT MAP'];
  let labelIdx   = 0;
  const offset   = Math.floor(RING.doorEvery / 2);      // shift away from doors

  for (let i = 0; i < N; i += RING.lcarsEvery) {
    const seg = (i + offset) % N;
    if (doorSegs.has(seg)) continue;

    const theta = ((seg + 0.5) / N) * TAU;
    const label = labels[labelIdx++ % labels.length];

    const tex  = createLCARSPanelTexture(label, 256);
    const mat  = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.50, 0.35), mat);

    // Place on inner wall, face outward toward corridor
    mesh.position.set(
      Math.sin(theta) * (RING.innerR + 0.04),
      1.3,
      Math.cos(theta) * (RING.innerR + 0.04),
    );
    mesh.rotation.set(0, theta, 0);
    g.add(mesh);
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOORS  (individual groups — sliding panels animate per-frame)
// ═══════════════════════════════════════════════════════════════════════════

function buildDoors(mats, doorsOut) {
  const g = new THREE.Group();
  const N = RING.segCount;
  const doorCount = Math.floor(N / RING.doorEvery);

  for (let di = 0; di < doorCount; di++) {
    const seg      = di * RING.doorEvery;
    const theta    = ((seg + 0.5) / N) * TAU;
    const isOuter  = di % 2 === 0;
    const wallR    = isOuter ? RING.outerR - 0.15 : RING.innerR + 0.15;
    // Face into corridor: outer doors face inward, inner doors face outward
    const faceRot  = isOuter ? theta + Math.PI : theta;

    const dg = new THREE.Group();

    // ── Frame ─────────────────────────────────────────────────────────
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 2.3, 0.30),
      mats.doorFrame,
    );
    frame.position.set(0, 1.15, 0);
    dg.add(frame);

    // ── Sliding panels ────────────────────────────────────────────────
    const panelGeo  = new THREE.BoxGeometry(0.72, 2.1, 0.07);
    const leftPanel = new THREE.Mesh(panelGeo, mats.doorPanel);
    leftPanel.position.set(-0.38, 1.05, 0.14);
    dg.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeo.clone(), mats.doorPanel);
    rightPanel.position.set(0.38, 1.05, 0.14);
    dg.add(rightPanel);

    // ── Label above door ──────────────────────────────────────────────
    const label       = RING.doorLabels[di % RING.doorLabels.length];
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 48;
    const lctx        = labelCanvas.getContext('2d');
    lctx.fillStyle    = '#1a1a1a';
    lctx.fillRect(0, 0, 256, 48);
    lctx.fillStyle    = '#FF9900';
    lctx.font         = 'bold 20px Arial Narrow, Arial';
    lctx.textAlign    = 'center';
    lctx.fillText(label, 128, 34);
    const labelTex    = new THREE.CanvasTexture(labelCanvas);
    const labelMesh   = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.20),
      new THREE.MeshBasicMaterial({ map: labelTex }),
    );
    labelMesh.position.set(0, 2.42, 0.18);
    dg.add(labelMesh);

    // ── LCARS keypad beside door ──────────────────────────────────────
    const padTex  = createLCARSPanelTexture(label, 128);
    const padMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.30),
      new THREE.MeshBasicMaterial({ map: padTex }),
    );
    padMesh.position.set(1.05, 1.2, 0.18);
    dg.add(padMesh);

    // ── Position on the wall ──────────────────────────────────────────
    dg.position.set(
      Math.sin(theta) * wallR,
      0,
      Math.cos(theta) * wallR,
    );
    dg.rotation.set(0, faceRot, 0);

    g.add(dg);

    // Track for proximity animation
    doorsOut.push({
      leftPanel,
      rightPanel,
      theta,
      wallR,
      open: false,
      t: 0,
    });
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  LIGHTING  (≤ 3 lights, no shadows)
// ═══════════════════════════════════════════════════════════════════════════

function buildLighting(root, resources) {
  // Hemisphere light — warm sky / cool ground, even fill everywhere
  const hemi = new THREE.HemisphereLight(0xFFF4E0, 0x443322, 1.4);
  root.add(hemi);

  // Two soft point lights at opposite sides of the ring
  // (distance=8 → local warmth, won't over-illuminate the far side)
  [0, Math.PI].forEach(theta => {
    const light = new THREE.PointLight(0xFFE8CC, 2.0, 8);
    light.position.set(
      Math.sin(theta) * RING.radius,
      RING.wallHeight - 0.3,
      Math.cos(theta) * RING.radius,
    );
    root.add(light);
    resources.accentLights.push(light);
  });
}

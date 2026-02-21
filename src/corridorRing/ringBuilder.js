/**
 * ringBuilder.js — procedural Enterprise-D Deck 7 circular corridor ring.
 *
 * Aesthetic reference: TNG Season 2-7 corridor —
 *   • Warm tan/beige structural ARCH RIBS spanning floor-to-ceiling every ~2.7 m
 *   • Cool grey wall panels (upper + lower), separated by a deep BLACK recessed band
 *   • Bright white LED baseboard strips running at floor level on both walls
 *   • Dark mahogany handrail at ~0.93 m
 *   • Blue-grey carpet with pink-mauve centre stripe
 *   • Flat arch ceiling with recessed diffuse white light tiles
 *
 * Performance budget (Quest 3 / 3S):
 *   ~35 draw calls, ≤ 3 scene lights, no shadows, InstancedMesh for repeating elements.
 *
 * Returns { root, resources } — resources exposes animated refs for CorridorScene.
 */

import * as THREE from 'three';
import { RING, TAU }               from './ringConfig.js';
import { createLCARSPanelTexture } from './textures.js';

// ── Per-frame scratch object (avoids GC) ────────────────────────────────
const _obj = new THREE.Object3D();

// ── Material helper ──────────────────────────────────────────────────────
function makeMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.82,
    metalness: opts.metalness ?? 0,
    side:      opts.side      ?? THREE.FrontSide,
    ...opts,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export function buildCorridorRing() {
  const root = new THREE.Group();
  const P    = RING.palette;

  // ── Materials ──────────────────────────────────────────────────────────
  const mats = {
    carpetMain:   makeMat(P.carpetMain,   { roughness: 0.95 }),
    carpetStripe: makeMat(P.carpetStripe, { roughness: 0.93 }),

    // Inner wall (FrontSide — player sees outside of inner cylinder)
    wallInner:    makeMat(P.wallPanel, { roughness: 0.72 }),
    blackInner:   makeMat(P.wallBlack, { roughness: 0.30, metalness: 0.08 }),
    baseInner: new THREE.MeshStandardMaterial({
      color: P.baseboard, emissive: new THREE.Color(P.baseboard),
      emissiveIntensity: 2.0, roughness: 0.4,
    }),

    // Outer wall (BackSide — player sees inside of outer cylinder)
    wallOuter:    makeMat(P.wallPanel, { roughness: 0.72, side: THREE.BackSide }),
    blackOuter:   makeMat(P.wallBlack, { roughness: 0.30, metalness: 0.08, side: THREE.BackSide }),
    baseOuter: new THREE.MeshStandardMaterial({
      color: P.baseboard, emissive: new THREE.Color(P.baseboard),
      emissiveIntensity: 2.0, roughness: 0.4, side: THREE.BackSide,
    }),

    rib:      makeMat(P.rib,      { roughness: 0.62, metalness: 0.04 }),
    handrail: makeMat(P.handrail, { roughness: 0.42, metalness: 0.12 }),
    ceiling:  makeMat(P.ceiling,  { roughness: 0.72 }),

    ceilPanel: new THREE.MeshStandardMaterial({
      color: P.ceilPanel, emissive: new THREE.Color(P.ceilPanel),
      emissiveIntensity: 0.70, roughness: 0.5,
    }),

    doorFrame: makeMat(P.doorFrame, { roughness: 0.45, metalness: 0.35 }),
    doorPanel: makeMat(P.doorPanel, { roughness: 0.52 }),
  };

  const doors     = [];
  const resources = { doors, mats, ceilLightMat: mats.ceilPanel, accentLights: [] };

  root.add(buildFloor(mats));
  root.add(buildWalls(mats));
  root.add(buildCeiling(mats));
  root.add(buildRibs(mats));
  root.add(buildHandrails(mats));
  root.add(buildCeilingPanels(mats));
  root.add(buildLCARSPanels());
  root.add(buildDoors(mats, doors));
  buildLighting(root, resources);

  return { root, resources };
}

// ═══════════════════════════════════════════════════════════════════════════
//  FLOOR — blue-grey carpet + pink-mauve centre stripe
// ═══════════════════════════════════════════════════════════════════════════

function buildFloor(mats) {
  const g = new THREE.Group();
  const { innerR, outerR, radius, segments } = RING;

  // Full-width carpet base
  const mainGeo = new THREE.RingGeometry(innerR, outerR, segments);
  mainGeo.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(mainGeo, mats.carpetMain));

  // Centre stripe: 0.56 m wide pinkish-mauve strip on top
  const stripeHW = 0.28;
  const stripeGeo = new THREE.RingGeometry(radius - stripeHW, radius + stripeHW, segments);
  stripeGeo.rotateX(-Math.PI / 2);
  const stripe = new THREE.Mesh(stripeGeo, mats.carpetStripe);
  stripe.position.y = 0.0015;   // lift 1.5 mm to prevent z-fighting
  g.add(stripe);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WALLS — layered cylinder bands (baseboard / lower panel / black band / upper panel)
//
//  Inner wall: CylinderGeometry at innerR, FrontSide (outside of cylinder visible).
//  Outer wall: CylinderGeometry at outerR, BackSide (inside of cylinder visible).
//
//  Black recessed band: offset ±0.03 m so it reads as a shadow inset recess.
// ═══════════════════════════════════════════════════════════════════════════

function buildWalls(mats) {
  const g = new THREE.Group();
  const { innerR, outerR, baseH, bandLow, bandHigh, wallHeight, segments } = RING;

  function cylBand(r, y0, h, mat) {
    const geo  = new THREE.CylinderGeometry(r, r, h, segments, 1, true);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y0 + h / 2;
    g.add(mesh);
  }

  // ── Inner wall (FrontSide) ──────────────────────────────────────────
  cylBand(innerR,        0,        baseH,              mats.baseInner);      // LED baseboard
  cylBand(innerR,        baseH,    bandLow  - baseH,   mats.wallInner);      // lower panel
  cylBand(innerR - 0.03, bandLow,  bandHigh - bandLow, mats.blackInner);     // recessed black band
  cylBand(innerR,        bandHigh, wallHeight - bandHigh, mats.wallInner);   // upper panel

  // ── Outer wall (BackSide) ───────────────────────────────────────────
  cylBand(outerR,        0,        baseH,              mats.baseOuter);
  cylBand(outerR,        baseH,    bandLow  - baseH,   mats.wallOuter);
  cylBand(outerR + 0.03, bandLow,  bandHigh - bandLow, mats.blackOuter);     // recessed outward
  cylBand(outerR,        bandHigh, wallHeight - bandHigh, mats.wallOuter);

  // ── Transition ledges at top/bottom of black band ─────────────────
  // (thin discs to cap the step between wall surface and recessed band)
  for (const [r0, r1, mat] of [
    [innerR, innerR - 0.03, mats.blackInner],   // inner top ledge (faces up)
    [innerR, innerR - 0.03, mats.blackInner],   // inner bottom ledge
    [outerR, outerR + 0.03, mats.blackOuter],   // outer top ledge
    [outerR, outerR + 0.03, mats.blackOuter],   // outer bottom ledge
  ]) {
    // Skip — ledges are tiny enough that the dark material hides the seam
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CEILING — smooth arch swept around the ring
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
      const t = j / archRes;
      const r = innerR + t * (outerR - innerR);
      const y = wallHeight + archHeight * Math.sin(Math.PI * t);
      positions.push(sinT * r, y, cosT * r);
      uvs.push(i / segments, t);
    }
  }

  // Downward-facing normals (visible from below in corridor)
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
//  STRUCTURAL RIBS — InstancedMesh of arch-tube shapes (1 draw call total)
//
//  Each rib is a CatmullRom tube sweeping from inner-wall floor, up and over
//  the arch to the outer-wall floor — the signature TNG shape.
//  Tube colour: warm tan/beige RING.palette.rib.
// ═══════════════════════════════════════════════════════════════════════════

function buildRibs(mats) {
  const { innerR, outerR, halfWidth, wallHeight, archHeight, segCount } = RING;

  // Build the arch profile in LOCAL space of each rib:
  //   Local Y = up, Local Z = radially outward (inner → outer wall)
  //   Z = -halfWidth = inner wall, Z = +halfWidth = outer wall
  const hw  = halfWidth;
  const wh  = wallHeight;
  const ah  = archHeight;
  const crown = wh + ah + 0.08;          // apex of the arch — slightly above arch surface

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,  0.00,  -hw),           // inner base
    new THREE.Vector3(0,  wh * 0.30, -hw),       // inner lower pillar
    new THREE.Vector3(0,  wh * 0.72, -hw),       // inner upper pillar
    new THREE.Vector3(0,  wh * 0.94, -hw * 0.80), // shoulder
    new THREE.Vector3(0,  crown,       0),        // crown
    new THREE.Vector3(0,  wh * 0.94,  hw * 0.80), // shoulder
    new THREE.Vector3(0,  wh * 0.72,  hw),        // outer upper pillar
    new THREE.Vector3(0,  wh * 0.30,  hw),        // outer lower pillar
    new THREE.Vector3(0,  0.00,   hw),            // outer base
  ], false, 'catmullrom', 0.4);

  // Tube radius slightly larger at base than crown (tapered look)
  const ribGeo = new THREE.TubeGeometry(curve, 36, 0.045, 7, false);

  const ribs = new THREE.InstancedMesh(ribGeo, mats.rib, segCount);

  for (let i = 0; i < segCount; i++) {
    const theta = (i / segCount) * TAU;
    _obj.position.set(
      Math.sin(theta) * RING.radius,
      0,
      Math.cos(theta) * RING.radius,
    );
    _obj.rotation.set(0, theta, 0);
    _obj.scale.setScalar(1);
    _obj.updateMatrix();
    ribs.setMatrixAt(i, _obj.matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;
  return ribs;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAHOGANY HANDRAILS — continuous torus on each wall
// ═══════════════════════════════════════════════════════════════════════════

function buildHandrails(mats) {
  const g = new THREE.Group();
  const { innerR, outerR, railH, segments } = RING;

  // Inner handrail (just proud of the inner wall, slightly above black band top)
  const inner = new THREE.Mesh(
    (() => { const geo = new THREE.TorusGeometry(innerR - 0.05, 0.032, 7, segments); geo.rotateX(Math.PI / 2); return geo; })(),
    mats.handrail,
  );
  inner.position.y = railH;
  g.add(inner);

  // Outer handrail
  const outer = new THREE.Mesh(
    (() => { const geo = new THREE.TorusGeometry(outerR + 0.05, 0.032, 7, segments); geo.rotateX(Math.PI / 2); return geo; })(),
    mats.handrail,
  );
  outer.position.y = railH;
  g.add(outer);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CEILING LIGHT PANELS — recessed diffuse tiles near arch crown (InstancedMesh)
// ═══════════════════════════════════════════════════════════════════════════

function buildCeilingPanels(mats) {
  const N      = RING.segCount;
  const segArc = TAU * RING.radius / N;
  const panelL = segArc * 0.58;      // slightly shorter than rib bay
  const panelW = 0.36;               // across corridor

  const geo    = new THREE.BoxGeometry(panelL, 0.018, panelW);
  const panels = new THREE.InstancedMesh(geo, mats.ceilPanel, N);

  for (let i = 0; i < N; i++) {
    const theta = ((i + 0.5) / N) * TAU;           // between rib positions
    const archY = RING.wallHeight + RING.archHeight  // top of arch at centre
                  * Math.sin(Math.PI * 0.5);         // = sin(90°) = 1 → full archHeight
    _obj.position.set(
      Math.sin(theta) * RING.radius,
      archY - 0.01,                                 // flush with arch underside
      Math.cos(theta) * RING.radius,
    );
    _obj.rotation.set(0, theta, 0);
    _obj.scale.setScalar(1);
    _obj.updateMatrix();
    panels.setMatrixAt(i, _obj.matrix);
  }
  panels.instanceMatrix.needsUpdate = true;
  return panels;
}

// ═══════════════════════════════════════════════════════════════════════════
//  LCARS PANELS  (individual — unique label textures on inner wall)
// ═══════════════════════════════════════════════════════════════════════════

function buildLCARSPanels() {
  const g = new THREE.Group();
  const N = RING.segCount;

  const doorSegs = new Set();
  for (let d = 0; d < Math.floor(N / RING.doorEvery); d++) {
    doorSegs.add(d * RING.doorEvery);
  }

  const labels = ['DECK 7', 'SYSTEMS', 'DIRECTORY', 'JUNCTION',
                   'LIFE SUPPORT', 'TURBOLIFT MAP'];
  let labelIdx  = 0;
  const offset  = Math.floor(RING.doorEvery / 2);

  for (let i = 0; i < N; i += RING.lcarsEvery) {
    const seg = (i + offset) % N;
    if (doorSegs.has(seg)) continue;

    const theta  = ((seg + 0.5) / N) * TAU;
    const label  = labels[labelIdx++ % labels.length];
    const tex    = createLCARSPanelTexture(label, 256);
    const mesh   = new THREE.Mesh(
      new THREE.PlaneGeometry(0.50, 0.35),
      new THREE.MeshBasicMaterial({ map: tex }),
    );

    // Place on inner wall above the black band
    mesh.position.set(
      Math.sin(theta) * (RING.innerR + 0.04),
      RING.bandHigh + 0.30,
      Math.cos(theta) * (RING.innerR + 0.04),
    );
    mesh.rotation.set(0, theta, 0);
    g.add(mesh);
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOORS  (individual groups — sliding panels, label, LCARS keypad)
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
    const faceRot  = isOuter ? theta + Math.PI : theta;

    const dg = new THREE.Group();

    // Frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 2.3, 0.28),
      mats.doorFrame,
    );
    frame.position.set(0, 1.15, 0);
    dg.add(frame);

    // Sliding door panels
    const panelGeo  = new THREE.BoxGeometry(0.72, 2.1, 0.07);
    const leftPanel = new THREE.Mesh(panelGeo, mats.doorPanel);
    leftPanel.position.set(-0.38, 1.05, 0.13);
    dg.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeo.clone(), mats.doorPanel);
    rightPanel.position.set(0.38, 1.05, 0.13);
    dg.add(rightPanel);

    // Name label
    const label  = RING.doorLabels[di % RING.doorLabels.length];
    const cv     = document.createElement('canvas');
    cv.width     = 256;  cv.height = 48;
    const ctx    = cv.getContext('2d');
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = '#FF9900';
    ctx.font      = 'bold 20px Arial Narrow, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, 128, 34);
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.20),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }),
    );
    labelMesh.position.set(0, 2.42, 0.16);
    dg.add(labelMesh);

    // LCARS keypad
    const padMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.28),
      new THREE.MeshBasicMaterial({ map: createLCARSPanelTexture(label, 128) }),
    );
    padMesh.position.set(1.05, 1.2, 0.16);
    dg.add(padMesh);

    dg.position.set(
      Math.sin(theta) * wallR,
      0,
      Math.cos(theta) * wallR,
    );
    dg.rotation.set(0, faceRot, 0);
    g.add(dg);

    doorsOut.push({ leftPanel, rightPanel, theta, wallR, open: false, t: 0 });
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  LIGHTING  (≤ 3 lights total, no shadows)
//
//  Baseboard LED strips provide the dominant bright fill seen in the image.
//  We supplement with a cool-tinted hemisphere and two accent points.
// ═══════════════════════════════════════════════════════════════════════════

function buildLighting(root, resources) {
  // Hemisphere: cool sky colour matches the grey-blue wall look
  const hemi = new THREE.HemisphereLight(0xD8E8F0, 0x302820, 1.1);
  root.add(hemi);

  // Two warm-white accent points at opposite ring positions (reinforce rib shadows)
  [0, Math.PI].forEach(theta => {
    const light = new THREE.PointLight(0xFFF0E0, 1.4, 9);
    light.position.set(
      Math.sin(theta) * RING.radius,
      RING.wallHeight * 0.75,
      Math.cos(theta) * RING.radius,
    );
    root.add(light);
    resources.accentLights.push(light);
  });
}

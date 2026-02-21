/**
 * bridgeGenerator.js — procedural Enterprise-D bridge geometry.
 *
 * Performance targets (Quest 3 / 3S):
 *   • < 30 draw calls  (InstancedMesh for horseshoe + wall panels + doors)
 *   • ≤ 4 scene lights  (HemisphereLight + 2 PointLight, no shadows)
 *   • Shared MeshStandardMaterial with high roughness (matte)
 *   • Canvas textures 512 px max, reused via material sharing
 *
 * Returns { root, resources } where resources holds refs for animation.
 */

import * as THREE from 'three';
import { BRIDGE, DEG, ringXZ } from './bridgeConfig.js';
import {
  createLCARSCanvas, drawLCARS, createStaticLCARSTexture,
  createCarpetTexture, createStarfieldCanvas,
} from './lcarsTexture.js';

// ── Helpers ──────────────────────────────────────────────────────────────

const _obj = new THREE.Object3D();   // scratch for InstancedMesh transforms

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
//  PUBLIC — buildBridge()
// ═══════════════════════════════════════════════════════════════════════════

export function buildBridge() {
  const root = new THREE.Group();
  const P    = BRIDGE.palette;

  // ── Shared materials (reused across meshes → draw-call batching) ──────
  const mats = {
    carpet:     makeMat(P.carpet,     { roughness: 0.92, map: createCarpetTexture(P.carpet) }),
    wall:       makeMat(P.wall,       { roughness: 0.78, side: THREE.BackSide }),
    wallPanel:  makeMat(P.wallPanel,  { roughness: 0.6  }),
    wallBand:   makeMat(P.wallBand,   { roughness: 0.5, metalness: 0.15 }),
    ceiling:    makeMat(P.ceiling,    { roughness: 0.7, side: THREE.BackSide }),
    console:    makeMat(P.console,    { roughness: 0.85 }),
    wood:       makeMat(P.wood,       { roughness: 0.35 }),
    seat:       makeMat(P.seat,       { roughness: 0.65 }),
    chairFrame: makeMat(P.frame,      { roughness: 0.4, metalness: 0.5 }),
    metal:      makeMat(P.metal,      { roughness: 0.25, metalness: 0.7 }),
    doorFrame:  makeMat(P.doorFrame,  { roughness: 0.4, metalness: 0.5 }),
    doorPanel:  makeMat(P.doorPanel,  { roughness: 0.5  }),
    vsFrame:    makeMat(P.vsFrame,    { roughness: 0.2, metalness: 0.6 }),
    vsSurround: makeMat(P.vsSurround, { roughness: 0.6  }),
  };

  // LCARS textures
  const staticLcars    = createStaticLCARSTexture(0);
  const staticLcarsMat = new THREE.MeshBasicMaterial({ map: staticLcars });
  const animLcars      = createLCARSCanvas(512, 256);
  const animLcarsMat   = new THREE.MeshBasicMaterial({ map: animLcars.texture });

  // Starfield
  const starfield = createStarfieldCanvas(1024, 512);

  // Animation resources
  const resources = {
    animLcars,          // { canvas, ctx, texture }
    animLcarsMat,
    starfield,          // { canvas, ctx, stars, texture }
    accentLights: [],   // PointLight[] for red-alert pulse
    ceilLightMat: null, // emissive material for ceiling rings
    gridHelper:   null, // debug grid (toggled with G key)
    boundsHelper: null, // debug bounds (toggled with B key)
  };

  // ── Build all sections ────────────────────────────────────────────────
  root.add(buildFloor(mats));
  root.add(buildWalls(mats));
  root.add(buildCeiling(mats, resources));
  root.add(buildHorseshoe(mats, staticLcarsMat));
  root.add(buildChairs(mats));
  root.add(buildConnOps(mats, animLcarsMat, resources));
  root.add(buildRearConsoles(mats, animLcarsMat, resources));
  root.add(buildAftStations(mats, resources));
  root.add(buildViewscreen(mats, starfield));
  root.add(buildDoors(mats));
  buildLighting(root, resources);

  return { root, resources };
}

// ═══════════════════════════════════════════════════════════════════════════
//  FLOOR + PIT
// ═══════════════════════════════════════════════════════════════════════════

function buildFloor(mats) {
  const g = new THREE.Group();
  const { radius, segments } = BRIDGE.room;
  const { radius: pitR, depth } = BRIDGE.pit;

  // Outer ring (y = 0)
  const outerGeo = new THREE.RingGeometry(pitR + 0.01, radius, segments);
  outerGeo.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(outerGeo, mats.carpet));

  // Pit floor (y = -depth)
  const pitGeo = new THREE.CircleGeometry(pitR, segments);
  pitGeo.rotateX(-Math.PI / 2);
  const pit = new THREE.Mesh(pitGeo, mats.carpet);
  pit.position.y = -depth;
  g.add(pit);

  // Step riser (vertical ring connecting levels)
  const riserGeo = new THREE.CylinderGeometry(pitR, pitR, depth, segments, 1, true);
  const riser = new THREE.Mesh(riserGeo, mats.wallPanel);
  riser.position.y = -depth / 2;
  g.add(riser);

  // Step edge highlight ring
  const edgeGeo = new THREE.TorusGeometry(pitR, 0.03, 8, segments);
  edgeGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(edgeGeo, mats.wallBand));

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WALLS
// ═══════════════════════════════════════════════════════════════════════════

function buildWalls(mats) {
  const g = new THREE.Group();
  const { radius, wallHeight, segments } = BRIDGE.room;

  // Full enclosing cylinder (BackSide)
  const wallGeo = new THREE.CylinderGeometry(radius, radius, wallHeight, segments, 1, true);
  const wall    = new THREE.Mesh(wallGeo, mats.wall);
  wall.position.y = wallHeight / 2;
  g.add(wall);

  // Horizontal accent bands (InstancedMesh  — 2 instances)
  const bandGeo = new THREE.TorusGeometry(radius - 0.01, 0.035, 8, segments);
  bandGeo.rotateX(Math.PI / 2);
  const bands = new THREE.InstancedMesh(bandGeo, mats.wallBand, 2);
  [0.38, 0.78].forEach((frac, i) => {
    _obj.position.set(0, wallHeight * frac, 0);
    _obj.rotation.set(0, 0, 0);
    _obj.updateMatrix();
    bands.setMatrixAt(i, _obj.matrix);
  });
  bands.instanceMatrix.needsUpdate = true;
  g.add(bands);

  // Vertical accent panels (InstancedMesh — 12 instances)
  const panelGeo = new THREE.BoxGeometry(0.055, wallHeight * 0.88, 0.1);
  const panels   = new THREE.InstancedMesh(panelGeo, mats.wallPanel, 12);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    _obj.position.set(
      Math.sin(angle) * (radius - 0.05),
      wallHeight / 2,
      Math.cos(angle) * (radius - 0.05),
    );
    _obj.rotation.set(0, angle, 0);
    _obj.updateMatrix();
    panels.setMatrixAt(i, _obj.matrix);
  }
  panels.instanceMatrix.needsUpdate = true;
  g.add(panels);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CEILING DOME
// ═══════════════════════════════════════════════════════════════════════════

function buildCeiling(mats, resources) {
  const g = new THREE.Group();
  const { radius, wallHeight, domeApex, segments } = BRIDGE.room;

  // Sphere parameters for the dome cap:
  //   R = (r² + h²) / (2h),  yc = apex - R,  θ = asin(r / R)
  const h      = domeApex - wallHeight;         // 1.6 m rise
  const R      = (radius * radius + h * h) / (2 * h);
  const yc     = domeApex - R;
  const theta  = Math.asin(radius / R);

  const domeGeo = new THREE.SphereGeometry(R, segments, 16, 0, Math.PI * 2, 0, theta);
  const dome    = new THREE.Mesh(domeGeo, mats.ceiling);
  dome.position.y = yc;
  g.add(dome);

  // Concentric light rings on the dome
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    emissive: 0xFFEECC,
    emissiveIntensity: 1.8,
  });
  resources.ceilLightMat = ringMat;

  [1.8, 3.2, 4.8].forEach(r => {
    const ringY = yc + Math.sqrt(R * R - r * r);
    const ring  = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.045, 8, segments),
      ringMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ringY;
    g.add(ring);
  });

  // Central translucent dome glow
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    emissive: BRIDGE.palette.domeGlow,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.35,
    side: THREE.BackSide,
  });
  const glowGeo = new THREE.SphereGeometry(2.0, 32, 8, 0, Math.PI * 2, 0, Math.PI * 0.18);
  const glow    = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = domeApex - 0.3;
  glow.rotation.x = Math.PI;
  g.add(glow);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  HORSESHOE CONSOLES  (InstancedMesh × 2 — bodies + screens)
// ═══════════════════════════════════════════════════════════════════════════

function buildHorseshoe(mats, lcarsMat) {
  const g  = new THREE.Group();
  const hs = BRIDGE.horseshoe;
  const N  = hs.count;
  const midR  = (hs.innerR + hs.outerR) / 2;
  const segD  = hs.outerR - hs.innerR;
  const segW  = (midR * hs.arcDeg * DEG) / N * 0.92;  // arc segment width

  // ── Console bodies (InstancedMesh) ─────────────────────────────────────
  const bodyGeo = new THREE.BoxGeometry(segW, hs.height, segD);
  const bodies  = new THREE.InstancedMesh(bodyGeo, mats.console, N);

  for (let i = 0; i < N; i++) {
    const deg = 290 - ((i + 0.5) / N) * hs.arcDeg;  // CCW from 290° → 70°
    const [x, z] = ringXZ(deg, midR);
    _obj.position.set(x, hs.height / 2, z);
    _obj.rotation.set(0, 0, 0);
    _obj.lookAt(0, hs.height / 2, 0);       // face centre
    _obj.updateMatrix();
    bodies.setMatrixAt(i, _obj.matrix);
  }
  bodies.instanceMatrix.needsUpdate = true;
  g.add(bodies);

  // ── LCARS screen planes on top (InstancedMesh) ─────────────────────────
  const screenGeo = new THREE.PlaneGeometry(segW * 0.85, segD * 0.8);
  const screens   = new THREE.InstancedMesh(screenGeo, lcarsMat, N);

  for (let i = 0; i < N; i++) {
    const deg = 290 - ((i + 0.5) / N) * hs.arcDeg;
    const [x, z] = ringXZ(deg, midR);
    _obj.position.set(x, hs.height + 0.01, z);
    // Face centre, then tilt to reading angle
    _obj.rotation.set(0, 0, 0);
    _obj.lookAt(0, hs.height + 0.01, 0);
    _obj.rotateX(-Math.PI / 2 - hs.screenTilt);
    _obj.updateMatrix();
    screens.setMatrixAt(i, _obj.matrix);
  }
  screens.instanceMatrix.needsUpdate = true;
  g.add(screens);

  // ── Wooden rail arc ────────────────────────────────────────────────────
  const arcRad  = hs.arcDeg * DEG;
  const railGeo = new THREE.TorusGeometry(hs.innerR, 0.07, 12, 64, arcRad);
  const rail    = new THREE.Mesh(railGeo, mats.wood);
  rail.rotation.x = Math.PI / 2;
  // Align arc start with 290° direction:
  // Torus default starts at +X (= 90° in ship convention)
  // Rotate Y so start moves to 290°.  See bridgeConfig angle convention.
  // In Three.js CCW rotation, 290° = 90° shifted by 200° of CCW rotation
  // but Three.js CCW around Y goes from +X toward -Z.
  // After rotateX(π/2) the torus is in XZ plane; we then rotate Y.
  // Empirically: rotation.y = (290 - 90) * DEG works for our convention.
  rail.rotation.y  = -20 * DEG;
  rail.position.y  = hs.railY;
  g.add(rail);

  // ── Wooden rail supports (InstancedMesh) ───────────────────────────────
  const supGeo  = new THREE.CylinderGeometry(0.03, 0.03, hs.railY - 0.1, 6);
  const supCount = N + 1;
  const sups    = new THREE.InstancedMesh(supGeo, mats.wood, supCount);
  for (let i = 0; i <= N; i++) {
    const deg = 290 - (i / N) * hs.arcDeg;
    const [x, z] = ringXZ(deg, hs.innerR);
    _obj.position.set(x, (hs.railY - 0.1) / 2, z);
    _obj.rotation.set(0, 0, 0);
    _obj.updateMatrix();
    sups.setMatrixAt(i, _obj.matrix);
  }
  sups.instanceMatrix.needsUpdate = true;
  g.add(sups);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMMAND CHAIRS
// ═══════════════════════════════════════════════════════════════════════════

function buildChairs(mats) {
  const g = new THREE.Group();
  const pitY = -BRIDGE.pit.depth;

  const buildSeat = (pos, isCaptain) => {
    const chair = new THREE.Group();
    const w = isCaptain ? 0.82 : 0.68;
    const bh = isCaptain ? 0.92 : 0.78;

    // Pedestal
    chair.add((() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.36, 12), mats.chairFrame);
      m.position.y = 0.18;
      return m;
    })());

    // Seat
    chair.add((() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.10, 0.52), mats.seat);
      m.position.y = 0.42;
      return m;
    })());

    // Back
    chair.add((() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, bh, 0.10), mats.seat);
      m.position.set(0, 0.42 + bh / 2, 0.26);
      return m;
    })());

    // Armrests + LCARS pads
    [-1, 1].forEach(s => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.26, 0.44), mats.chairFrame);
      arm.position.set(s * (w / 2 + 0.03), 0.56, 0.02);
      chair.add(arm);

      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, 0.16),
        new THREE.MeshBasicMaterial({ color: 0xFF9900 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(s * (w / 2 + 0.03), 0.70, 0.06);
      chair.add(pad);
    });

    chair.position.set(pos.x, pitY, pos.z);
    return chair;
  };

  g.add(buildSeat(BRIDGE.captain, true));
  g.add(buildSeat(BRIDGE.conn, false));
  g.add(buildSeat(BRIDGE.ops,  false));

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONN / OPS FORWARD CONSOLES  (animated LCARS screens)
// ═══════════════════════════════════════════════════════════════════════════

function buildConnOps(mats, animLcarsMat, resources) {
  const g = new THREE.Group();
  const pitY = -BRIDGE.pit.depth;

  // Curved desk
  const deskShape = new THREE.Shape();
  deskShape.absarc(0, 0, 2.8, -Math.PI * 0.18, Math.PI * 0.18, false);
  deskShape.absarc(0, 0, 1.9, Math.PI * 0.18, -Math.PI * 0.18, true);
  const deskGeo = new THREE.ExtrudeGeometry(deskShape, {
    depth: 0.65, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04,
  });
  const desk = new THREE.Mesh(deskGeo, mats.console);
  desk.rotation.x = -Math.PI / 2;
  desk.position.set(0, pitY + 0.08, -1.5);
  g.add(desk);

  // Dark top surface
  const surfGeo = new THREE.ExtrudeGeometry((() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 2.75, -Math.PI * 0.17, Math.PI * 0.17, false);
    s.absarc(0, 0, 1.95, Math.PI * 0.17, -Math.PI * 0.17, true);
    return s;
  })(), { depth: 0.03, bevelEnabled: false });
  const surf = new THREE.Mesh(surfGeo, mats.console);
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(0, pitY + 0.74, -1.5);
  g.add(surf);

  // CONN + OPS LCARS screens
  [{ x: -0.9, title: 'OPS', rot: 0.18 }, { x: 0.9, title: 'CONN', rot: -0.18 }].forEach(st => {
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.5),
      animLcarsMat,
    );
    screen.position.set(st.x, pitY + 0.92, -3.9);
    screen.rotation.x = -0.55;
    screen.rotation.y = st.rot;
    g.add(screen);
  });

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  REAR STANDING CONSOLES  (behind captain)
// ═══════════════════════════════════════════════════════════════════════════

function buildRearConsoles(mats, animLcarsMat, resources) {
  const g = new THREE.Group();

  BRIDGE.rearConsoles.forEach(rc => {
    const cg = new THREE.Group();

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5), mats.console);
    body.position.y = 0.5;
    cg.add(body);

    // Wood trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.55), mats.wood);
    trim.position.y = 1.02;
    cg.add(trim);

    // LCARS screen
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.55),
      animLcarsMat,
    );
    screen.position.set(0, 1.45, -0.1);
    screen.rotation.x = -0.2;
    cg.add(screen);

    cg.position.set(rc.x, 0, rc.z);
    g.add(cg);
  });

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AFT WALL STATIONS
// ═══════════════════════════════════════════════════════════════════════════

function buildAftStations(mats, resources) {
  const g = new THREE.Group();
  const stations = BRIDGE.aftStations;
  const R = BRIDGE.room.radius - 0.6;    // slightly inboard of wall

  // Console bodies (InstancedMesh — 6 identical boxes)
  const bodyGeo = new THREE.BoxGeometry(1.3, 1.0, 0.6);
  const bodies  = new THREE.InstancedMesh(bodyGeo, mats.console, stations.length);

  stations.forEach((st, i) => {
    const [x, z] = ringXZ(st.deg, R);
    _obj.position.set(x, 0.95, z);
    _obj.rotation.set(0, 0, 0);
    _obj.lookAt(0, 0.95, 0);
    _obj.updateMatrix();
    bodies.setMatrixAt(i, _obj.matrix);
  });
  bodies.instanceMatrix.needsUpdate = true;
  g.add(bodies);

  // Wood trims (InstancedMesh — 6)
  const trimGeo = new THREE.BoxGeometry(1.4, 0.05, 0.65);
  const trims   = new THREE.InstancedMesh(trimGeo, mats.wood, stations.length);
  stations.forEach((st, i) => {
    const [x, z] = ringXZ(st.deg, R);
    _obj.position.set(x, 1.48, z);
    _obj.rotation.set(0, 0, 0);
    _obj.lookAt(0, 1.48, 0);
    _obj.updateMatrix();
    trims.setMatrixAt(i, _obj.matrix);
  });
  trims.instanceMatrix.needsUpdate = true;
  g.add(trims);

  // Individual LCARS screens (each has unique title → separate material)
  stations.forEach(st => {
    const lcars = createLCARSCanvas(512, 256);
    drawLCARS(lcars.ctx, 512, 256, st.deg * 0.1, st.label);
    lcars.texture.needsUpdate = true;

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.65),
      new THREE.MeshBasicMaterial({ map: lcars.texture }),
    );
    const [x, z] = ringXZ(st.deg, R - 0.05);
    screen.position.set(x, 1.9, z);
    screen.lookAt(0, 1.9, 0);
    screen.rotateY(Math.PI);             // text faces inward
    g.add(screen);
  });

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  VIEWSCREEN
// ═══════════════════════════════════════════════════════════════════════════

function buildViewscreen(mats, starfield) {
  const g  = new THREE.Group();
  const vs = BRIDGE.viewscreen;

  // Surround (beige, matching wall)
  const surroundGeo = new THREE.BoxGeometry(vs.w + 0.6, vs.h + 0.6, 0.15);
  const surround    = new THREE.Mesh(surroundGeo, mats.vsSurround);
  surround.position.set(0, BRIDGE.room.wallHeight * 0.52, vs.z - 0.12);
  g.add(surround);

  // Dark frame
  const frameGeo = new THREE.BoxGeometry(vs.w + 0.2, vs.h + 0.2, 0.25);
  const frame    = new THREE.Mesh(frameGeo, mats.vsFrame);
  frame.position.set(0, BRIDGE.room.wallHeight * 0.52, vs.z - 0.05);
  g.add(frame);

  // Screen (starfield canvas)
  const screenMat = new THREE.MeshBasicMaterial({ map: starfield.texture });
  const screenGeo = new THREE.PlaneGeometry(vs.w, vs.h);
  const screen    = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, BRIDGE.room.wallHeight * 0.52, vs.z + 0.08);
  g.add(screen);

  // Subtle emissive glow around screen edge
  const edgeMat = new THREE.MeshBasicMaterial({
    color: 0x334455, transparent: true, opacity: 0.15,
  });
  const edgeGeo = new THREE.PlaneGeometry(vs.w + 0.4, vs.h + 0.4);
  const edge    = new THREE.Mesh(edgeGeo, edgeMat);
  edge.position.set(0, BRIDGE.room.wallHeight * 0.52, vs.z + 0.06);
  g.add(edge);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOORS  (turbolifts + ready room + observation lounge)
// ═══════════════════════════════════════════════════════════════════════════

function buildDoors(mats) {
  const g     = new THREE.Group();
  const doors = BRIDGE.doors;
  const R     = BRIDGE.room.radius - 0.15;

  doors.forEach(door => {
    const dg = new THREE.Group();
    const [x, z] = ringXZ(door.deg, R);

    // Frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 2.7, 0.35),
      mats.doorFrame,
    );
    frame.position.y = 1.8;
    dg.add(frame);

    // Left panel
    const panelGeo = new THREE.BoxGeometry(0.82, 2.5, 0.07);
    const left = new THREE.Mesh(panelGeo, mats.doorPanel);
    left.position.set(-0.44, 1.75, 0.16);
    dg.add(left);

    // Right panel
    const right = new THREE.Mesh(panelGeo.clone(), mats.doorPanel);
    right.position.set(0.44, 1.75, 0.16);
    dg.add(right);

    // Label above door
    const labelCanvas    = document.createElement('canvas');
    labelCanvas.width    = 256;
    labelCanvas.height   = 48;
    const lctx           = labelCanvas.getContext('2d');
    lctx.fillStyle       = '#1a1a1a';
    lctx.fillRect(0, 0, 256, 48);
    lctx.fillStyle       = '#FF9900';
    lctx.font            = 'bold 22px Arial Narrow, Arial';
    lctx.textAlign       = 'center';
    lctx.fillText(door.label, 128, 34);
    const labelTex       = new THREE.CanvasTexture(labelCanvas);
    const labelMesh      = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.22),
      new THREE.MeshBasicMaterial({ map: labelTex }),
    );
    labelMesh.position.set(0, 3.2, 0.2);
    dg.add(labelMesh);

    // LCARS keypad beside door
    const padCanvas    = document.createElement('canvas');
    padCanvas.width    = 64;
    padCanvas.height   = 128;
    const pctx         = padCanvas.getContext('2d');
    pctx.fillStyle     = '#000000';
    pctx.fillRect(0, 0, 64, 128);
    ['#FF9900', '#3399FF', '#CC99FF', '#CC6600'].forEach((c, i) => {
      pctx.fillStyle = c;
      pctx.beginPath();
      pctx.roundRect(4, 4 + i * 30, 56, 24, 6);
      pctx.fill();
    });
    const padTex  = new THREE.CanvasTexture(padCanvas);
    const padMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.32),
      new THREE.MeshBasicMaterial({ map: padTex }),
    );
    padMesh.position.set(1.15, 1.4, 0.2);
    dg.add(padMesh);

    // Position on wall
    dg.position.set(x, 0.45, z);
    // Face inward
    dg.lookAt(0, 0.45, 0);
    dg.rotateY(Math.PI);

    g.add(dg);
  });

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  LIGHTING  (≤ 4 lights, no shadows)
// ═══════════════════════════════════════════════════════════════════════════

function buildLighting(root, resources) {
  // Hemisphere — warm sky / cool ground fill
  const hemi = new THREE.HemisphereLight(0xFFF4E0, 0x443322, 1.2);
  root.add(hemi);

  // Central dome point light (primary key)
  const dome = new THREE.PointLight(0xFFEECC, 2.8, 22);
  dome.position.set(0, BRIDGE.room.domeApex - 0.5, 0);
  root.add(dome);
  resources.accentLights.push(dome);

  // Forward fill toward viewscreen
  const fwd = new THREE.PointLight(0x99AACC, 1.0, 14);
  fwd.position.set(0, 3.5, -4.5);
  root.add(fwd);
  resources.accentLights.push(fwd);

  // Aft fill
  const aft = new THREE.PointLight(0xFFCC88, 0.6, 12);
  aft.position.set(0, 3.0, 4.0);
  root.add(aft);
  resources.accentLights.push(aft);
}

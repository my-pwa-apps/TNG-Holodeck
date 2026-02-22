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
    carpet:     makeMat(P.carpet,     { roughness: 0.92, metalness: 0.0 }),           // deep burgundy outer ring
    carpetPit:  makeMat(P.carpetPit,  { roughness: 0.88, metalness: 0.0 }),           // light grey pit floor
    wall:       makeMat(P.wall,       { roughness: 0.78, side: THREE.BackSide, metalness: 0.0 }),
    wallPanel:  makeMat(P.wallPanel,  { roughness: 0.6, metalness: 0.0 }),
    wallBand:   makeMat(P.wallBand,   { roughness: 0.5, metalness: 0.0 }),
    ceiling:    makeMat(P.ceiling,    { roughness: 0.7, side: THREE.BackSide, metalness: 0.0 }),
    console:    makeMat(P.console,    { roughness: 0.80, metalness: 0.0 }),
    consolePanel: makeMat(P.consolePanel, { roughness: 0.60, metalness: 0.0 }),
    wood:       makeMat(P.wood,       { roughness: 0.35, metalness: 0.0 }),
    seat:       makeMat(P.seat,       { roughness: 0.72, metalness: 0.0 }),           // cream/ivory (not red)
    chairFrame: makeMat(P.frame,      { roughness: 0.4, metalness: 0.5 }),
    metal:      makeMat(P.metal,      { roughness: 0.25, metalness: 0.7 }),
    doorFrame:  makeMat(P.doorFrame,  { roughness: 0.4, metalness: 0.5 }),
    doorPanel:  makeMat(P.doorPanel,  { roughness: 0.55, metalness: 0.0 }),           // charcoal grey
    vsFrame:    makeMat(P.vsFrame,    { roughness: 0.2, metalness: 0.6 }),
    vsSurround: makeMat(P.vsSurround, { roughness: 0.6, metalness: 0.0 }),
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

  // Pit floor (y = -depth) — lighter warm-grey to contrast with burgundy outer ring
  const pitGeo = new THREE.CircleGeometry(pitR, segments);
  pitGeo.rotateX(-Math.PI / 2);
  const pit = new THREE.Mesh(pitGeo, mats.carpetPit);
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

  // Vertical accent panels (InstancedMesh — 16 instances)
  const panelGeo = new THREE.BoxGeometry(0.055, wallHeight * 0.88, 0.1);
  const panels   = new THREE.InstancedMesh(panelGeo, mats.wallPanel, 16);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
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

// ═════════════════════════════════════════════════════════════════════════
//  CEILING DOME
// ═════════════════════════════════════════════════════════════════════════

function buildCeiling(mats, resources) {
  const g = new THREE.Group();
  const { radius, wallHeight, domeApex, segments } = BRIDGE.room;
  const P = BRIDGE.palette;

  // ── Dome sphere cap ──────────────────────────────────────────────────
  const h      = domeApex - wallHeight;   // 1.6 m rise
  const R      = (radius * radius + h * h) / (2 * h);
  const yc     = domeApex - R;
  const theta  = Math.asin(radius / R);

  const domeGeo = new THREE.SphereGeometry(R, segments, 16, 0, Math.PI * 2, 0, theta);
  const dome    = new THREE.Mesh(domeGeo, mats.ceiling);
  dome.position.y = yc;
  g.add(dome);

  // ── Structural rib material (warm tan/gold) ──────────────────────────
  const domeRibMat = makeMat(P.domeRib, { roughness: 0.52, metalness: 0.06 });

  // ── Backlit panel material (large emissive bright-white) ─────────────
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    emissive: new THREE.Color(P.domeGlow),
    emissiveIntensity: 3.2,
    roughness: 0.35,
  });
  resources.ceilLightMat = panelMat;

  // ── Concentric structural rib rings (fat torus, tan/gold) ─────────────
  // Three rings divide the dome into four luminous bays
  const ribRadii = [1.55, 3.20, 5.0];
  ribRadii.forEach(r => {
    if (r > radius - 0.2) return;
    const ribY = yc + Math.sqrt(Math.max(0, R * R - r * r));
    const rib  = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.10, 10, segments),
      domeRibMat,
    );
    rib.rotation.x = Math.PI / 2;
    rib.position.y = ribY;
    g.add(rib);
  });

  // ── Backlit panels between rib rings (flat RingGeometry at dome height) ─
  const panelZones = [
    [0.06, 1.45],           // inner cap
    [1.65, 3.10],           // mid ring
    [3.30, 4.90],           // outer ring
    [5.10, radius - 0.25],  // outermost bay
  ];
  panelZones.forEach(([r0, r1]) => {
    if (r1 <= r0 + 0.1) return;
    const midR   = (r0 + r1) / 2;
    const panelY = yc + Math.sqrt(Math.max(0, R * R - midR * midR));
    const pGeo   = new THREE.RingGeometry(r0, r1, segments);
    pGeo.rotateX(-Math.PI / 2);
    const panel  = new THREE.Mesh(pGeo, panelMat);
    panel.position.y = panelY;
    g.add(panel);
  });

  // ── Curved dome-following radial ribs (InstancedMesh — 8 spokes) ─────
  //   Each rib is a CatmullRomCurve3 sampled along the dome sphere surface
  //   from the inner concentric ring to the outer concentric ring.
  //   Local space: points at (0, worldY, r) along +Z — instanced with
  //   rotation.y per spoke so they fan out correctly around the dome.
  const SPOKES = 8;
  const rInner = 1.45;   // just outside inner rib ring
  const rOuter = 5.10;   // just inside outer rib ring
  const nPts   = 8;
  const ribPts = [];
  for (let i = 0; i < nPts; i++) {
    const r = rInner + (rOuter - rInner) * (i / (nPts - 1));
    const y = yc + Math.sqrt(Math.max(0, R * R - r * r));
    ribPts.push(new THREE.Vector3(0, y, r));
  }
  const ribCurve = new THREE.CatmullRomCurve3(ribPts, false, 'catmullrom', 0.25);
  const ribGeo   = new THREE.TubeGeometry(ribCurve, 32, 0.07, 8, false);
  const ribInst  = new THREE.InstancedMesh(ribGeo, domeRibMat, SPOKES);

  for (let s = 0; s < SPOKES; s++) {
    const angle = (s / SPOKES) * Math.PI * 2;
    _obj.position.set(0, 0, 0);
    _obj.rotation.set(0, angle, 0);
    _obj.scale.setScalar(1);
    _obj.updateMatrix();
    ribInst.setMatrixAt(s, _obj.matrix);
  }
  ribInst.instanceMatrix.needsUpdate = true;
  g.add(ribInst);

  // ── Dark oculus circle at dome apex (reference photo — dark centre hole) ─
  const oculusGeo = new THREE.CircleGeometry(1.35, segments);
  oculusGeo.rotateX(-Math.PI / 2);
  const oculus    = new THREE.Mesh(oculusGeo, makeMat(0x060608, { roughness: 0.9 }));
  oculus.position.y = yc + Math.sqrt(Math.max(0, R * R - 1.35 * 1.35)) + 0.01;
  g.add(oculus);

  // ── Outer wall trim ring at dome base — dark charcoal separator ────────
  //   In the reference photo this ring is a distinct dark band (no glow).
  const wallRingMat = makeMat(0x1A1814, { roughness: 0.6 });
  const wallRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 0.02, 0.12, 10, segments),
    wallRingMat,
  );
  wallRing.rotation.x = Math.PI / 2;
  wallRing.position.y = wallHeight + 0.06;
  g.add(wallRing);

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

  // ── Dark screen surrounds (InstancedMesh) ──────────────────────────────
  const surroundGeo = new THREE.PlaneGeometry(segW * 0.95, segD * 0.9);
  const surrounds   = new THREE.InstancedMesh(surroundGeo, mats.consolePanel, N);

  for (let i = 0; i < N; i++) {
    const deg = 290 - ((i + 0.5) / N) * hs.arcDeg;
    const [x, z] = ringXZ(deg, midR);
    _obj.position.set(x, hs.height + 0.005, z);
    _obj.rotation.set(0, 0, 0);
    _obj.lookAt(0, hs.height + 0.005, 0);
    _obj.rotateX(-Math.PI / 2 - hs.screenTilt);
    _obj.updateMatrix();
    surrounds.setMatrixAt(i, _obj.matrix);
  }
  surrounds.instanceMatrix.needsUpdate = true;
  g.add(surrounds);

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
  const surf = new THREE.Mesh(surfGeo, mats.consolePanel);
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

    // Dark screen surround
    const surround = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.65), mats.consolePanel);
    surround.position.set(0, 1.45, -0.105);
    surround.rotation.x = -0.2;
    cg.add(surround);

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

  // Dark screen surrounds (InstancedMesh — 6)
  const surroundGeo = new THREE.PlaneGeometry(1.2, 0.75);
  const surrounds   = new THREE.InstancedMesh(surroundGeo, mats.consolePanel, stations.length);
  stations.forEach((st, i) => {
    const [x, z] = ringXZ(st.deg, R - 0.045);
    _obj.position.set(x, 1.9, z);
    _obj.rotation.set(0, 0, 0);
    _obj.lookAt(0, 1.9, 0);
    _obj.rotateY(Math.PI);
    _obj.updateMatrix();
    surrounds.setMatrixAt(i, _obj.matrix);
  });
  surrounds.instanceMatrix.needsUpdate = true;
  g.add(surrounds);

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
  const R     = BRIDGE.room.radius - 0.10;

  doors.forEach(door => {
    const dg = new THREE.Group();
    const [x, z] = ringXZ(door.deg, R);

    // Frame — starts at floor, full height
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 2.7, 0.30),
      mats.doorFrame,
    );
    frame.position.y = 1.35;
    dg.add(frame);

    // Left panel (slides behind wall, negative Z = wall side)
    const panelGeo = new THREE.BoxGeometry(0.82, 2.5, 0.07);
    const left = new THREE.Mesh(panelGeo, mats.doorPanel);
    left.position.set(-0.44, 1.30, 0.10);
    dg.add(left);

    // Right panel
    const right = new THREE.Mesh(panelGeo.clone(), mats.doorPanel);
    right.position.set(0.44, 1.30, 0.10);
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
    labelMesh.position.set(0, 2.85, 0.16);
    dg.add(labelMesh);

    // LCARS keypads beside door (both sides, as in TNG)
    [-1, 1].forEach(side => {
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
      padMesh.position.set(side * 1.15, 1.2, 0.16);
      dg.add(padMesh);
    });

    // Position on wall at floor level
    dg.position.set(x, 0, z);
    // Face inward — lookAt makes +Z point toward center for Object3D,
    // so panels/labels/pads at positive Z face the bridge interior.
    dg.lookAt(0, 0, 0);

    g.add(dg);
  });

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  LIGHTING  (≤ 4 lights, no shadows)
// ═══════════════════════════════════════════════════════════════════════════

function buildLighting(root, resources) {
  // Hemisphere — the TNG bridge is very bright and warm:
  //   bright warm-white sky, very dim warm-brown ground
  const hemi = new THREE.HemisphereLight(0xFFF8F0, 0x2A1E14, 1.5);
  root.add(hemi);

  // Central dome point — primary key light (warm white)
  const dome = new THREE.PointLight(0xFFF4E8, 0.8, 26);
  dome.decay = 0;
  dome.position.set(0, BRIDGE.room.domeApex - 0.4, 0);
  root.add(dome);
  resources.accentLights.push(dome);

  // Forward fill toward viewscreen (slight cool-blue from screen)
  const fwd = new THREE.PointLight(0xBBCCDD, 0.3, 16);
  fwd.decay = 0;
  fwd.position.set(0, 3.2, -4.5);
  root.add(fwd);
  resources.accentLights.push(fwd);

  // Aft fill
  const aft = new THREE.PointLight(0xFFE8C8, 0.3, 14);
  aft.decay = 0;
  aft.position.set(0, 2.8, 4.5);
  root.add(aft);
  resources.accentLights.push(aft);
}

/**
 * ringBuilder.js — Enterprise-D circular corridor.
 *
 * Reference: TNG corridor render showing:
 *   • Both walls SYMMETRIC: stacked cool-grey horizontal panels,
 *     deep black recessed band at mid-wall (~1.0–1.3 m), bright white
 *     luminous baseboard strip at floor level.
 *   • Portal-frame RIBS every ~2.6 m: tan/beige two-column frames with
 *     flat ceiling crossbeam, columns flare into organic bracket caps.
 *   • FLAT ceiling (not arched) with large bright-white recessed light tiles.
 *   • Outer wall multi-rail mahogany HANDRAIL (3 stacked horizontal rails).
 *   • Floor: blue-grey centre carpet, pink/mauve diagonal-edged side panels.
 *
 * Performance (Quest 3/3S):
 *   ≤ 35 draw calls — InstancedMesh for ribs, wall bands, ceiling tiles.
 *   ≤ 3 lights, no shadows.
 */

import * as THREE from 'three';
import { RING, TAU } from './ringConfig.js';
import { createLCARSPanelTexture } from './textures.js';

const _obj = new THREE.Object3D();

function makeMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.10,
    side:      opts.side      ?? THREE.FrontSide,
    ...opts,
  });
}

// ═══════════════════════════════════════════════════════════════
export function buildCorridorRing() {
  const root = new THREE.Group();
  const P    = RING.palette;

  const mats = {
    carpetMain:   makeMat(P.carpetMain,   { roughness: 0.95, metalness: 0 }),
    carpetPath:   makeMat(P.carpetStripe, { roughness: 0.95, metalness: 0 }),

    // Both walls share same materials; side set per-mesh
    wallPanel:    makeMat(P.wallPanel,  { roughness: 0.45, metalness: 0.1 }),
    wallBlack:    makeMat(P.wallBlack,  { roughness: 0.15, metalness: 0.6 }),
    baseboard: new THREE.MeshStandardMaterial({
      color: new THREE.Color(P.baseboard),
      emissive: new THREE.Color(P.baseboard),
      emissiveIntensity: 2.0, roughness: 0.35,
    }),

    rib:      makeMat(P.rib,      { roughness: 0.65, metalness: 0.05 }),
    handrail: makeMat(P.handrail, { roughness: 0.30, metalness: 0.05 }),

    ceiling:   makeMat(P.ceiling,   { roughness: 0.80, metalness: 0 }),
    ceilPanel: new THREE.MeshStandardMaterial({
      color: new THREE.Color(P.ceilPanel),
      emissive: new THREE.Color(P.ceilPanel),
      emissiveIntensity: 1.8, roughness: 0.40,
    }),

    doorFrame: makeMat(P.doorFrame, { roughness: 0.65, metalness: 0.05 }),
    doorPanel: makeMat(P.doorPanel, { roughness: 0.50, metalness: 0.35 }),
  };

  const doors     = [];
  const resources = { doors, mats, ceilLightMat: mats.ceilPanel, accentLights: [] };

  root.add(buildFloor(mats));
  root.add(buildWall(mats, true));    // inner wall (FrontSide)
  root.add(buildWall(mats, false));   // outer wall (BackSide) + handrail
  root.add(buildCeiling(mats));
  root.add(buildRibs(mats));
  root.add(buildDoors(mats, doors));
  buildLighting(root, resources);

  return { root, resources };
}

// ═══════════════════════════════════════════════════════════════
//  FLOOR — blue-grey centre, pink/mauve sides
// ═══════════════════════════════════════════════════════════════

function buildFloor(mats) {
  const g = new THREE.Group();
  const { innerR, outerR, radius, segments } = RING;

  // Pink/mauve base — full corridor width  
  const baseGeo = new THREE.RingGeometry(innerR, outerR, segments);
  baseGeo.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(baseGeo, mats.carpetMain));

  // Blue-grey centre path: ~1.6 m wide
  const hw = 0.80;
  const pathGeo = new THREE.RingGeometry(radius - hw, radius + hw, segments);
  pathGeo.rotateX(-Math.PI / 2);
  const path = new THREE.Mesh(pathGeo, mats.carpetPath);
  path.position.y = 0.002;
  g.add(path);

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  WALL  (symmetric on inner and outer)
//
//  Bands (bottom → top):
//    [0 → baseH]          bright white luminous baseboard
//    [baseH → bandLow]    cool-grey lower horizontal panels
//    [bandLow → bandHigh] deep-black recessed band (±0.04 m inset)
//    [bandHigh → wH]      cool-grey upper horizontal panels
//
//  isInner = true  → innerR, FrontSide
//  isInner = false → outerR, BackSide + mahogany multi-rail handrail
// ═══════════════════════════════════════════════════════════════

function buildWall(mats, isInner) {
  const g = new THREE.Group();
  const { baseH, bandLow, bandHigh, wallHeight: wH, segments } = RING;
  const r       = isInner ? RING.innerR : RING.outerR;
  const side    = isInner ? THREE.FrontSide : THREE.BackSide;
  // Black band recesses slightly away from corridor centre
  const bandR   = isInner ? r - 0.04 : r + 0.04;

  // Clone wall material with correct side
  const panelMat = mats.wallPanel.clone();
  panelMat.side  = side;
  const blackMat = mats.wallBlack.clone();
  blackMat.side  = side;
  const baseMat  = mats.baseboard.clone();
  baseMat.side   = side;

  function cyl(radius, y0, h, mat) {
    const geo  = new THREE.CylinderGeometry(radius, radius, h, segments, 1, true);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y0 + h / 2;
    g.add(mesh);
  }

  function bulgedPanel(rBase, y0, h, mat, isInner) {
    const pts = [];
    const bevel = 0.04; // 4cm bevel height
    const depth = 0.04; // 4cm depth
    
    // Bottom edge
    pts.push(new THREE.Vector2(rBase, y0));
    // Bottom bevel end
    pts.push(new THREE.Vector2(isInner ? rBase + depth : rBase - depth, y0 + bevel));
    // Top bevel start
    pts.push(new THREE.Vector2(isInner ? rBase + depth : rBase - depth, y0 + h - bevel));
    // Top edge
    pts.push(new THREE.Vector2(rBase, y0 + h));

    const geo = new THREE.LatheGeometry(pts, segments);
    const mesh = new THREE.Mesh(geo, mat);
    g.add(mesh);
  }

  cyl(r,      0,        baseH,            baseMat);               // luminous baseboard
  bulgedPanel(r, baseH, bandLow - baseH,  panelMat, isInner);     // lower panel (bulged)
  cyl(bandR,  bandLow,  bandHigh-bandLow, blackMat);              // black recessed band
  bulgedPanel(r, bandHigh, wH - bandHigh, panelMat, isInner);     // upper panel (bulged)

  // Multi-rail mahogany handrail (3 horizontal rails) on both walls
  const railR   = isInner ? RING.innerR + 0.06 : RING.outerR - 0.06;
  const railH   = RING.railH;
  const spacing = 0.055;
  for (let i = -1; i <= 1; i++) {
    const railGeo = new THREE.TorusGeometry(railR, 0.018, 6, segments);
    railGeo.rotateX(Math.PI / 2);
    const rail = new THREE.Mesh(railGeo, mats.handrail);
    rail.position.y = railH + i * spacing;
    g.add(rail);
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  CEILING — flat ring surface + bright rectangular light tiles
// ═══════════════════════════════════════════════════════════════

function buildCeiling(mats) {
  const g = new THREE.Group();
  const { innerR, outerR, radius, segments, segCount, wallHeight: wH } = RING;

  // Flat ring ceiling surface
  const ceilGeo = new THREE.RingGeometry(innerR, outerR, segments);
  ceilGeo.rotateX(Math.PI / 2);   // face downward
  const ceilMesh = new THREE.Mesh(ceilGeo, mats.ceiling);
  ceilMesh.position.y = wH;
  g.add(ceilMesh);

  // Recessed light tiles between rib bays (InstancedMesh)
  const segArcLen = TAU * radius / segCount;
  const tileLen   = 1.50;   // radial span (across corridor)
  const tileWid   = segArcLen * 0.64;  // along corridor direction

  const tileGeo = new THREE.BoxGeometry(tileWid, 0.025, tileLen);
  const tiles   = new THREE.InstancedMesh(tileGeo, mats.ceilPanel, segCount);

  for (let s = 0; s < segCount; s++) {
    const angle = (s + 0.5) / segCount * TAU;   // halfway between ribs
    _obj.position.set(
      Math.sin(angle) * radius,
      wH - 0.008,                               // just below ceiling
      Math.cos(angle) * radius,
    );
    _obj.rotation.set(0, angle, 0);
    _obj.updateMatrix();
    tiles.setMatrixAt(s, _obj.matrix);
  }
  tiles.instanceMatrix.needsUpdate = true;
  g.add(tiles);

  // Tan longitudinal frame members — flank each tile, frame the white panels
  // BoxGeometry: tangential length ≈ tileWid, narrow radial span, thin thickness
  const frameGeo  = new THREE.BoxGeometry(tileWid * 0.95, 0.06, 0.12);
  const frames    = new THREE.InstancedMesh(frameGeo, mats.ceiling, segCount * 2);
  let fi = 0;
  const frameInR  = radius - tileLen * 0.5 - 0.07;
  const frameOutR = radius + tileLen * 0.5 + 0.07;
  for (let s = 0; s < segCount; s++) {
    const angle = (s + 0.5) / segCount * TAU;
    const sinA  = Math.sin(angle);
    const cosA  = Math.cos(angle);
    for (const fr of [frameInR, frameOutR]) {
      _obj.position.set(sinA * fr, wH - 0.003, cosA * fr);
      _obj.rotation.set(0, angle, 0);
      _obj.scale.setScalar(1);
      _obj.updateMatrix();
      frames.setMatrixAt(fi++, _obj.matrix);
    }
  }
  frames.instanceMatrix.needsUpdate = true;
  g.add(frames);

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  PORTAL FRAME RIBS (InstancedMesh — 1 draw call)
//
//  Each rib is a "U" portal: two columns flanking the corridor +
//  a flat horizontal roof-beam connecting them at ceiling level.
//
//  Profile path in local space (Y=up, Z=radially across corridor):
//    Start at inner wall floor → up inner column → flare into
//    ceiling beam → across to outer column top → down to floor.
//
//  Columns have organic flared caps (CatmullRom, tension 0.3).
//  Tube radius 0.05 m gives visible ~0.10 m thickness.
// ═══════════════════════════════════════════════════════════════

function buildRibs(mats) {
  const { innerR, outerR, halfWidth: hw, wallHeight: wH, segCount } = RING;

  const curve = new THREE.CatmullRomCurve3([
    // ── Inner column ────────────────────────────────────────
    new THREE.Vector3(0, 0.00,   -hw),           // base at inner wall
    new THREE.Vector3(0, wH*0.35, -hw),          // column lower
    new THREE.Vector3(0, wH*0.72, -hw),          // column upper
    new THREE.Vector3(0, wH*0.90, -hw*0.85),     // bracket starts spreading
    new THREE.Vector3(0, wH*0.97, -hw*0.55),     // bracket spreads to centre
    // ── Flat ceiling crossbeam ───────────────────────────────
    new THREE.Vector3(0, wH*1.00,  0),           // beam midpoint (crown)
    // ── Outer bracket mirror ─────────────────────────────────
    new THREE.Vector3(0, wH*0.97,  hw*0.55),
    new THREE.Vector3(0, wH*0.90,  hw*0.85),
    new THREE.Vector3(0, wH*0.72,  hw),
    new THREE.Vector3(0, wH*0.35,  hw),
    new THREE.Vector3(0, 0.00,    hw),           // base at outer wall
  ], false, 'catmullrom', 0.30);

  const ribGeo  = new THREE.TubeGeometry(curve, 48, 0.072, 7, false);
  const ribs    = new THREE.InstancedMesh(ribGeo, mats.rib, segCount);

  for (let s = 0; s < segCount; s++) {
    const angle = (s / segCount) * TAU;
    _obj.position.set(
      Math.sin(angle) * RING.radius,
      0,
      Math.cos(angle) * RING.radius,
    );
    _obj.rotation.set(0, angle, 0);
    _obj.scale.setScalar(1);
    _obj.updateMatrix();
    ribs.setMatrixAt(s, _obj.matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;
  return ribs;
}

// ═══════════════════════════════════════════════════════════════
//  DOORS
// ═══════════════════════════════════════════════════════════════

function buildDoors(mats, doorsOut) {
  const g = new THREE.Group();
  const { segCount, doorEvery, outerR, innerR, radius } = RING;
  const count = Math.floor(segCount / doorEvery);

  for (let di = 0; di < count; di++) {
    const seg     = di * doorEvery;
    const angle   = (seg + 0.5) / segCount * TAU;
    const isOuter = (di % 2 === 0);
    const wallR   = isOuter ? outerR - 0.18 : innerR + 0.18;
    const faceR   = isOuter ? angle + Math.PI : angle;

    const dg = new THREE.Group();

    // Frame (matches rib colour)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.70, 2.42, 0.22), mats.doorFrame,
    );
    frame.position.y = 1.21;
    dg.add(frame);

    // Left + Right sliding panels — sit behind the wall surface (negative Z)
    const panGeo = new THREE.BoxGeometry(0.74, 2.20, 0.08);
    const lp = new THREE.Mesh(panGeo, mats.doorPanel);
    lp.position.set(-0.40, 1.10, -0.04);
    dg.add(lp);
    const rp = new THREE.Mesh(panGeo.clone(), mats.doorPanel);
    rp.position.set( 0.40, 1.10, -0.04);
    dg.add(rp);

    // Label canvas above door
    const label = RING.doorLabels[di % RING.doorLabels.length];
    const cv    = document.createElement('canvas');
    cv.width = 256; cv.height = 48;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = '#FF9900';
    ctx.font = 'bold 20px Arial Narrow, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, 128, 34);
    const lm = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.20),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }),
    );
    lm.position.set(0, 2.58, 0.01);
    dg.add(lm);

    // LCARS keypad beside door (both sides, as in TNG)
    // Flush against the wall surface (z ≈ 0.01)
    [-1, 1].forEach(side => {
      const padCv    = document.createElement('canvas');
      padCv.width    = 64;
      padCv.height   = 128;
      const pctx     = padCv.getContext('2d');
      pctx.fillStyle = '#000000';
      pctx.fillRect(0, 0, 64, 128);
      ['#FF9900', '#3399FF', '#CC99FF', '#CC6600'].forEach((c, i) => {
        pctx.fillStyle = c;
        pctx.beginPath();
        pctx.roundRect(4, 4 + i * 30, 56, 24, 6);
        pctx.fill();
      });
      const padTex  = new THREE.CanvasTexture(padCv);
      const padMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.28),
        new THREE.MeshBasicMaterial({ map: padTex }),
      );
      padMesh.position.set(side * 1.05, 1.2, 0.01);
      dg.add(padMesh);
    });

    dg.position.set(Math.sin(angle) * wallR, 0, Math.cos(angle) * wallR);
    dg.rotation.set(0, faceR, 0);
    g.add(dg);
    doorsOut.push({ leftPanel: lp, rightPanel: rp, theta: angle, wallR, open: false, t: 0 });
  }
  return g;
}

// ═══════════════════════════════════════════════════════════════
//  LIGHTING — dark, moody corridor atmosphere
//  Primary light sources are the emissive baseboards (warm white)
//  and emissive ceiling tiles (cool white). A near-black ambient
//  hemisphere ensures walls fall into deep shadow.
//  Two PointLights scatter near floor and ceiling respectively.
// ═══════════════════════════════════════════════════════════════

function buildLighting(root, resources) {
  // The corridor ring is 10 m radius — physically-correct inverse-square
  // decay (Three.js r155+ default) drops PointLight intensity to near zero
  // at that range.  Strategy:
  //   1. HemisphereLight carries the base ambient colour (no distance falloff).
  //   2. PointLights with decay=0 (constant; distance = hard cutoff) add the
  //      warm baseboard glow tint and cool ceiling tint without washing out.

  const hemi = new THREE.HemisphereLight(0xEEF2FF, 0x2A2830, 1.10);
  root.add(hemi);

  // Warm baseboard fill — flat falloff, reaches both walls
  const baseLight = new THREE.PointLight(0xF8F4E8, 1.2, 25, 0);   // decay=0
  baseLight.position.set(0, 0.35, 0);
  root.add(baseLight);
  resources.accentLights.push(baseLight);

  // Cool ceiling fill — flat falloff
  const ceilLight = new THREE.PointLight(0xEEF2FF, 1.0, 25, 0);   // decay=0
  ceilLight.position.set(0, RING.wallHeight * 0.95, 0);
  root.add(ceilLight);
  resources.accentLights.push(ceilLight);
}

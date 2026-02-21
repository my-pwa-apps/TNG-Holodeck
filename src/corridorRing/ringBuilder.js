/**
 * ringBuilder.js — procedural Enterprise-D Lower Deck / Engineering corridor.
 *
 * Aesthetic reference: TNG Engineering/Tech corridor styling —
 *   • Asymmetrical walls:
 *       INNER: Stacked rounded "cushion" panels (grey metallic).
 *       OUTER: Continuous black display/window band + mahogany handrail.
 *   • Large luminous white baseboard panels (0.3m high).
 *   • Tan/beige structural frames (ribs) with "Y" or "T" top profile.
 *   • Floor: Blue centre path, pink/mauve edges.
 *   • Ceiling: Flat angular ribs with large white backlit panels.
 */

import * as THREE from 'three';
import { RING, TAU } from './ringConfig.js';
import { createLCARSPanelTexture } from './textures.js';

const _obj = new THREE.Object3D();

function makeMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.5,
    metalness: opts.metalness ?? 0.2, // slightly metallic "plastic" look
    side:      opts.side      ?? THREE.FrontSide,
    ...opts,
  });
}

export function buildCorridorRing() {
  const root = new THREE.Group();
  const P    = RING.palette;

  const mats = {
    // Floor
    carpetMain:   makeMat(P.carpetMain,   { roughness: 0.9, metalness: 0.05 }),
    carpetPath:   makeMat(P.carpetStripe, { roughness: 0.9, metalness: 0.05 }),

    // Walls
    wallBase:     new THREE.MeshStandardMaterial({
      color: P.baseboard, emissive: P.baseboard, emissiveIntensity: 1.5, roughness: 0.4
    }),
    wallPanel:    makeMat(P.wallPanel, { roughness: 0.4, metalness: 0.3 }),
    wallBlack:    makeMat(P.wallBlack, { roughness: 0.2, metalness: 0.8 }), // Glossy screen/window

    // Structure
    rib:          makeMat(P.rib,       { roughness: 0.7, metalness: 0.1 }),
    handrail:     makeMat(P.handrail,  { roughness: 0.3, metalness: 0.1 }),

    // Ceiling
    ceiling:      makeMat(P.ceiling,   { roughness: 0.8 }),
    ceilLight:    new THREE.MeshStandardMaterial({
      color: P.ceilPanel, emissive: P.ceilPanel, emissiveIntensity: 1.2, roughness: 0.4
    }),

    doorFrame:    makeMat(P.doorFrame, { roughness: 0.6 }),
    doorPanel:    makeMat(P.doorPanel, { roughness: 0.5, metalness: 0.4 }),
  };

  const doors     = [];
  const resources = { doors, mats, ceilLightMat: mats.ceilLight, accentLights: [] };

  root.add(buildFloor(mats));
  root.add(buildOuterWall(mats));  // Window/display wall
  root.add(buildInnerWall(mats));  // Stacked equipment panel wall
  root.add(buildCeiling(mats));
  root.add(buildRibs(mats));
  root.add(buildDoors(mats, doors));
  buildLighting(root, resources);

  return { root, resources };
}

// ═══════════════════════════════════════════════════════════════════════════
//  FLOOR — Pink outer edges (base), wide Blue centre path
// ═══════════════════════════════════════════════════════════════════════════

function buildFloor(mats) {
  const g = new THREE.Group();
  const { innerR, outerR, radius, segments } = RING;

  // Pink/mauve base (full width)
  const baseGeo = new THREE.RingGeometry(innerR, outerR, segments);
  baseGeo.rotateX(-Math.PI / 2);
  g.add(new THREE.Mesh(baseGeo, mats.carpetMain));

  // Blue centre path (approx 1.4m wide)
  const pathHalfW = 0.7;
  const pathGeo = new THREE.RingGeometry(radius - pathHalfW, radius + pathHalfW, segments);
  pathGeo.rotateX(-Math.PI / 2);
  const path = new THREE.Mesh(pathGeo, mats.carpetPath);
  path.position.y = 0.002;
  g.add(path);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  OUTER WALL (BackSide) — Continuous black band, handrail, luminous base
// ═══════════════════════════════════════════════════════════════════════════

function buildOuterWall(mats) {
  const g = new THREE.Group();
  const { outerR, baseH, bandLow, bandHigh, wallHeight, segments } = RING;

  // 1. Luminous Base (0 -> baseH)
  const baseGeo = new THREE.CylinderGeometry(outerR, outerR, baseH, segments, 1, true);
  const base = new THREE.Mesh(baseGeo, mats.wallBase);
  base.material.side = THREE.BackSide;
  base.position.y = baseH / 2;
  g.add(base);

  // 2. Lower Grey Panel (baseH -> bandLow)
  const lowerH = bandLow - baseH;
  const lowerGeo = new THREE.CylinderGeometry(outerR, outerR, lowerH, segments, 1, true);
  const lower = new THREE.Mesh(lowerGeo, mats.wallPanel);
  lower.material.side = THREE.BackSide;
  lower.position.y = baseH + lowerH / 2;
  g.add(lower);

  // 3. Black Band (bandLow -> bandHigh) — slightly recessed?
  // Make it flush or slightly recessed. Let's recess it 0.05m outward (larger R).
  const bandR = outerR + 0.05;
  const bandH = bandHigh - bandLow;
  const bandGeo = new THREE.CylinderGeometry(bandR, bandR, bandH, segments, 1, true);
  const band = new THREE.Mesh(bandGeo, mats.wallBlack);
  band.material.side = THREE.BackSide;
  band.position.y = bandLow + bandH / 2;
  g.add(band);

  // 4. Upper Grey Panel (bandHigh -> wallHeight)
  const upperH = wallHeight - bandHigh;
  const upperGeo = new THREE.CylinderGeometry(outerR, outerR, upperH, segments, 1, true);
  const upper = new THREE.Mesh(upperGeo, mats.wallPanel);
  upper.material.side = THREE.BackSide;
  upper.position.y = bandHigh + upperH / 2;
  g.add(upper);

  // 5. Handrail (at RING.railH)
  const railGeo = new THREE.TorusGeometry(outerR - 0.08, 0.04, 8, segments);
  railGeo.rotateX(Math.PI / 2);
  const rail = new THREE.Mesh(railGeo, mats.handrail);
  rail.position.y = RING.railH;
  g.add(rail);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  INNER WALL (FrontSide) — Stacked "cushion" panels, No black band
// ═══════════════════════════════════════════════════════════════════════════

function buildInnerWall(mats) {
  const g = new THREE.Group();
  const { innerR, baseH, wallHeight, segments, segCount } = RING;

  // 1. Luminous Base (continuous)
  const baseGeo = new THREE.CylinderGeometry(innerR, innerR, baseH, segments, 1, true);
  const base = new THREE.Mesh(baseGeo, mats.wallBase);
  base.position.y = baseH / 2;
  g.add(base);

  // 2. Stacked Panels (InstancedMesh)
  // We place distinct puffy panels between ribs.
  // Area: baseH -> wallHeight.
  // Let's stack 2 large panels vertically.
  // Z-arc per panel: slightly less than segArc.
  const panelH = (wallHeight - baseH) / 2 - 0.05; // gap
  const panelW = RING.segArc * 0.9;
  const panelD = 0.15; // thickness (puffy)

  const boxGeo = new THREE.BoxGeometry(panelW, panelH, panelD);
  // Position origin at back-center for easier placement
  boxGeo.translate(0, 0, -panelD / 2);

  const count = segCount * 2; // 2 rows per segment
  const panels = new THREE.InstancedMesh(boxGeo, mats.wallPanel, count);

  let idx = 0;
  for (let s = 0; s < segCount; s++) {
    const angle = (s + 0.5) / segCount * TAU; // center of bay

    // Row 1 (Lower)
    _obj.position.set(
      Math.sin(angle) * innerR,
      baseH + 0.05 + panelH / 2,
      Math.cos(angle) * innerR
    );
    _obj.rotation.set(0, angle, 0);
    _obj.updateMatrix();
    panels.setMatrixAt(idx++, _obj.matrix);

    // Row 2 (Upper)
    _obj.position.set(
      Math.sin(angle) * innerR,
      baseH + 0.05 + panelH + 0.05 + panelH / 2,
      Math.cos(angle) * innerR
    );
    _obj.rotation.set(0, angle, 0);
    _obj.updateMatrix();
    panels.setMatrixAt(idx++, _obj.matrix);
  }
  panels.instanceMatrix.needsUpdate = true;
  g.add(panels);

  // 3. Handrail (Optional on inner wall? Image shows it on both, but maybe distinct style)
  // Let's add a simple rail to match.
  const railGeo = new THREE.TorusGeometry(innerR + 0.08, 0.04, 8, segments);
  railGeo.rotateX(Math.PI / 2);
  const rail = new THREE.Mesh(railGeo, mats.handrail);
  rail.position.y = RING.railH;
  g.add(rail);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  CEILING — Flat ribs with backlit panels
// ═══════════════════════════════════════════════════════════════════════════

function buildCeiling(mats) {
  const g = new THREE.Group();
  const { segCount, radius, wallHeight } = RING;
  
  // Create a lattice of lights between ribs.
  // Panels are trapezoidal segments.
  const panelLen = 1.8; // Radial length across corridor
  const panelWid = RING.segArc * 0.85; 

  const boxGeo = new THREE.BoxGeometry(panelWid, 0.05, panelLen);
  const lights = new THREE.InstancedMesh(boxGeo, mats.ceilLight, segCount);

  for (let s = 0; s < segCount; s++) {
    const angle = (s + 0.5) / segCount * TAU;
    _obj.position.set(
      Math.sin(angle) * radius,
      wallHeight + 0.1, // Just above wall top
      Math.cos(angle) * radius
    );
    _obj.rotation.set(0, angle, 0);
    _obj.updateMatrix();
    lights.setMatrixAt(s, _obj.matrix);
  }
  lights.instanceMatrix.needsUpdate = true;
  g.add(lights);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
//  STRUCTURE RIBS — Tan frames at every segment
// ═══════════════════════════════════════════════════════════════════════════

function buildRibs(mats) {
  const { innerR, outerR, wallHeight, segCount } = RING;
  
  // Construct a single rib shape using ExtrudeGeometry or Shape.
  // It needs to span from innerR to outerR at wallHeight,
  // and have vertical legs down to the floor.
  
  const shape = new THREE.Shape();
  const w = 0.25; // rib width
  const d = 0.40; // rib depth (radial)

  // Profile: Rectangular beam for simplicity
  shape.moveTo(-w/2, -d/2);
  shape.lineTo( w/2, -d/2);
  shape.lineTo( w/2,  d/2);
  shape.lineTo(-w/2,  d/2);
  
  // We need an arch path.
  // Path: Up Inner Wall -> Across Ceiling -> Down Outer Wall.
  const curve = new THREE.CurvePath();

  // 1. Inner Leg (vertical)
  const line1 = new THREE.LineCurve3(
    new THREE.Vector3(0, 0, -RING.halfWidth),
    new THREE.Vector3(0, wallHeight, -RING.halfWidth)
  );
  // 2. Ceiling Span (flat, slightly arched?)
  // Image shows flat ceiling beams.
  const line2 = new THREE.LineCurve3(
    new THREE.Vector3(0, wallHeight, -RING.halfWidth),
    new THREE.Vector3(0, wallHeight, RING.halfWidth)
  );
  // 3. Outer Leg (vertical)
  const line3 = new THREE.LineCurve3(
    new THREE.Vector3(0, wallHeight, RING.halfWidth),
    new THREE.Vector3(0, 0, RING.halfWidth)
  );
  
  curve.add(line1);
  curve.add(line2);
  curve.add(line3);

  const geo = new THREE.TubeGeometry(curve, 32, 0.15, 8, false); // 0.15 radius = 0.3m thick
  const ribs = new THREE.InstancedMesh(geo, mats.rib, segCount);

  for (let s = 0; s < segCount; s++) {
    const angle = s / segCount * TAU;
    _obj.position.set(
      Math.sin(angle) * RING.radius,
      0,
      Math.cos(angle) * RING.radius
    );
    _obj.rotation.set(0, angle, 0);
    _obj.updateMatrix();
    ribs.setMatrixAt(s, _obj.matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;
  return ribs;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOORS
// ═══════════════════════════════════════════════════════════════════════════

function buildDoors(mats, doorsOut) {
  const g = new THREE.Group();
  const { doorEvery, radius, innerR, outerR } = RING;
  // ... basic door logic similar to before, simplified ...
  // Reuse existing logic roughly to ensure door placement works.
  
  const count = Math.floor(RING.segCount / doorEvery);
  for (let i = 0; i < count; i++) {
    const seg = i * doorEvery;
    const angle = (seg + 0.5) / RING.segCount * TAU;
    const isOuter = (i % 2 === 0);
    const r = isOuter ? outerR - 0.2 : innerR + 0.2;
    
    // Simple Door visuals
    const dGroup = new THREE.Group();
    
    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.2), mats.doorFrame);
    frame.position.y = 1.2;
    dGroup.add(frame);
    
    // Panels
    const panels = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.1), mats.doorPanel);
    panels.position.y = 1.2;
    dGroup.add(panels);
    
    dGroup.position.set(Math.sin(angle)*r, 0, Math.cos(angle)*r);
    dGroup.lookAt(Math.sin(angle)*radius, 0, Math.cos(angle)*radius); // look at center of corridor
    if (isOuter) dGroup.rotateY(Math.PI);
    
    g.add(dGroup);
  }
  
  return g;
}


// ═══════════════════════════════════════════════════════════════════════════
//  LIGHTING
// ═══════════════════════════════════════════════════════════════════════════

function buildLighting(root, resources) {
  // Bright, clean tech look.
  const hemi = new THREE.HemisphereLight(0xFFFFFF, 0xAA99AA, 1.2);
  root.add(hemi);

  // Accent lights for panels
  // ...
}


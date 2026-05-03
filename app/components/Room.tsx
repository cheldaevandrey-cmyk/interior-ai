"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type FurnitureType = "sofa" | "table" | "bed" | "wardrobe";
export type OpeningType   = "window" | "door";

export interface FurnitureMeta {
  name?: string;
  price?: number;
  photo?: string;
  url?: string;
  glbUrl?: string;
}

export interface RoomHandle {
  addFurniture(type: FurnitureType, meta?: FurnitureMeta): void;
  setFurnitureColor(id: string, hex: string): void;
  addOpening(type: OpeningType): void;
}

interface RoomProps {
  width: number; length: number; height: number;
  wallColor: string; ceilingColor: string; floorColor: string;
  onFurnitureSelect?: (id: string | null, color: string, meta?: FurnitureMeta) => void;
  onGlbLoaded?: (id: string) => void;
}

interface FurnitureItem {
  id: string; type: FurnitureType; group: THREE.Group; color: string;
  meta?: FurnitureMeta;
}

interface OpeningItem {
  id: string; type: OpeningType;
  wallIndex: 0 | 1 | 2;
  t: number;
  group: THREE.Group;
}

// ── palette ───────────────────────────────────────────────────────────
const C = { bg: 0xf4efe7, base: 0xe2dbd1, lamp: 0xfaf6f0 };

const DEFAULT_COLORS: Record<FurnitureType, string> = {
  sofa: "#d0c5b8", table: "#cdb99a", bed: "#d0c8bc", wardrobe: "#d5cfc8",
};

// ── opening dimensions (shared between builders & wall mesh) ──────────
const WIN_IW = 1.0, WIN_IH = 1.0, WIN_SILL = 0.9;
const DOOR_IW = 0.9, DOOR_IH = 2.1;
const FRAME_T = 0.07, FRAME_D = 0.10;
const OPENING_MARGIN = 0.65;

// ── geometry helper ───────────────────────────────────────────────────
function bx(
  g: THREE.Group, w: number, h: number, d: number, color: number,
  x: number, y: number, z: number, rough = 0.85, colorable = false
) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough })
  );
  m.position.set(x, y, z);
  if (colorable) m.userData.colorable = true;
  g.add(m);
}

// ── furniture builders ────────────────────────────────────────────────
function makeSofa(): THREE.Group {
  const g = new THREE.Group();
  const legH = 0.09, seatH = 0.27, seatW = 2.0, seatD = 0.9;
  const backH = 0.55, backT = 0.14, armW = 0.18, armH = 0.50;
  const seatY = legH + seatH / 2, seatTop = legH + seatH;
  bx(g, seatW, seatH, seatD, 0xd0c5b8, 0, seatY, 0, 0.85, true);
  bx(g, seatW, backH, backT, 0xbdb2a6, 0, seatTop + backH / 2, -(seatD / 2 - backT / 2), 0.85, true);
  bx(g, armW, armH, seatD + backT, 0xbdb2a6, -(seatW / 2 + armW / 2), legH + armH / 2, -backT / 2, 0.85, true);
  bx(g, armW, armH, seatD + backT, 0xbdb2a6,  (seatW / 2 + armW / 2), legH + armH / 2, -backT / 2, 0.85, true);
  const lx = seatW / 2 - 0.15, lz = seatD / 2 - 0.12;
  [[lx,lz],[-lx,lz],[lx,-lz],[-lx,-lz]].forEach(([x,z]) => bx(g,0.07,legH,0.07,0xcfc8be,x,legH/2,z,0.7));
  return g;
}

function makeTable(): THREE.Group {
  const g = new THREE.Group();
  const tw = 1.6, th = 0.06, td = 0.9, legH = 0.72;
  bx(g, tw, th, td, 0xcdb99a, 0, legH + th / 2, 0, 0.85, true);
  const lx = tw / 2 - 0.1, lz = td / 2 - 0.08;
  [[lx,lz],[-lx,lz],[lx,-lz],[-lx,-lz]].forEach(([x,z]) => bx(g,0.06,legH,0.06,0xcdb99a,x,legH/2,z,0.85,true));
  return g;
}

function makeBed(): THREE.Group {
  const g = new THREE.Group();
  const fw = 1.8, fh = 0.22, fd = 2.2, legH = 0.15, mh = 0.22, md = 2.0, hbH = 0.72, hbT = 0.1;
  bx(g, fw, fh, fd, 0xd0c8bc, 0, legH + fh / 2, 0, 0.85, true);
  bx(g, fw - 0.1, mh, md, 0xe8e0d5, 0, legH + fh + mh / 2, 0, 0.85, true);
  bx(g, fw, hbH, hbT, 0xd0c8bc, 0, legH + hbH / 2, -(fd / 2 - hbT / 2), 0.85, true);
  const lx = fw / 2 - 0.1, lz = fd / 2 - 0.1;
  [[lx,lz],[-lx,lz],[lx,-lz],[-lx,-lz]].forEach(([x,z]) => bx(g,0.07,legH,0.07,0xcfc8be,x,legH/2,z,0.7));
  return g;
}

function makeWardrobe(): THREE.Group {
  const g = new THREE.Group();
  const ww = 1.8, wh = 2.1, wd = 0.6;
  bx(g, ww, wh, wd, 0xd5cfc8, 0, wh / 2, 0, 0.85, true);
  bx(g, 0.025, wh - 0.05, wd + 0.01, 0xbcb5af, 0, wh / 2, 0);
  bx(g, 0.025, 0.12, 0.04, 0xb0a89e, -0.15, wh / 2, wd / 2 + 0.005);
  bx(g, 0.025, 0.12, 0.04, 0xb0a89e,  0.15, wh / 2, wd / 2 + 0.005);
  return g;
}

const BUILDERS: Record<FurnitureType, () => THREE.Group> = {
  sofa: makeSofa, table: makeTable, bed: makeBed, wardrobe: makeWardrobe,
};

// ── opening builders ──────────────────────────────────────────────────
// Local origin = wall surface at floor level; +z faces room interior

function makeWindowGroup(): THREE.Group {
  const g = new THREE.Group();
  const fc = 0xd4cec8, hd = FRAME_D / 2;

  // Frame rails and stiles
  bx(g, WIN_IW + 2*FRAME_T, FRAME_T, FRAME_D, fc, 0, WIN_SILL + FRAME_T/2, hd);
  bx(g, WIN_IW + 2*FRAME_T, FRAME_T, FRAME_D, fc, 0, WIN_SILL + FRAME_T + WIN_IH + FRAME_T/2, hd);
  bx(g, FRAME_T, WIN_IH, FRAME_D, fc, -(WIN_IW/2 + FRAME_T/2), WIN_SILL + FRAME_T + WIN_IH/2, hd);
  bx(g, FRAME_T, WIN_IH, FRAME_D, fc,  (WIN_IW/2 + FRAME_T/2), WIN_SILL + FRAME_T + WIN_IH/2, hd);
  // Center vertical bar
  bx(g, 0.04, WIN_IH, 0.04, fc, 0, WIN_SILL + FRAME_T + WIN_IH/2, hd);

  // Glass panes — semi-transparent, nearly invisible
  const paneW = (WIN_IW - 0.04) / 2;
  const paneY = WIN_SILL + FRAME_T + WIN_IH / 2;
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xc8e0f4, transparent: true, opacity: 0.18,
    roughness: 0.0, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false,
  });
  const xOff = 0.02 + paneW / 2;
  [-xOff, xOff].forEach(x => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(paneW, WIN_IH), glassMat.clone());
    pane.position.set(x, paneY, hd + 0.001);
    g.add(pane);
  });

  return g;
}

function makeDoorGroup(): THREE.Group {
  const g = new THREE.Group();
  const fc = 0xcdc7c0, hd = FRAME_D / 2;

  bx(g, DOOR_IW + 2*FRAME_T, FRAME_T, FRAME_D, fc, 0, DOOR_IH + FRAME_T/2, hd);
  bx(g, FRAME_T, DOOR_IH + FRAME_T, FRAME_D, fc, -(DOOR_IW/2 + FRAME_T/2), (DOOR_IH + FRAME_T)/2, hd);
  bx(g, FRAME_T, DOOR_IH + FRAME_T, FRAME_D, fc,  (DOOR_IW/2 + FRAME_T/2), (DOOR_IH + FRAME_T)/2, hd);
  bx(g, DOOR_IW, DOOR_IH, 0.05, 0xc8c2bb, 0, DOOR_IH/2, 0.025, 0.85);
  bx(g, DOOR_IW*0.7, DOOR_IH*0.38, 0.01, 0xbfb9b2, 0, DOOR_IH*0.70, 0.056);
  bx(g, DOOR_IW*0.7, DOOR_IH*0.38, 0.01, 0xbfb9b2, 0, DOOR_IH*0.28, 0.056);
  bx(g, 0.035, 0.12, 0.035, 0xb0a898, DOOR_IW/2 - 0.1, DOOR_IH*0.46, 0.07);

  return g;
}

// ── wall mesh with holes (ShapeGeometry) ──────────────────────────────
// ShapeGeometry lives in local XY plane; each wall is rotated into place.
// Coordinate convention per wall:
//   back  (0): shape u=world x, v=world y; mesh at z=-L/2
//   left  (1): shape u→world -z (u=L/2-t*L), v=world y; mesh at x=-W/2, rot.y=+π/2
//   right (2): shape u=world z (u=-L/2+t*L), v=world y; mesh at x=+W/2, rot.y=-π/2

function buildWallMesh(
  wallIndex: 0 | 1 | 2,
  W: number, L: number, H: number,
  wallColor: string,
  openings: OpeningItem[]
): THREE.Mesh {
  const wallLen = wallIndex === 0 ? W : L;
  const wallOpenings = openings.filter(o => o.wallIndex === wallIndex);

  const shape = new THREE.Shape();
  shape.moveTo(-wallLen / 2, -H / 2);
  shape.lineTo( wallLen / 2, -H / 2);
  shape.lineTo( wallLen / 2,  H / 2);
  shape.lineTo(-wallLen / 2,  H / 2);
  shape.closePath();

  for (const o of wallOpenings) {
    if (wallLen < 2 * OPENING_MARGIN + 0.1) continue;

    let rawU: number;
    if (wallIndex === 0) rawU = -W / 2 + o.t * W;
    else if (wallIndex === 1) rawU = L / 2 - o.t * L;
    else rawU = -L / 2 + o.t * L;

    const uC = Math.max(-wallLen/2 + OPENING_MARGIN, Math.min(wallLen/2 - OPENING_MARGIN, rawU));

    let uHalf: number, vMin: number, vMax: number;
    if (o.type === "window") {
      uHalf = WIN_IW / 2 + FRAME_T;
      vMin  = -H / 2 + WIN_SILL;
      vMax  = -H / 2 + WIN_SILL + WIN_IH + 2 * FRAME_T;
    } else {
      uHalf = DOOR_IW / 2 + FRAME_T;
      vMin  = -H / 2;
      vMax  = -H / 2 + DOOR_IH + FRAME_T;
    }

    const uMin = Math.max(-wallLen / 2, uC - uHalf);
    const uMax = Math.min( wallLen / 2, uC + uHalf);
    vMax = Math.min(H / 2 - 0.001, vMax);

    if (uMax <= uMin || vMax <= vMin) continue;

    const hole = new THREE.Path();
    hole.moveTo(uMin, vMin);
    hole.lineTo(uMax, vMin);
    hole.lineTo(uMax, vMax);
    hole.lineTo(uMin, vMax);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(wallColor), roughness: 0.9, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.role = "wall";

  if (wallIndex === 0) {
    mesh.position.set(0, 0, -L / 2);
  } else if (wallIndex === 1) {
    mesh.position.set(-W / 2, 0, 0);
    mesh.rotation.y = Math.PI / 2;
  } else {
    mesh.position.set(W / 2, 0, 0);
    mesh.rotation.y = -Math.PI / 2;
  }

  return mesh;
}

function replaceWallMesh(
  wallIndex: 0 | 1 | 2,
  scene: THREE.Scene,
  wallMeshes: (THREE.Mesh | null)[],
  W: number, L: number, H: number,
  wallColor: string,
  openings: OpeningItem[]
) {
  const old = wallMeshes[wallIndex];
  if (old) {
    scene.remove(old);
    old.geometry.dispose();
    (old.material as THREE.Material).dispose();
  }
  const mesh = buildWallMesh(wallIndex, W, L, H, wallColor, openings);
  scene.add(mesh);
  wallMeshes[wallIndex] = mesh;
}

// ── position opening on wall ──────────────────────────────────────────
function positionOpening(item: OpeningItem, W: number, L: number, H: number) {
  const floorY = -H / 2, eps = 0.01;
  switch (item.wallIndex) {
    case 0: {
      const x = Math.max(-W/2 + OPENING_MARGIN, Math.min(W/2 - OPENING_MARGIN, -W/2 + item.t * W));
      item.group.position.set(x, floorY, -L/2 + eps);
      item.group.rotation.set(0, 0, 0);
      break;
    }
    case 1: {
      const z = Math.max(-L/2 + OPENING_MARGIN, Math.min(L/2 - OPENING_MARGIN, -L/2 + item.t * L));
      item.group.position.set(-W/2 + eps, floorY, z);
      item.group.rotation.set(0, Math.PI / 2, 0);
      break;
    }
    case 2: {
      const z = Math.max(-L/2 + OPENING_MARGIN, Math.min(L/2 - OPENING_MARGIN, -L/2 + item.t * L));
      item.group.position.set(W/2 - eps, floorY, z);
      item.group.rotation.set(0, -Math.PI / 2, 0);
      break;
    }
  }
}

// ── footprints & OBB collision ────────────────────────────────────────
const FOOTPRINTS: Record<FurnitureType, [number, number]> = {
  sofa: [1.22, 0.55], table: [0.84, 0.50], bed: [0.96, 1.15], wardrobe: [0.93, 0.32],
};

function obbOverlap(
  ax: number, az: number, ahw: number, ahd: number, arY: number,
  bx: number, bz: number, bhw: number, bhd: number, brY: number
): boolean {
  const corners = (cx: number, cz: number, hw: number, hd: number, ry: number) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    return ([[hw,hd],[-hw,hd],[-hw,-hd],[hw,-hd]] as [number,number][])
      .map(([lx, lz]) => [cx + lx*c - lz*s, cz + lx*s + lz*c] as [number,number]);
  };
  const ca = corners(ax, az, ahw, ahd, arY), cb = corners(bx, bz, bhw, bhd, brY);
  const axes: [number,number][] = [
    [Math.cos(arY), Math.sin(arY)], [-Math.sin(arY), Math.cos(arY)],
    [Math.cos(brY), Math.sin(brY)], [-Math.sin(brY), Math.cos(brY)],
  ];
  for (const [nx, nz] of axes) {
    const pa = ca.map(([x, z]) => x*nx + z*nz), pb = cb.map(([x, z]) => x*nx + z*nz);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

// ── room base (floor, ceiling, molding, lamp — no walls) ─────────────
function buildRoomBase(
  W: number, L: number, H: number,
  ceilingColor: string, floorColor: string
): THREE.Group {
  const group = new THREE.Group();
  const makeMat = (hex: string) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.9, side: THREE.DoubleSide });

  const floorM = new THREE.Mesh(new THREE.PlaneGeometry(W, L), makeMat(floorColor));
  floorM.rotation.x = -Math.PI / 2; floorM.position.y = -H / 2; floorM.userData.role = "floor"; group.add(floorM);

  const ceilM = new THREE.Mesh(new THREE.PlaneGeometry(W, L), makeMat(ceilingColor));
  ceilM.rotation.x = Math.PI / 2; ceilM.position.y = H / 2; ceilM.userData.role = "ceiling"; group.add(ceilM);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.1, 0.05),
    new THREE.MeshStandardMaterial({ color: C.base })
  );
  base.position.set(0, -H/2 + 0.05, -L/2 + 0.025); group.add(base);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.22, 0.08, 20),
    new THREE.MeshStandardMaterial({ color: C.lamp, emissive: 0xfff5e0, emissiveIntensity: 0.4 })
  );
  lamp.position.set(0, H/2 - 0.05, -L/4); group.add(lamp);

  return group;
}

// ── GLB model normalisation ───────────────────────────────────────────
// Scales the loaded scene so its longest horizontal axis fits targetW,
// then floors it at y=0 relative to the group origin.
function normalizeGlb(scene: THREE.Group, targetW = 2.0) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxH = Math.max(size.x, size.z);
  const scale = maxH > 0 ? targetW / maxH : 1;
  scene.scale.setScalar(scale);

  // After scaling, re-compute box and shift so bottom sits at y=0
  box.setFromObject(scene);
  scene.position.y -= box.min.y;
}

function makePlaceholderSofa(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd0c5b8, transparent: true, opacity: 0.35,
    roughness: 0.85,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 0.9), mat);
  mesh.position.y = 0.4;
  mesh.userData.colorable = true;
  mesh.userData.isPlaceholder = true;
  g.add(mesh);
  return g;
}

function disposeGroup(g: THREE.Group) {
  g.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
    }
  });
}

function applyFurnitureColor(item: FurnitureItem, hex: string) {
  item.color = hex;
  item.group.traverse(obj => {
    if (obj instanceof THREE.Mesh && obj.userData.colorable)
      (obj.material as THREE.MeshStandardMaterial).color.setStyle(hex);
  });
}

function setHighlight(item: FurnitureItem | null | undefined, on: boolean) {
  if (!item) return;
  item.group.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(on ? 0x555555 : 0x000000);
      mat.emissiveIntensity = on ? 0.12 : 0;
    }
  });
}

// ── component ─────────────────────────────────────────────────────────
const Room = forwardRef<RoomHandle, RoomProps>((
  { width, length, height, wallColor, ceilingColor, floorColor, onFurnitureSelect, onGlbLoaded },
  ref
) => {
  const mountRef         = useRef<HTMLDivElement>(null);
  const sceneRef         = useRef<THREE.Scene | null>(null);
  const rendererRef      = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef        = useRef<THREE.PerspectiveCamera | null>(null);
  const roomGroupRef     = useRef<THREE.Group | null>(null);
  const wallMeshesRef    = useRef<(THREE.Mesh | null)[]>([null, null, null]);
  const ceilLightRef     = useRef<THREE.PointLight | null>(null);
  const lookAtRef        = useRef(new THREE.Vector3(0, 0, 0));
  const orbitRef         = useRef({ theta: 0.55, phi: 1.05, radius: 14, velTheta: 0, velPhi: 0 });
  const furnitureRef     = useRef<FurnitureItem[]>([]);
  const meshToItemRef    = useRef(new Map<THREE.Object3D, FurnitureItem>());
  const openingsRef      = useRef<OpeningItem[]>([]);
  const meshToOpeningRef = useRef(new Map<THREE.Object3D, OpeningItem>());
  const wallPlanesRef    = useRef<THREE.Plane[]>([]);
  const wallDirtyRef     = useRef<Set<number>>(new Set());
  const floorRayRef      = useRef<THREE.Mesh | null>(null);
  const dimsRef          = useRef({ width, length, height });
  const wallColorRef     = useRef(wallColor);
  const idRef            = useRef(0);
  const selectedRef      = useRef<string | null>(null);
  const onSelectRef      = useRef(onFurnitureSelect);
  const onGlbLoadedRef   = useRef(onGlbLoaded);

  useEffect(() => { dimsRef.current = { width, length, height }; }, [width, length, height]);
  useEffect(() => { wallColorRef.current = wallColor; }, [wallColor]);
  useEffect(() => { onSelectRef.current = onFurnitureSelect; }, [onFurnitureSelect]);
  useEffect(() => { onGlbLoadedRef.current = onGlbLoaded; }, [onGlbLoaded]);

  useImperativeHandle(ref, () => ({
    addFurniture(type: FurnitureType, meta?: FurnitureMeta) {
      const scene = sceneRef.current; if (!scene) return;
      const { width: W, length: L, height: H } = dimsRef.current;

      const spread = Math.min(1.2, Math.min(W, L) / 2 - 0.8);
      const ox = spread > 0 ? (Math.random() - 0.5) * spread * 2 : 0;
      const oz = spread > 0 ? (Math.random() - 0.5) * spread * 2 : 0;

      const useGlb = type === "sofa" && !!meta?.glbUrl;

      // For sofas with GLB: show placeholder, then swap in real model
      const initialGroup = useGlb ? makePlaceholderSofa() : BUILDERS[type]();
      initialGroup.position.set(ox, -H / 2, oz);
      scene.add(initialGroup);

      const item: FurnitureItem = {
        id: `f${idRef.current++}`, type, group: initialGroup,
        color: DEFAULT_COLORS[type], meta,
      };
      furnitureRef.current.push(item);
      initialGroup.traverse(o => { if (o instanceof THREE.Mesh) meshToItemRef.current.set(o, item); });

      if (useGlb) {
        const loader = new GLTFLoader();
        loader.load(
          meta!.glbUrl!,
          (gltf) => {
            const scene3d = sceneRef.current;
            if (!scene3d) return;

            // Make sure item is still in the scene (not deleted by user)
            if (!furnitureRef.current.find(i => i.id === item.id)) return;

            const glbGroup = gltf.scene as THREE.Group;
            normalizeGlb(glbGroup);

            // Mark all meshes colorable so color picker works
            glbGroup.traverse(o => {
              if (o instanceof THREE.Mesh) {
                if (Array.isArray(o.material)) {
                  o.material.forEach(m => { (m as THREE.MeshStandardMaterial).roughness = 0.8; });
                } else {
                  (o.material as THREE.MeshStandardMaterial).roughness = 0.8;
                }
                o.userData.colorable = true;
              }
            });

            // Preserve position & rotation from placeholder
            const pos = item.group.position.clone();
            const rotY = item.group.rotation.y;

            // Unregister placeholder meshes
            item.group.traverse(o => meshToItemRef.current.delete(o));
            scene3d.remove(item.group);
            disposeGroup(item.group);

            // Register GLB meshes
            glbGroup.position.copy(pos);
            glbGroup.rotation.y = rotY;
            scene3d.add(glbGroup);
            item.group = glbGroup;
            glbGroup.traverse(o => { if (o instanceof THREE.Mesh) meshToItemRef.current.set(o, item); });

            // Re-apply color if user already changed it
            if (item.color !== DEFAULT_COLORS[type]) applyFurnitureColor(item, item.color);

            // Notify parent that GLB is ready
            onGlbLoadedRef.current?.(item.id);
          },
          undefined,
          () => {
            // GLB load failed — silently keep placeholder as box
            console.warn("GLB load failed, keeping placeholder");
          }
        );
      }
    },
    setFurnitureColor(id: string, hex: string) {
      const item = furnitureRef.current.find(i => i.id === id);
      if (item) applyFurnitureColor(item, hex);
    },
    addOpening(type: OpeningType) {
      const scene = sceneRef.current; if (!scene) return;
      const { width: W, length: L, height: H } = dimsRef.current;
      const wallIndex = Math.floor(Math.random() * 3) as 0 | 1 | 2;
      const t = 0.3 + Math.random() * 0.4;
      const group = type === "window" ? makeWindowGroup() : makeDoorGroup();
      scene.add(group);
      const item: OpeningItem = { id: `o${idRef.current++}`, type, wallIndex, t, group };
      openingsRef.current.push(item);
      group.traverse(o => { if (o instanceof THREE.Mesh) meshToOpeningRef.current.set(o, item); });
      positionOpening(item, W, L, H);
      replaceWallMesh(wallIndex, scene, wallMeshesRef.current, W, L, H, wallColorRef.current, openingsRef.current);
    },
  }));

  // ── init (once) ───────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.bg);
    scene.fog = new THREE.Fog(C.bg, 30, 48);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 100);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xfff8f0, 0.7));
    const fill = new THREE.DirectionalLight(0xf0ebe3, 0.5);
    fill.position.set(6, 4, 6); scene.add(fill);

    const ceilLight = new THREE.PointLight(0xfffaf0, 1.8, 18);
    scene.add(ceilLight); ceilLightRef.current = ceilLight;

    const floorRay = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    floorRay.rotation.x = -Math.PI / 2;
    scene.add(floorRay); floorRayRef.current = floorRay;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const setMouse = (cx: number, cy: number) => {
      const r = mount.getBoundingClientRect();
      mouse.x =  ((cx - r.left) / r.width)  * 2 - 1;
      mouse.y = -((cy - r.top)  / r.height) * 2 + 1;
    };

    const hitFurniture = (): FurnitureItem | null => {
      const meshes: THREE.Mesh[] = [];
      furnitureRef.current.forEach(it => it.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); }));
      if (!meshes.length) return null;
      const hits = raycaster.intersectObjects(meshes);
      return hits.length ? (meshToItemRef.current.get(hits[0].object) ?? null) : null;
    };

    const hitOpening = (): OpeningItem | null => {
      const meshes: THREE.Mesh[] = [];
      openingsRef.current.forEach(it => it.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); }));
      if (!meshes.length) return null;
      const hits = raycaster.intersectObjects(meshes);
      return hits.length ? (meshToOpeningRef.current.get(hits[0].object) ?? null) : null;
    };

    const collides = (item: FurnitureItem, nx: number, nz: number, nrY: number) =>
      furnitureRef.current.some(other => {
        if (other.id === item.id) return false;
        const [hw, hd] = FOOTPRINTS[item.type], [ohw, ohd] = FOOTPRINTS[other.type];
        return obbOverlap(nx, nz, hw, hd, nrY, other.group.position.x, other.group.position.z, ohw, ohd, other.group.rotation.y);
      });

    const orbit = orbitRef.current;
    const MIN_R = 2, MAX_R = 24, MIN_PHI = 0.12, MAX_PHI = Math.PI / 2 + 0.1;

    let orbitActive = false;
    let dragItem:    FurnitureItem | null = null;
    let dragOpening: OpeningItem   | null = null;
    let rotateItem:  FurnitureItem | null = null;
    let rotateStartX = 0, rotateStartRY = 0;
    let prevX = 0, prevY = 0, touchDist = 0;
    let clickCandidate: FurnitureItem | null = null;
    let pointerDownX = 0, pointerDownY = 0;

    const selectItem = (item: FurnitureItem | null) => {
      const old = furnitureRef.current.find(i => i.id === selectedRef.current);
      setHighlight(old, false);
      if (item && item.id !== selectedRef.current) {
        setHighlight(item, true);
        selectedRef.current = item.id;
        onSelectRef.current?.(item.id, item.color, item.meta);
      } else {
        selectedRef.current = null;
        onSelectRef.current?.(null, "");
      }
    };

    const moveDragItem = (cx: number, cy: number) => {
      if (!dragItem || !floorRayRef.current) return;
      setMouse(cx, cy); raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(floorRayRef.current);
      if (!hits.length) return;
      const { width: W, length: L } = dimsRef.current, mg = 0.4;
      const nx = Math.max(-W/2+mg, Math.min(W/2-mg, hits[0].point.x));
      const nz = Math.max(-L/2+mg, Math.min(L/2-mg, hits[0].point.z));
      if (!collides(dragItem, nx, nz, dragItem.group.rotation.y)) {
        dragItem.group.position.x = nx; dragItem.group.position.z = nz;
      }
    };

    const moveOpeningAlongWall = (cx: number, cy: number) => {
      if (!dragOpening) return;
      const planes = wallPlanesRef.current; if (!planes.length) return;
      setMouse(cx, cy); raycaster.setFromCamera(mouse, camera);
      const target = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(planes[dragOpening.wallIndex], target)) return;
      const { width: W, length: L, height: H } = dimsRef.current;
      if (dragOpening.wallIndex === 0) {
        const clamped = Math.max(-W/2+OPENING_MARGIN, Math.min(W/2-OPENING_MARGIN, target.x));
        dragOpening.t = (clamped + W/2) / W;
      } else {
        const clamped = Math.max(-L/2+OPENING_MARGIN, Math.min(L/2-OPENING_MARGIN, target.z));
        dragOpening.t = (clamped + L/2) / L;
      }
      positionOpening(dragOpening, W, L, H);
      wallDirtyRef.current.add(dragOpening.wallIndex);
    };

    const onDown = (e: MouseEvent) => {
      setMouse(e.clientX, e.clientY); raycaster.setFromCamera(mouse, camera);
      const hitO = hitOpening(), hit = hitFurniture();
      if (hitO && e.button === 0) {
        dragOpening = hitO; orbit.velTheta = orbit.velPhi = 0; mount.style.cursor = "grabbing";
      } else if (hitO && e.button === 2) {
        // no-op for right-click on opening
      } else if (hit && e.button === 2) {
        rotateItem = hit; rotateStartX = e.clientX; rotateStartRY = hit.group.rotation.y;
        mount.style.cursor = "ew-resize";
      } else if (hit && e.button === 0) {
        dragItem = hit; clickCandidate = hit; pointerDownX = e.clientX; pointerDownY = e.clientY;
        orbit.velTheta = orbit.velPhi = 0; mount.style.cursor = "grabbing";
      } else if (e.button === 0) {
        orbitActive = true; prevX = e.clientX; prevY = e.clientY;
        orbit.velTheta = orbit.velPhi = 0; mount.style.cursor = "grabbing";
      }
    };

    const onMove = (e: MouseEvent) => {
      if (dragOpening) {
        moveOpeningAlongWall(e.clientX, e.clientY);
      } else if (rotateItem) {
        const newRY = rotateStartRY + (e.clientX - rotateStartX) * 0.01;
        if (!collides(rotateItem, rotateItem.group.position.x, rotateItem.group.position.z, newRY))
          rotateItem.group.rotation.y = newRY;
      } else if (dragItem) {
        if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) > 5) clickCandidate = null;
        moveDragItem(e.clientX, e.clientY);
      } else if (orbitActive) {
        orbit.velTheta = -(e.clientX - prevX) * 0.007;
        orbit.velPhi   = -(e.clientY - prevY) * 0.007;
        orbit.theta += orbit.velTheta;
        orbit.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, orbit.phi + orbit.velPhi));
        prevX = e.clientX; prevY = e.clientY;
      } else {
        setMouse(e.clientX, e.clientY); raycaster.setFromCamera(mouse, camera);
        mount.style.cursor = (hitOpening() || hitFurniture()) ? "move" : "grab";
      }
    };

    const onUp = (e: MouseEvent) => {
      if (clickCandidate && e.button === 0) selectItem(clickCandidate);
      dragOpening = null; clickCandidate = rotateItem = dragItem = null;
      orbitActive = false; mount.style.cursor = "grab";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.radius = Math.max(MIN_R, Math.min(MAX_R, orbit.radius + e.deltaY * 0.03));
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onDblClick = (e: MouseEvent) => {
      setMouse(e.clientX, e.clientY); raycaster.setFromCamera(mouse, camera);
      const hitO = hitOpening();
      if (hitO) {
        scene.remove(hitO.group); disposeGroup(hitO.group);
        hitO.group.traverse(o => meshToOpeningRef.current.delete(o));
        openingsRef.current = openingsRef.current.filter(i => i.id !== hitO.id);
        const { width: W, length: L, height: H } = dimsRef.current;
        replaceWallMesh(hitO.wallIndex, scene, wallMeshesRef.current, W, L, H, wallColorRef.current, openingsRef.current);
        return;
      }
      const hit = hitFurniture(); if (!hit) return;
      if (hit.id === selectedRef.current) { selectedRef.current = null; onSelectRef.current?.(null, ""); }
      scene.remove(hit.group); disposeGroup(hit.group);
      hit.group.traverse(o => meshToItemRef.current.delete(o));
      furnitureRef.current = furnitureRef.current.filter(i => i.id !== hit.id);
    };

    const onTStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        setMouse(e.touches[0].clientX, e.touches[0].clientY); raycaster.setFromCamera(mouse, camera);
        const hitO = hitOpening(), hit = hitFurniture();
        if (hitO) { dragOpening = hitO; orbit.velTheta = orbit.velPhi = 0; }
        else if (hit) { dragItem = hit; clickCandidate = hit; pointerDownX = e.touches[0].clientX; pointerDownY = e.touches[0].clientY; orbit.velTheta = orbit.velPhi = 0; }
        else { orbitActive = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; orbit.velTheta = orbit.velPhi = 0; }
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    };
    const onTMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (dragOpening) { moveOpeningAlongWall(e.touches[0].clientX, e.touches[0].clientY); }
        else if (dragItem) {
          if (Math.hypot(e.touches[0].clientX - pointerDownX, e.touches[0].clientY - pointerDownY) > 5) clickCandidate = null;
          moveDragItem(e.touches[0].clientX, e.touches[0].clientY);
        } else if (orbitActive) {
          orbit.velTheta = -(e.touches[0].clientX - prevX) * 0.007;
          orbit.velPhi   = -(e.touches[0].clientY - prevY) * 0.007;
          orbit.theta += orbit.velTheta;
          orbit.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, orbit.phi + orbit.velPhi));
          prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
        }
      } else if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        orbit.radius = Math.max(MIN_R, Math.min(MAX_R, orbit.radius - (d - touchDist) * 0.05));
        touchDist = d;
      }
    };
    const onTEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1 && clickCandidate) selectItem(clickCandidate);
      dragOpening = null; rotateItem = dragItem = clickCandidate = null; orbitActive = false;
    };

    mount.style.cursor = "grab";
    mount.addEventListener("mousedown",   onDown);
    mount.addEventListener("dblclick",    onDblClick);
    mount.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseup",    onUp);
    mount.addEventListener("wheel",       onWheel, { passive: false });
    mount.addEventListener("touchstart",  onTStart, { passive: true });
    window.addEventListener("touchmove",  onTMove,  { passive: true });
    window.addEventListener("touchend",   onTEnd);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!orbitActive && !dragItem && !rotateItem && !dragOpening) {
        orbit.velTheta *= 0.88; orbit.velPhi *= 0.88;
        orbit.theta += orbit.velTheta;
        orbit.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, orbit.phi + orbit.velPhi));
      }
      // Flush dirty wall meshes (caused by opening drag)
      if (wallDirtyRef.current.size > 0) {
        const { width: W, length: L, height: H } = dimsRef.current;
        for (const idx of Array.from(wallDirtyRef.current) as (0|1|2)[]) {
          replaceWallMesh(idx, scene, wallMeshesRef.current, W, L, H, wallColorRef.current, openingsRef.current);
        }
        wallDirtyRef.current.clear();
      }
      const { theta, phi, radius } = orbit;
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(lookAtRef.current);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      mount.removeEventListener("mousedown",   onDown);
      mount.removeEventListener("dblclick",    onDblClick);
      mount.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseup",    onUp);
      mount.removeEventListener("wheel",       onWheel);
      mount.removeEventListener("touchstart",  onTStart);
      window.removeEventListener("touchmove",  onTMove);
      window.removeEventListener("touchend",   onTEnd);
      window.removeEventListener("resize",     onResize);
      furnitureRef.current.forEach(it => { scene.remove(it.group); disposeGroup(it.group); });
      furnitureRef.current = []; meshToItemRef.current.clear();
      openingsRef.current.forEach(it => { scene.remove(it.group); disposeGroup(it.group); });
      openingsRef.current = []; meshToOpeningRef.current.clear();
      wallMeshesRef.current.forEach((m, i) => {
        if (m) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
        wallMeshesRef.current[i] = null;
      });
      if (roomGroupRef.current) { scene.remove(roomGroupRef.current); disposeGroup(roomGroupRef.current); }
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // ── rebuild room when dims/colors change ──────────────────────────
  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return;
    if (roomGroupRef.current) { scene.remove(roomGroupRef.current); disposeGroup(roomGroupRef.current); }
    roomGroupRef.current = buildRoomBase(width, length, height, ceilingColor, floorColor);
    scene.add(roomGroupRef.current);
    if (ceilLightRef.current) ceilLightRef.current.position.set(0, height/2 - 0.3, -length/4);
    lookAtRef.current.set(0, 0, -length / 6);
    if (floorRayRef.current) floorRayRef.current.position.y = -height / 2;
    furnitureRef.current.forEach(it => { it.group.position.y = -height / 2; });

    wallPlanesRef.current = [
      new THREE.Plane(new THREE.Vector3(0, 0, 1), length / 2),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), width / 2),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), width / 2),
    ];
    openingsRef.current.forEach(it => positionOpening(it, width, length, height));
    ([0, 1, 2] as (0|1|2)[]).forEach(i =>
      replaceWallMesh(i, scene, wallMeshesRef.current, width, length, height, wallColor, openingsRef.current)
    );
  }, [width, length, height, wallColor, ceilingColor, floorColor]);

  return <div ref={mountRef} className="w-full h-full" />;
});

Room.displayName = "Room";
export default Room;

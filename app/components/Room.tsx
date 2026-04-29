"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

export type FurnitureType = "sofa" | "table" | "bed" | "wardrobe";

export interface RoomHandle {
  addFurniture(type: FurnitureType): void;
  setFurnitureColor(id: string, hex: string): void;
}

interface RoomProps {
  width: number;
  length: number;
  height: number;
  wallColor: string;
  ceilingColor: string;
  floorColor: string;
  onFurnitureSelect?: (id: string | null, color: string) => void;
}

interface FurnitureItem {
  id: string;
  type: FurnitureType;
  group: THREE.Group;
  color: string;
}

// ── palette ───────────────────────────────────────────────────────────
const C = { bg: 0xf4efe7, base: 0xe2dbd1, lamp: 0xfaf6f0 };

const DEFAULT_COLORS: Record<FurnitureType, string> = {
  sofa:     "#d0c5b8",
  table:    "#cdb99a",
  bed:      "#d0c8bc",
  wardrobe: "#d5cfc8",
};

// ── geometry helper ─────────────��─────────────────────────────────────
// colorable=true → mesh gets userData.colorable so color-picker can tint it
function bx(
  g: THREE.Group,
  w: number, h: number, d: number,
  color: number,
  x: number, y: number, z: number,
  rough = 0.85,
  colorable = false
) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough })
  );
  m.position.set(x, y, z);
  if (colorable) m.userData.colorable = true;
  g.add(m);
}

// ── furniture builders (y = 0 is floor level) ─────────────────────────
function makeSofa(): THREE.Group {
  const g = new THREE.Group();
  const legH = 0.09, seatH = 0.27, seatW = 2.0, seatD = 0.9;
  const backH = 0.55, backT = 0.14;
  const armW = 0.18, armH = 0.50;
  const seatY   = legH + seatH / 2;
  const seatTop = legH + seatH;

  bx(g, seatW, seatH, seatD, 0xd0c5b8, 0, seatY, 0, 0.85, true);
  bx(g, seatW, backH, backT, 0xbdb2a6, 0, seatTop + backH / 2, -(seatD / 2 - backT / 2), 0.85, true);
  bx(g, armW, armH, seatD + backT, 0xbdb2a6, -(seatW / 2 + armW / 2), legH + armH / 2, -backT / 2, 0.85, true);
  bx(g, armW, armH, seatD + backT, 0xbdb2a6,  (seatW / 2 + armW / 2), legH + armH / 2, -backT / 2, 0.85, true);

  const lx = seatW / 2 - 0.15, lz = seatD / 2 - 0.12;
  [[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]].forEach(([x, z]) =>
    bx(g, 0.07, legH, 0.07, 0xcfc8be, x, legH / 2, z, 0.7)
  );
  return g;
}

function makeTable(): THREE.Group {
  const g = new THREE.Group();
  const tw = 1.6, th = 0.06, td = 0.9, legH = 0.72;
  bx(g, tw, th, td, 0xcdb99a, 0, legH + th / 2, 0, 0.85, true);
  const lx = tw / 2 - 0.1, lz = td / 2 - 0.08;
  [[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]].forEach(([x, z]) =>
    bx(g, 0.06, legH, 0.06, 0xcdb99a, x, legH / 2, z, 0.85, true)
  );
  return g;
}

function makeBed(): THREE.Group {
  const g = new THREE.Group();
  const fw = 1.8, fh = 0.22, fd = 2.2, legH = 0.15;
  const mh = 0.22, md = 2.0;
  const hbH = 0.72, hbT = 0.1;

  bx(g, fw, fh, fd, 0xd0c8bc, 0, legH + fh / 2, 0, 0.85, true);
  bx(g, fw - 0.1, mh, md, 0xe8e0d5, 0, legH + fh + mh / 2, 0, 0.85, true);
  bx(g, fw, hbH, hbT, 0xd0c8bc, 0, legH + hbH / 2, -(fd / 2 - hbT / 2), 0.85, true);

  const lx = fw / 2 - 0.1, lz = fd / 2 - 0.1;
  [[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]].forEach(([x, z]) =>
    bx(g, 0.07, legH, 0.07, 0xcfc8be, x, legH / 2, z, 0.7)
  );
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

// ── footprints & OBB collision ────────────────────────────────────────
const FOOTPRINTS: Record<FurnitureType, [number, number]> = {
  sofa:     [1.22, 0.55],
  table:    [0.84, 0.50],
  bed:      [0.96, 1.15],
  wardrobe: [0.93, 0.32],
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
  const ca = corners(ax, az, ahw, ahd, arY);
  const cb = corners(bx, bz, bhw, bhd, brY);
  const axes: [number,number][] = [
    [ Math.cos(arY), Math.sin(arY)], [-Math.sin(arY), Math.cos(arY)],
    [ Math.cos(brY), Math.sin(brY)], [-Math.sin(brY), Math.cos(brY)],
  ];
  for (const [nx, nz] of axes) {
    const pa = ca.map(([x, z]) => x*nx + z*nz);
    const pb = cb.map(([x, z]) => x*nx + z*nz);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

// ── room geometry ────────────────────────────────���────────────────────
function buildRoomGroup(
  W: number, L: number, H: number,
  wallColor: string, ceilingColor: string, floorColor: string
): THREE.Group {
  const group = new THREE.Group();

  const makeMat = (hex: string) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.9, side: THREE.DoubleSide });

  const addPlane = (w: number, h: number, mat: THREE.Material, role: string) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.userData.role = role;
    return m;
  };

  const floorM   = addPlane(W, L, makeMat(floorColor),   "floor");
  floorM.rotation.x = -Math.PI / 2; floorM.position.y = -H / 2; group.add(floorM);

  const ceilM    = addPlane(W, L, makeMat(ceilingColor), "ceiling");
  ceilM.rotation.x  =  Math.PI / 2; ceilM.position.y  =  H / 2; group.add(ceilM);

  const backM    = addPlane(W, H, makeMat(wallColor),    "wall");
  backM.position.z = -L / 2; group.add(backM);

  const leftM    = addPlane(L, H, makeMat(wallColor),    "wall");
  leftM.rotation.y =  Math.PI / 2; leftM.position.x = -W / 2; group.add(leftM);

  const rightM   = addPlane(L, H, makeMat(wallColor),    "wall");
  rightM.rotation.y = -Math.PI / 2; rightM.position.x =  W / 2; group.add(rightM);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.1, 0.05),
    new THREE.MeshStandardMaterial({ color: C.base })
  );
  base.position.set(0, -H / 2 + 0.05, -L / 2 + 0.025);
  group.add(base);

  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.22, 0.08, 20),
    new THREE.MeshStandardMaterial({ color: C.lamp, emissive: 0xfff5e0, emissiveIntensity: 0.4 })
  );
  lamp.position.set(0, H / 2 - 0.05, -L / 4);
  group.add(lamp);

  return group;
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
  { width, length, height, wallColor, ceilingColor, floorColor, onFurnitureSelect },
  ref
) => {
  const mountRef      = useRef<HTMLDivElement>(null);
  const sceneRef      = useRef<THREE.Scene | null>(null);
  const rendererRef   = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef     = useRef<THREE.PerspectiveCamera | null>(null);
  const roomGroupRef  = useRef<THREE.Group | null>(null);
  const ceilLightRef  = useRef<THREE.PointLight | null>(null);
  const lookAtRef     = useRef(new THREE.Vector3(0, 0, 0));
  const orbitRef      = useRef({ theta: 0.55, phi: 1.05, radius: 14, velTheta: 0, velPhi: 0 });
  const furnitureRef  = useRef<FurnitureItem[]>([]);
  const meshToItemRef = useRef(new Map<THREE.Object3D, FurnitureItem>());
  const floorRayRef   = useRef<THREE.Mesh | null>(null);
  const dimsRef       = useRef({ width, length, height });
  const idRef         = useRef(0);
  const selectedRef   = useRef<string | null>(null);
  const onSelectRef   = useRef(onFurnitureSelect);

  useEffect(() => { dimsRef.current = { width, length, height }; }, [width, length, height]);
  useEffect(() => { onSelectRef.current = onFurnitureSelect; }, [onFurnitureSelect]);

  useImperativeHandle(ref, () => ({
    addFurniture(type: FurnitureType) {
      const scene = sceneRef.current;
      if (!scene) return;
      const { width: W, length: L, height: H } = dimsRef.current;
      const group = BUILDERS[type]();
      const spread = Math.min(1.2, (Math.min(W, L) / 2) - 0.8);
      const ox = spread > 0 ? (Math.random() - 0.5) * spread * 2 : 0;
      const oz = spread > 0 ? (Math.random() - 0.5) * spread * 2 : 0;
      group.position.set(ox, -H / 2, oz);
      scene.add(group);
      const item: FurnitureItem = { id: `f${idRef.current++}`, type, group, color: DEFAULT_COLORS[type] };
      furnitureRef.current.push(item);
      group.traverse(o => { if (o instanceof THREE.Mesh) meshToItemRef.current.set(o, item); });
    },
    setFurnitureColor(id: string, hex: string) {
      const item = furnitureRef.current.find(i => i.id === id);
      if (item) applyFurnitureColor(item, hex);
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
    fill.position.set(6, 4, 6);
    scene.add(fill);

    const ceilLight = new THREE.PointLight(0xfffaf0, 1.8, 18);
    scene.add(ceilLight);
    ceilLightRef.current = ceilLight;

    const floorRay = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    floorRay.rotation.x = -Math.PI / 2;
    scene.add(floorRay);
    floorRayRef.current = floorRay;

    // ── controls ───────────────��─────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    const setMouse = (cx: number, cy: number) => {
      const r = mount.getBoundingClientRect();
      mouse.x =  ((cx - r.left) / r.width)  * 2 - 1;
      mouse.y = -((cy - r.top)  / r.height) * 2 + 1;
    };

    const hitFurniture = (): FurnitureItem | null => {
      const meshes: THREE.Mesh[] = [];
      furnitureRef.current.forEach(item =>
        item.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); })
      );
      if (!meshes.length) return null;
      const hits = raycaster.intersectObjects(meshes);
      return hits.length ? (meshToItemRef.current.get(hits[0].object) ?? null) : null;
    };

    const collides = (item: FurnitureItem, nx: number, nz: number, nrY: number) =>
      furnitureRef.current.some(other => {
        if (other.id === item.id) return false;
        const [hw, hd] = FOOTPRINTS[item.type];
        const [ohw, ohd] = FOOTPRINTS[other.type];
        return obbOverlap(nx, nz, hw, hd, nrY, other.group.position.x, other.group.position.z, ohw, ohd, other.group.rotation.y);
      });

    const orbit = orbitRef.current;
    const MIN_R = 2, MAX_R = 24, MIN_PHI = 0.12, MAX_PHI = Math.PI / 2 + 0.1;

    let orbitActive = false;
    let dragItem:   FurnitureItem | null = null;
    let rotateItem: FurnitureItem | null = null;
    let rotateStartX = 0, rotateStartRY = 0;
    let prevX = 0, prevY = 0;
    let touchDist = 0;
    // click detection
    let clickCandidate: FurnitureItem | null = null;
    let pointerDownX = 0, pointerDownY = 0;

    const selectItem = (item: FurnitureItem | null) => {
      const old = furnitureRef.current.find(i => i.id === selectedRef.current);
      setHighlight(old, false);
      if (item && item.id !== selectedRef.current) {
        setHighlight(item, true);
        selectedRef.current = item.id;
        onSelectRef.current?.(item.id, item.color);
      } else {
        selectedRef.current = null;
        onSelectRef.current?.(null, "");
      }
    };

    const moveDragItem = (cx: number, cy: number) => {
      if (!dragItem || !floorRayRef.current) return;
      setMouse(cx, cy);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(floorRayRef.current);
      if (!hits.length) return;
      const { width: W, length: L } = dimsRef.current;
      const mg = 0.4;
      const nx = Math.max(-W / 2 + mg, Math.min(W / 2 - mg, hits[0].point.x));
      const nz = Math.max(-L / 2 + mg, Math.min(L / 2 - mg, hits[0].point.z));
      if (!collides(dragItem, nx, nz, dragItem.group.rotation.y)) {
        dragItem.group.position.x = nx;
        dragItem.group.position.z = nz;
      }
    };

    const onDown = (e: MouseEvent) => {
      setMouse(e.clientX, e.clientY);
      raycaster.setFromCamera(mouse, camera);
      const hit = hitFurniture();
      if (hit && e.button === 2) {
        rotateItem   = hit;
        rotateStartX = e.clientX;
        rotateStartRY = hit.group.rotation.y;
        mount.style.cursor = "ew-resize";
      } else if (hit && e.button === 0) {
        dragItem       = hit;
        clickCandidate = hit;
        pointerDownX   = e.clientX;
        pointerDownY   = e.clientY;
        orbit.velTheta = orbit.velPhi = 0;
        mount.style.cursor = "grabbing";
      } else if (e.button === 0) {
        orbitActive    = true;
        prevX = e.clientX; prevY = e.clientY;
        orbit.velTheta = orbit.velPhi = 0;
        mount.style.cursor = "grabbing";
      }
    };

    const onMove = (e: MouseEvent) => {
      if (rotateItem) {
        const newRY = rotateStartRY + (e.clientX - rotateStartX) * 0.01;
        if (!collides(rotateItem, rotateItem.group.position.x, rotateItem.group.position.z, newRY))
          rotateItem.group.rotation.y = newRY;
      } else if (dragItem) {
        if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) > 5)
          clickCandidate = null;
        moveDragItem(e.clientX, e.clientY);
      } else if (orbitActive) {
        orbit.velTheta = -(e.clientX - prevX) * 0.007;
        orbit.velPhi   = -(e.clientY - prevY) * 0.007;
        orbit.theta += orbit.velTheta;
        orbit.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, orbit.phi + orbit.velPhi));
        prevX = e.clientX; prevY = e.clientY;
      } else {
        setMouse(e.clientX, e.clientY);
        raycaster.setFromCamera(mouse, camera);
        mount.style.cursor = hitFurniture() ? "move" : "grab";
      }
    };

    const onUp = (e: MouseEvent) => {
      if (clickCandidate && e.button === 0) selectItem(clickCandidate);
      clickCandidate = rotateItem = dragItem = null;
      orbitActive = false;
      mount.style.cursor = "grab";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.radius = Math.max(MIN_R, Math.min(MAX_R, orbit.radius + e.deltaY * 0.03));
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onDblClick = (e: MouseEvent) => {
      setMouse(e.clientX, e.clientY);
      raycaster.setFromCamera(mouse, camera);
      const hit = hitFurniture();
      if (!hit) return;
      if (hit.id === selectedRef.current) {
        selectedRef.current = null;
        onSelectRef.current?.(null, "");
      }
      scene.remove(hit.group);
      disposeGroup(hit.group);
      hit.group.traverse(o => meshToItemRef.current.delete(o));
      furnitureRef.current = furnitureRef.current.filter(i => i.id !== hit.id);
    };

    // touch
    const onTStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        setMouse(e.touches[0].clientX, e.touches[0].clientY);
        raycaster.setFromCamera(mouse, camera);
        const hit = hitFurniture();
        if (hit) { dragItem = hit; clickCandidate = hit; pointerDownX = e.touches[0].clientX; pointerDownY = e.touches[0].clientY; orbit.velTheta = orbit.velPhi = 0; }
        else { orbitActive = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; orbit.velTheta = orbit.velPhi = 0; }
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    };
    const onTMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (dragItem) {
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
      rotateItem = dragItem = clickCandidate = null; orbitActive = false;
    };

    mount.style.cursor = "grab";
    mount.addEventListener("mousedown",    onDown);
    mount.addEventListener("dblclick",     onDblClick);
    mount.addEventListener("contextmenu",  onContextMenu);
    window.addEventListener("mousemove",   onMove);
    window.addEventListener("mouseup",     onUp);
    mount.addEventListener("wheel",        onWheel,  { passive: false });
    mount.addEventListener("touchstart",   onTStart, { passive: true });
    window.addEventListener("touchmove",   onTMove,  { passive: true });
    window.addEventListener("touchend",    onTEnd);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!orbitActive && !dragItem && !rotateItem) {
        orbit.velTheta *= 0.88; orbit.velPhi *= 0.88;
        orbit.theta += orbit.velTheta;
        orbit.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, orbit.phi + orbit.velPhi));
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
      furnitureRef.current.forEach(item => { scene.remove(item.group); disposeGroup(item.group); });
      furnitureRef.current = []; meshToItemRef.current.clear();
      if (roomGroupRef.current) { scene.remove(roomGroupRef.current); disposeGroup(roomGroupRef.current); }
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // ── rebuild room geometry when dims change ────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (roomGroupRef.current) { scene.remove(roomGroupRef.current); disposeGroup(roomGroupRef.current); }
    roomGroupRef.current = buildRoomGroup(width, length, height, wallColor, ceilingColor, floorColor);
    scene.add(roomGroupRef.current);
    if (ceilLightRef.current) ceilLightRef.current.position.set(0, height / 2 - 0.3, -length / 4);
    lookAtRef.current.set(0, 0, -length / 6);
    if (floorRayRef.current) floorRayRef.current.position.y = -height / 2;
    furnitureRef.current.forEach(item => { item.group.position.y = -height / 2; });
  }, [width, length, height, wallColor, ceilingColor, floorColor]);

  return <div ref={mountRef} className="w-full h-full" />;
});

Room.displayName = "Room";
export default Room;

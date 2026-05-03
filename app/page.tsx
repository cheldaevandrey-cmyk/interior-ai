"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { RoomHandle, FurnitureType, OpeningType, FurnitureMeta } from "./components/Room";
import HoffCatalog from "./components/HoffCatalog";

const Room = dynamic(() => import("./components/Room"), { ssr: false });

type Unit   = "m" | "cm";
type DimKey = "width" | "length" | "height";

const DIMS: { key: DimKey; label: string; minM: number; maxM: number; stepM: number }[] = [
  { key: "width",  label: "Ширина",  minM: 3,  maxM: 20, stepM: 0.5  },
  { key: "length", label: "Длина",   minM: 3,  maxM: 20, stepM: 0.5  },
  { key: "height", label: "Высота",  minM: 2,  maxM: 6,  stepM: 0.25 },
];

const OPENINGS: { type: OpeningType; label: string }[] = [
  { type: "window", label: "Окно"  },
  { type: "door",   label: "Дверь" },
];

const FURNITURE: { type: FurnitureType; label: string }[] = [
  { type: "sofa",     label: "Диван"   },
  { type: "table",    label: "Стол"    },
  { type: "bed",      label: "Кровать" },
  { type: "wardrobe", label: "Шкаф"   },
];

const SURFACES = [
  { key: "wall",    label: "Стены"   },
  { key: "ceiling", label: "Потолок" },
  { key: "floor",   label: "Пол"     },
] as const;
type SurfaceKey = "wall" | "ceiling" | "floor";

// ── Color swatch that opens native color picker ───────────────────────
function ColorSwatch({ value, onChange }: { value: string; onChange(v: string): void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <label
      className="relative flex-shrink-0 w-7 h-7 rounded cursor-pointer overflow-hidden"
      style={{ border: "1px solid #c0b9b1", display: "block" }}
      title={value}
    >
      <div className="absolute inset-0" style={{ background: value }} />
      <input
        ref={inputRef} type="color" value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
      />
    </label>
  );
}

// ── Number input (commits on blur / Enter) ────────────────────────────
function DimInput({ valueM, unit, minM, maxM, stepM, onCommit }: {
  valueM: number; unit: Unit; minM: number; maxM: number; stepM: number;
  onCommit(meters: number): void;
}) {
  const toDisp  = (m: number) => unit === "cm" ? +(m * 100).toFixed(0) : +m.toFixed(2);
  const toMeter = (v: number) => unit === "cm" ? v / 100 : v;
  const dispMin  = toDisp(minM), dispMax = toDisp(maxM);
  const dispStep = unit === "cm" ? stepM * 100 : stepM;
  const [local, setLocal] = useState(String(toDisp(valueM)));

  useEffect(() => {
    const parsed = parseFloat(local);
    if (isNaN(parsed) || Math.abs(toMeter(parsed) - valueM) > 0.001)
      setLocal(String(toDisp(valueM)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueM, unit]);

  const commit = () => {
    const n = parseFloat(local);
    if (!isNaN(n)) { const c = Math.max(dispMin, Math.min(dispMax, n)); setLocal(String(c)); onCommit(toMeter(c)); }
    else setLocal(String(toDisp(valueM)));
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number" value={local} min={dispMin} max={dispMax} step={dispStep}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } }}
        className="flex-1 min-w-0 rounded px-2 py-1 text-xs text-right outline-none"
        style={{ background: "#e5dfd8", border: "1px solid #cec8bf", color: "#4e4840" }}
      />
      <span className="text-[11px] shrink-0 w-5" style={{ color: "#9e968c" }}>
        {unit === "m" ? "м" : "см"}
      </span>
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pt-4 pb-2 text-[10px] font-semibold tracking-[0.18em] uppercase"
       style={{ color: "#a09288", borderTop: "1px solid #d5cec5" }}>
      {children}
    </p>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function Home() {
  const [dims, setDims] = useState<Record<DimKey, number>>({ width: 9, length: 9, height: 4 });
  const [unit, setUnit] = useState<Unit>("m");
  const [surfaces, setSurfaces] = useState<Record<SurfaceKey, string>>({
    wall:    "#ece6dd",
    ceiling: "#f0ebe3",
    floor:   "#e5ddd2",
  });
  const [selected, setSelected]       = useState<{ id: string; color: string; meta?: FurnitureMeta } | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [glbLoadedIds, setGlbLoadedIds] = useState<Set<string>>(new Set());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomRef = useRef<RoomHandle>(null as any);

  const setDim = (key: DimKey, m: number) => {
    const { minM, maxM } = DIMS.find(d => d.key === key)!;
    setDims(p => ({ ...p, [key]: Math.max(minM, Math.min(maxM, +m.toFixed(4))) }));
  };

  const handleSelect = (id: string | null, color: string, meta?: FurnitureMeta) =>
    setSelected(id ? { id, color, meta } : null);

  const handleFurnitureColor = (hex: string) => {
    if (!selected) return;
    setSelected(s => s ? { ...s, color: hex } : null);
    roomRef.current?.setFurnitureColor(selected.id, hex);
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden" style={{ background: "#f4efe7" }}>

      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 h-full flex flex-col" style={{ background: "#ede7de", borderRight: "1px solid #d5cec5" }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between shrink-0"
             style={{ borderBottom: "1px solid #d5cec5" }}>
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: "#a09288" }}>
            Комната
          </p>
          <div className="flex rounded overflow-hidden text-[11px]" style={{ border: "1px solid #c8c0b8" }}>
            {(["m", "cm"] as Unit[]).map(u => (
              <button key={u} onClick={() => setUnit(u)}
                className="px-2.5 py-1 font-medium transition-colors"
                style={{ background: unit === u ? "#b8a99a" : "transparent", color: unit === u ? "#fff" : "#8a8078" }}>
                {u === "m" ? "м" : "см"}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Dimensions */}
          <div className="flex flex-col gap-5 px-5 pt-5 pb-5">
            {DIMS.map(({ key, label, minM, maxM, stepM }) => (
              <div key={key} className="flex flex-col gap-2">
                <span className="text-xs" style={{ color: "#7a7069" }}>{label}</span>
                <DimInput valueM={dims[key]} unit={unit} minM={minM} maxM={maxM} stepM={stepM}
                  onCommit={v => setDim(key, v)} />
                <input type="range" min={minM} max={maxM} step={stepM} value={dims[key]}
                  onChange={e => setDim(key, Number(e.target.value))}
                  className="w-full h-[3px] rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "#b8a99a" }} />
                <div className="flex justify-between text-[10px]" style={{ color: "#b0a89f" }}>
                  {unit === "m"
                    ? <><span>{minM} м</span><span>{maxM} м</span></>
                    : <><span>{minM * 100} см</span><span>{maxM * 100} см</span></>}
                </div>
              </div>
            ))}
          </div>

          {/* Surface colors */}
          <SectionTitle>Цвета поверхностей</SectionTitle>
          <div className="flex flex-col gap-3 px-5 pb-5">
            {SURFACES.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "#7a7069" }}>{label}</span>
                <ColorSwatch value={surfaces[key]} onChange={v => setSurfaces(p => ({ ...p, [key]: v }))} />
              </div>
            ))}
          </div>

          {/* Furniture */}
          <SectionTitle>Мебель</SectionTitle>
          <div className="flex flex-col gap-1.5 px-5 pb-2">
            {FURNITURE.map(({ type, label }) => (
              <button key={type}
                onClick={() => type === "sofa" ? setShowCatalog(true) : roomRef.current?.addFurniture(type)}
                className="w-full text-left text-xs px-3 py-2 rounded transition-all"
                style={{ background: "#e5dfd8", color: "#5c544d", border: "1px solid #cec8bf" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#ddd7cf"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#e5dfd8"; }}
              >
                + {label}
              </button>
            ))}
          </div>

          {/* Openings */}
          <SectionTitle>Проёмы</SectionTitle>
          <div className="flex flex-col gap-1.5 px-5 pb-2">
            {OPENINGS.map(({ type, label }) => (
              <button key={type}
                onClick={() => roomRef.current?.addOpening(type)}
                className="w-full text-left text-xs px-3 py-2 rounded transition-all"
                style={{ background: "#e5dfd8", color: "#5c544d", border: "1px solid #cec8bf" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#ddd7cf"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#e5dfd8"; }}
              >
                + {label}
              </button>
            ))}
          </div>

          {/* Selected furniture info */}
          {selected && (
            <div style={{ borderTop: "1px solid #d5cec5" }}>

              {/* Hoff product card */}
              {selected.meta?.name && (
                <div className="px-5 pt-4 pb-3 flex flex-col gap-2">
                  {selected.meta.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.meta.photo}
                      alt={selected.meta.name}
                      className="w-full rounded"
                      style={{ height: 110, objectFit: "cover", background: "#e8e2d9" }}
                    />
                  )}
                  <p className="text-[12px] font-medium leading-snug" style={{ color: "#4e4840" }}>
                    {selected.meta.name}
                  </p>
                  {selected.meta.price && (
                    <p className="text-[13px] font-semibold" style={{ color: "#4e4840" }}>
                      {selected.meta.price.toLocaleString("ru-RU")} ₽
                    </p>
                  )}
                  {selected.meta.glbUrl && !glbLoadedIds.has(selected.id) && (
                    <p className="text-[10px] px-2 py-1 rounded flex items-center gap-1.5" style={{ background: "#e8e2d9", color: "#7a7069" }}>
                      <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "#b8a99a" }} />
                      Загружается 3D-модель…
                    </p>
                  )}
                  {selected.meta.glbUrl && glbLoadedIds.has(selected.id) && (
                    <p className="text-[10px] px-2 py-1 rounded" style={{ background: "#e5f0e8", color: "#5a7a5d" }}>
                      3D-модель загружена
                    </p>
                  )}
                  {selected.meta.url && (
                    <a
                      href={selected.meta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] py-1.5 px-3 rounded text-center transition-colors"
                      style={{ background: "#b8a99a", color: "#fff", display: "block" }}
                    >
                      Смотреть на Hoff →
                    </a>
                  )}
                </div>
              )}

              {/* Color picker */}
              <div className="px-5 pt-3 pb-4" style={{ borderTop: selected.meta?.name ? "1px solid #e0d9d0" : "none" }}>
                <p className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-3"
                   style={{ color: "#a09288" }}>
                  Цвет мебели
                </p>
                <div className="flex items-center gap-3">
                  <ColorSwatch value={selected.color} onChange={handleFurnitureColor} />
                  <span className="text-xs font-mono" style={{ color: "#7a7069" }}>
                    {selected.color.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Hint */}
          <div className="px-5 pt-2 pb-5">
            <p className="text-[10px] leading-[1.7]" style={{ color: "#b0a89f" }}>
              ЛКМ — выбрать / перетащить.<br />
              ПКМ — повернуть мебель.<br />
              2×ЛКМ — удалить.<br />
              Окна и двери — тяните вдоль стены.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid #d5cec5" }}>
          <p className="text-[10px] leading-[1.6]" style={{ color: "#b0a89f" }}>
            Тяните фон — вращение.<br />
            Скролл — приближение.
          </p>
        </div>
      </aside>

      {/* ── 3-D canvas ── */}
      <div className="flex-1 h-full">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Room
          ref={roomRef as any}
          width={dims.width} length={dims.length} height={dims.height}
          wallColor={surfaces.wall} ceilingColor={surfaces.ceiling} floorColor={surfaces.floor}
          onFurnitureSelect={handleSelect}
          onGlbLoaded={id => setGlbLoadedIds(prev => new Set([...prev, id]))}
        />
      </div>

      {/* ── Hoff catalog modal ── */}
      {showCatalog && (
        <HoffCatalog
          onClose={() => setShowCatalog(false)}
          onSelect={async sofa => {
            setShowCatalog(false);

            // Extract articul from product URL query param
            const articul = sofa.url
              ? new URL(sofa.url).searchParams.get("articul")
              : null;

            // Check if a GLB model exists for this product
            let glbUrl: string | undefined;
            if (articul) {
              const candidate = `https://ar.elarbis.com/hoff/assets/${articul}/${articul}_e0v0_fordroid.glb`;
              try {
                const res = await fetch(candidate, { method: "HEAD" });
                if (res.ok) glbUrl = candidate;
              } catch {
                // no model — fall through
              }
            }

            roomRef.current?.addFurniture("sofa", {
              name: sofa.name ?? undefined,
              price: sofa.price ?? undefined,
              photo: sofa.photo ?? undefined,
              url: sofa.url ?? undefined,
              glbUrl,
            });
          }}
        />
      )}
    </div>
  );
}

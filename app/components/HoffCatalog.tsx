"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Sofa {
  name: string | null;
  price: number | null;
  price_raw: string | null;
  old_price: number | null;
  old_price_raw: string | null;
  photo: string | null;
  url: string | null;
}

interface Props {
  onSelect: (sofa: Sofa) => void;
  onClose: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString("ru-RU") + " ₽";

export default function HoffCatalog({ onSelect, onClose }: Props) {
  const [query, setQuery]     = useState("");
  const [items, setItems]     = useState<Sofa[]>([]);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, page: String(p), limit: "20" });
      const res = await fetch(`/api/sofas?${params}`);
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load
  useEffect(() => {
    fetchPage("", 1);
    inputRef.current?.focus();
  }, [fetchPage]);

  const handleQuery = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPage(v, 1);
    }, 280);
  };

  const goPage = (p: number) => {
    setPage(p);
    fetchPage(query, p);
  };

  // close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(60,50,40,0.45)" }}
        onClick={onClose}
      />

      {/* panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col"
        style={{
          width: "min(680px, 100vw)",
          background: "#f4efe7",
          borderLeft: "1px solid #d5cec5",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.18)",
        }}
      >
        {/* header */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #d5cec5", background: "#ede7de" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#4e4840" }}>
              Каталог диванов Hoff
            </p>
            {!loading && (
              <p className="text-[11px] mt-0.5" style={{ color: "#a09288" }}>
                {total.toLocaleString("ru-RU")} товаров
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded text-xl"
            style={{ color: "#9e968c", background: "#e5dfd8" }}
          >
            ×
          </button>
        </div>

        {/* search */}
        <div className="shrink-0 px-4 py-3" style={{ borderBottom: "1px solid #e0d9d0" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleQuery(e.target.value)}
            placeholder="Поиск по названию…"
            className="w-full rounded px-3 py-2 text-sm outline-none"
            style={{
              background: "#ede7de",
              border: "1px solid #cec8bf",
              color: "#4e4840",
            }}
          />
        </div>

        {/* grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40" style={{ color: "#a09288" }}>
              Загрузка…
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-40" style={{ color: "#a09288" }}>
              Ничего не найдено
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {items.map((sofa, i) => (
                <SofaCard key={i} sofa={sofa} onSelect={() => onSelect(sofa)} />
              ))}
            </div>
          )}
        </div>

        {/* pagination */}
        {pages > 1 && (
          <div
            className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-3"
            style={{ borderTop: "1px solid #d5cec5", background: "#ede7de" }}
          >
            <PagBtn label="‹" disabled={page === 1} onClick={() => goPage(page - 1)} />
            {paginationRange(page, pages).map((p, i) =>
              p === "…" ? (
                <span key={i} className="px-1 text-xs" style={{ color: "#a09288" }}>…</span>
              ) : (
                <PagBtn key={i} label={String(p)} active={p === page} onClick={() => goPage(Number(p))} />
              )
            )}
            <PagBtn label="›" disabled={page === pages} onClick={() => goPage(page + 1)} />
          </div>
        )}
      </div>
    </>
  );
}

function SofaCard({ sofa, onSelect }: { sofa: Sofa; onSelect: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const discount = sofa.old_price && sofa.price
    ? Math.round((1 - sofa.price / sofa.old_price) * 100)
    : 0;

  return (
    <button
      onClick={onSelect}
      className="text-left rounded-lg overflow-hidden flex flex-col transition-all"
      style={{
        background: "#ede7de",
        border: "1px solid #d5cec5",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#b8a99a";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#d5cec5";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      {/* photo */}
      <div
        className="w-full relative overflow-hidden shrink-0"
        style={{ height: 140, background: "#e8e2d9" }}
      >
        {sofa.photo && !imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sofa.photo}
            alt={sofa.name ?? "Диван"}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">
            🛋
          </div>
        )}
        {discount > 0 && (
          <span
            className="absolute top-2 left-2 text-[11px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: "#e05c40", color: "#fff" }}
          >
            −{discount}%
          </span>
        )}
      </div>

      {/* info */}
      <div className="flex flex-col gap-1 p-2.5">
        <p
          className="text-[12px] leading-snug"
          style={{ color: "#4e4840", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {sofa.name ?? "Диван"}
        </p>

        <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
          {sofa.price && (
            <span className="text-[13px] font-semibold" style={{ color: "#4e4840" }}>
              {fmt(sofa.price)}
            </span>
          )}
          {sofa.old_price && sofa.old_price !== sofa.price && (
            <span className="text-[11px] line-through" style={{ color: "#a09288" }}>
              {fmt(sofa.old_price)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function PagBtn({ label, onClick, disabled, active }: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-w-[28px] h-7 px-1.5 text-xs rounded transition-colors"
      style={{
        background: active ? "#b8a99a" : "#e5dfd8",
        color: active ? "#fff" : disabled ? "#c0b9b1" : "#5c544d",
        border: "1px solid #cec8bf",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function paginationRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) add(p);
  if (current < total - 2) pages.push("…");
  add(total);
  return pages;
}

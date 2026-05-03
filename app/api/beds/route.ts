import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface Item {
  name: string | null;
  price: number | null;
  price_raw: string | null;
  old_price: number | null;
  old_price_raw: string | null;
  photo: string | null;
  url: string | null;
}

let itemCache: Item[] | null = null;
let arCache: Set<string> | null = null;

function loadItems(): Item[] {
  if (!itemCache) {
    const file = join(process.cwd(), "public", "hoff_beds.json");
    if (!existsSync(file)) return [];
    itemCache = JSON.parse(readFileSync(file, "utf-8")) as Item[];
  }
  return itemCache;
}

function loadArSet(): Set<string> {
  if (!arCache) {
    const file = join(process.cwd(), "public", "hoff_ar_articuls.json");
    if (!existsSync(file)) return new Set();
    arCache = new Set(JSON.parse(readFileSync(file, "utf-8")) as string[]);
  }
  return arCache;
}

function getArticul(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("articul");
  } catch {
    return null;
  }
}

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q     = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(40, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const arSet = loadArSet();
  const hasArFilter = arSet.size > 0;

  let items = loadItems();

  if (hasArFilter) {
    items = items.filter(b => {
      const a = getArticul(b.url);
      return a !== null && arSet.has(a);
    });
  }

  if (q) {
    items = items.filter(b => b.name?.toLowerCase().includes(q));
  }

  const total = items.length;
  const pages = Math.ceil(total / limit);
  const slice = items.slice((page - 1) * limit, page * limit);

  return NextResponse.json({ items: slice, total, pages, page });
}

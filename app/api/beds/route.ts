import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface Bed {
  name: string | null;
  price: number | null;
  price_raw: string | null;
  old_price: number | null;
  old_price_raw: string | null;
  photo: string | null;
  url: string | null;
}

let cache: Bed[] | null = null;

function load(): Bed[] {
  if (!cache) {
    const file = join(process.cwd(), "public", "hoff_beds.json");
    if (!existsSync(file)) return [];
    cache = JSON.parse(readFileSync(file, "utf-8")) as Bed[];
  }
  return cache;
}

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q     = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(40, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  let items = load();

  if (q) {
    items = items.filter(b => b.name?.toLowerCase().includes(q));
  }

  const total = items.length;
  const pages = Math.ceil(total / limit);
  const slice = items.slice((page - 1) * limit, page * limit);

  return NextResponse.json({ items: slice, total, pages, page });
}

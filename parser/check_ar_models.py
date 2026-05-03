#!/usr/bin/env python3
"""
Check which Hoff products have a GLB model on ar.elarbis.com.
Reads hoff_sofas.json + hoff_beds.json, fires HEAD requests in parallel,
writes public/hoff_ar_articuls.json — a set of articuls that have a model.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

import aiohttp

CONCURRENCY = 80
BASE_URL    = "https://ar.elarbis.com/hoff/assets/{a}/{a}_e0v0_fordroid.glb"
OUT_FILE    = Path(__file__).parent.parent / "public" / "hoff_ar_articuls.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def extract_articul(url: str | None) -> str | None:
    if not url:
        return None
    return parse_qs(urlparse(url).query).get("articul", [None])[0]


def load_articuls() -> list[str]:
    parser_dir = Path(__file__).parent
    articuls: list[str] = []
    for fname in ("hoff_sofas.json", "hoff_beds.json"):
        path = parser_dir / fname
        if not path.exists():
            log.warning("%s not found, skipping", fname)
            continue
        items = json.loads(path.read_text())
        before = len(articuls)
        for item in items:
            a = extract_articul(item.get("url"))
            if a:
                articuls.append(a)
        log.info("%s: %d articuls", fname, len(articuls) - before)
    # deduplicate preserving order
    seen: set[str] = set()
    unique = [a for a in articuls if not (a in seen or seen.add(a))]  # type: ignore[func-returns-value]
    return unique


async def check(session: aiohttp.ClientSession, sem: asyncio.Semaphore, articul: str) -> str | None:
    url = BASE_URL.format(a=articul)
    async with sem:
        try:
            async with session.head(url, allow_redirects=True, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                return articul if resp.status == 200 else None
        except Exception:
            return None


async def main() -> None:
    articuls = load_articuls()
    log.info("Checking %d unique articuls (concurrency=%d)…", len(articuls), CONCURRENCY)

    sem = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [check(session, sem, a) for a in articuls]
        results: list[str | None] = []
        done = 0
        for coro in asyncio.as_completed(tasks):
            result = await coro
            results.append(result)
            done += 1
            if done % 200 == 0 or done == len(tasks):
                found = sum(1 for r in results if r)
                log.info("  %d / %d checked — %d have GLB", done, len(tasks), found)

    valid = sorted(r for r in results if r)
    log.info("Done: %d / %d articuls have a GLB model", len(valid), len(articuls))

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(valid, ensure_ascii=False, indent=2))
    log.info("Saved → %s", OUT_FILE)


if __name__ == "__main__":
    asyncio.run(main())

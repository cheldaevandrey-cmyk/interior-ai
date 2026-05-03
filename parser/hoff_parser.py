#!/usr/bin/env python3
"""Parser for sofas catalog on hoff.ru (Playwright + stealth, bypasses QRATOR)"""

import json
import time
import logging
import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
from playwright_stealth import Stealth

CATALOG_URL = "https://hoff.ru/catalog/gostinaya/divany/"
OUTPUT_FILE = Path(__file__).parent / "hoff_sofas.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def parse_price(raw: str) -> int | None:
    digits = "".join(c for c in raw if c.isdigit())
    return int(digits) if digits else None


def extract_cards(page) -> list[dict]:
    return page.evaluate("""() => {
        const cards = document.querySelectorAll('.product-card');
        const results = [];
        for (const card of cards) {
            const nameEl = card.querySelector('a.product-name[itemprop="name"]');
            const name = nameEl ? nameEl.innerText.trim() : null;
            const href = nameEl ? nameEl.getAttribute('href') : null;
            const url = href
                ? (href.startsWith('http') ? href : 'https://hoff.ru' + href)
                : null;

            const priceEl = card.querySelector('.current-price');
            const priceRaw = priceEl ? priceEl.innerText.trim() : null;

            const oldPriceEl = card.querySelector('.old-price');
            const oldPriceRaw = oldPriceEl ? oldPriceEl.innerText.trim() : null;

            const imgEl = card.querySelector('img.preview-image[fetchpriority="high"], img.preview-image');
            const photo = imgEl ? imgEl.getAttribute('src') : null;

            if (name || url) {
                results.push({ name, price_raw: priceRaw, old_price_raw: oldPriceRaw, photo, url });
            }
        }
        return results;
    }""")


def page_url(page_num: int) -> str:
    if page_num == 1:
        return CATALOG_URL
    return f"{CATALOG_URL}page{page_num}/"


def scrape(max_pages: int = 100) -> list[dict]:
    products: list[dict] = []
    stealth = Stealth()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="ru-RU",
            viewport={"width": 1440, "height": 900},
        )
        page = ctx.new_page()
        stealth.apply_stealth_sync(page)

        for page_num in range(1, max_pages + 1):
            url = page_url(page_num)
            log.info("Loading page %d: %s", page_num, url)

            try:
                page.goto(url, wait_until="networkidle", timeout=45_000)
            except PWTimeout:
                log.warning("networkidle timeout on page %d, trying anyway", page_num)

            # Stop if no product cards found (page doesn't exist)
            try:
                page.wait_for_selector(".product-card", timeout=12_000)
            except PWTimeout:
                log.info("No products on page %d — catalog exhausted", page_num)
                break

            cards = extract_cards(page)
            if not cards:
                log.info("Empty page %d — stopping", page_num)
                break

            for c in cards:
                c["price"] = parse_price(c["price_raw"] or "")
                c["old_price"] = parse_price(c["old_price_raw"] or "")

            products.extend(cards)
            log.info("Page %d: %d products (total: %d)", page_num, len(cards), len(products))

            time.sleep(1.5)

        browser.close()

    return products


def main():
    parser = argparse.ArgumentParser(description="Parse sofas from hoff.ru")
    parser.add_argument("--max-pages", type=int, default=100)
    parser.add_argument("--output", type=str, default=str(OUTPUT_FILE))
    args = parser.parse_args()

    log.info("Starting hoff.ru sofa parser")
    products = scrape(max_pages=args.max_pages)

    output_path = Path(args.output)
    output_path.write_text(
        json.dumps(products, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log.info("Saved %d products to %s", len(products), output_path)


if __name__ == "__main__":
    main()

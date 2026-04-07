#!/usr/bin/env python3
"""Collect upcoming Toksovo events from official sources.

The script scans a small set of official pages, extracts dated event items,
filters them to a rolling six-month window, and writes a static JS payload
consumed by the homepage.
"""

from __future__ import annotations

import json
import re
import ssl
from datetime import date, datetime, timedelta
from html import unescape
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup


TODAY = date.today()
WINDOW_DAYS = 180
WINDOW_END = TODAY + timedelta(days=WINDOW_DAYS)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
)
SSL_CONTEXT = ssl._create_unverified_context()

MONTHS = {
    "января": 1,
    "февраля": 2,
    "марта": 3,
    "апреля": 4,
    "мая": 5,
    "июня": 6,
    "июля": 7,
    "августа": 8,
    "сентября": 9,
    "октября": 10,
    "ноября": 11,
    "декабря": 12,
}

MONTH_ABBR = {
    1: "янв",
    2: "фев",
    3: "мар",
    4: "апр",
    5: "май",
    6: "июн",
    7: "июл",
    8: "авг",
    9: "сен",
    10: "окт",
    11: "ноя",
    12: "дек",
}

EVENT_KEYWORDS = (
    "соревнован",
    "турнир",
    "кубок",
    "фестиваль",
    "праздник",
    "семинар",
    "встреча",
    "сбор",
    "открытие",
    "первенство",
    "чемпионат",
    "мероприят",
    "афиша",
)

SOURCES = [
    {
        "kind": "links",
        "url": "https://www.kavgolovo.center/news/",
        "label": "kavgolovo.center/news",
    },
    {
        "kind": "links",
        "url": "https://www.kavgolovo.center/sitemap.html",
        "label": "kavgolovo.center/sitemap",
    },
    {
        "kind": "schedule",
        "url": "https://www.kavgolovo.center/tournament/",
        "label": "kavgolovo.center/tournament",
    },
    {
        "kind": "article",
        "url": "https://old.toksovo-lo.ru/o-toksovo/novosti/plan-meropriyatij-na-iyul",
        "label": "toksovo-lo.ru/plan-meropriyatij",
    },
    {
        "kind": "article",
        "url": "https://www.kavgolovo.center/news/post-13811734.html",
        "label": "kavgolovo.center/news",
    },
    {
        "kind": "article",
        "url": "https://www.kavgolovo.center/news/post-13881924.html",
        "label": "kavgolovo.center/news",
    },
    {
        "kind": "article",
        "url": "https://www.kavgolovo.center/news/post-13890138.html",
        "label": "kavgolovo.center/news",
    },
]


def clean_text(value: str | None) -> str:
    value = unescape(value or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value.strip(" -–—|")


def fetch_html(url: str) -> tuple[str, str]:
    attempts = [url]
    if url.startswith("https://"):
        attempts.append(url.replace("https://", "http://", 1))
    last_error = None
    for candidate in attempts:
        try:
            request = Request(candidate, headers={"User-Agent": USER_AGENT})
            with urlopen(request, timeout=25, context=SSL_CONTEXT) as resp:
                html = resp.read().decode(resp.headers.get_content_charset() or "utf-8", errors="replace")
                return candidate, html
        except Exception as exc:  # pragma: no cover - best-effort network code
            last_error = exc
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def parse_node_date(day_a: int, month_num: int, year: int | None) -> date | None:
    years = [year] if year else [TODAY.year, TODAY.year + 1]
    for current_year in years:
        if current_year is None:
            continue
        try:
            candidate = date(current_year, month_num, day_a)
        except ValueError:
            continue
        if candidate < TODAY:
            continue
        if candidate > WINDOW_END:
            continue
        return candidate
    return None


def pick_year(raw_year: str | None) -> int | None:
    if not raw_year:
        return None
    raw_year = raw_year.strip()
    if len(raw_year) == 2:
        return 2000 + int(raw_year)
    return int(raw_year)


def infer_meta(url: str, text: str) -> str:
    host = urlparse(url).netloc.replace("www.", "")
    if "kavgolovo.center" in host or "Кавголово" in text:
        return "УТЦ Кавголово, Токсово"
    if "toksovo-lo.ru" in host:
        return "Токсово"
    return host


def summarize_event_title(body_text: str, fallback: str) -> str:
    body_text = clean_text(body_text)
    lowered = body_text.lower()
    if "пляжному волейболу" in lowered:
        if "среди мужчин и женщин" in lowered:
            return "Кубок Ленинградской области по пляжному волейболу среди мужчин и женщин"
        if "губернатора" in lowered:
            return "Кубок Губернатора Ленинградской области по пляжному волейболу"
    patterns = [
        r"(Кубок[^.!?\n]{12,120})",
        r"(Первенство[^.!?\n]{12,120})",
        r"(Чемпионат[^.!?\n]{12,120})",
        r"(Фестиваль[^.!?\n]{12,120})",
        r"(Турнир[^.!?\n]{12,120})",
        r"(Праздник[^.!?\n]{12,120})",
    ]
    for pattern in patterns:
        match = re.search(pattern, body_text, flags=re.IGNORECASE)
        if match:
            return clean_text(match.group(1))

    fallback = clean_text(fallback)
    if "—" in fallback:
        tail = clean_text(fallback.split("—")[-1])
        if len(tail) >= 10:
            return tail

    fallback = re.sub(r"^(?:\d{1,2}(?:\s*[-–—и,]\s*\d{1,2})?\s+(?:[а-я]+)\s*)", "", fallback, flags=re.IGNORECASE)
    return fallback[:120].rstrip(" ,;:-") or "Событие в Токсово"


def normalize_title_tail(title: str) -> str:
    title = clean_text(title)
    title = re.sub(r"^(?:🗓️|📅|❗|✅|🎿|🏐|🏆|🎉|⚠️|⚠|😊)\s*", "", title)
    return title.strip()


def split_date_title(line: str) -> tuple[date | None, str | None]:
    line = clean_text(line)
    if not line:
        return None, None

    numeric = re.match(
        r"^(\d{1,2})(?:\s*[-–—и,]\s*(\d{1,2}))?\.(\d{1,2})\.(\d{2,4})(?:\s*[-–—:]\s*(.*))?$",
        line,
    )
    if numeric:
        day_a = int(numeric.group(1))
        day_b = int(numeric.group(2) or numeric.group(1))
        month_num = int(numeric.group(3))
        year = pick_year(numeric.group(4))
        title = normalize_title_tail(numeric.group(5) or "")
        candidate = parse_node_date(day_a, month_num, year)
        if candidate:
            return candidate, title or None
        return None, None

    month = re.match(
        r"^(\d{1,2})(?:\s*[-–—и,]\s*(\d{1,2}))?\s+(" + "|".join(MONTHS.keys()) + r")(?:\s+(\d{4}))?(?:\s*[-–—:]\s*|\s+)?(.*)$",
        line,
        flags=re.IGNORECASE,
    )
    if month:
        day_a = int(month.group(1))
        day_b = int(month.group(2) or month.group(1))
        month_num = MONTHS[month.group(3).lower()]
        year = pick_year(month.group(4))
        tail = normalize_title_tail(month.group(5) or "")
        candidate = parse_node_date(day_a, month_num, year)
        if candidate:
            title = tail
            return candidate, title or None
        return None, None

    return None, None


def extract_article_events(url: str, html: str, source_label: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    title = clean_text(soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else soup.title.get_text(" ", strip=True) if soup.title else "")
    body_text = clean_text(soup.get_text("\n", strip=True))
    lines = [clean_text(line) for line in body_text.split("\n") if clean_text(line)]
    events: list[dict] = []

    def build_event(event_date: date, event_title: str, meta: str | None = None) -> dict:
      display = summarize_event_title(body_text, event_title or title)
      return {
          "date": event_date.isoformat(),
          "day": str(event_date.day),
          "month": MONTH_ABBR[event_date.month],
          "title": display,
          "meta": meta or infer_meta(url, body_text),
          "source": source_label,
          "url": url,
      }

    event_date, parsed_title = split_date_title(title)
    if event_date:
        events.append(build_event(event_date, parsed_title or title))
        return events

    for line in lines[:20]:
        if len(events) >= 4:
            break
        if len(line) > 220:
            continue
        lower = line.lower()
        has_keyword = any(keyword in lower for keyword in EVENT_KEYWORDS)
        starts_with_date = bool(re.match(r"^\s*\d", line))
        if not has_keyword and not starts_with_date:
            if not re.search(r"\d{1,2}\.\d{1,2}|\d{1,2}\s+(" + "|".join(MONTHS.keys()) + r")", lower):
                continue
        event_date, parsed_title = split_date_title(line)
        if event_date:
            candidate_title = parsed_title or title
            events.append(build_event(event_date, candidate_title))

    if not events:
        # Fall back to the article title if it carries a date prefix.
        event_date, parsed_title = split_date_title(title)
        if event_date:
            events.append(build_event(event_date, parsed_title or title))

    return events


def extract_schedule_events(url: str, html: str, source_label: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    text = clean_text(soup.get_text("\n", strip=True))
    events: list[dict] = []
    meta = infer_meta(url, text)

    for raw_line in text.split("\n"):
        line = clean_text(raw_line)
        if not line:
            continue
        event_date, title = split_date_title(line)
        if not event_date:
            continue
        if not title:
            continue
        events.append(
            {
                "date": event_date.isoformat(),
                "day": str(event_date.day),
                "month": MONTH_ABBR[event_date.month],
                "title": title,
                "meta": meta,
                "source": source_label,
                "url": url,
            }
        )
    return events


def discover_links(url: str, html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    seen = set()
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if "/news/post-" not in href:
            continue
        full = urljoin(url, href)
        if full in seen:
            continue
        seen.add(full)
        links.append(full)
    return links


def collect_events() -> list[dict]:
    collected: list[dict] = []
    seen_keys: set[tuple[str, str]] = set()

    for source in SOURCES:
        kind = source["kind"]
        url, html = fetch_html(source["url"])
        article_urls: Iterable[str]

        if kind == "links":
            article_urls = discover_links(url, html)
        else:
            article_urls = [url]

        if kind == "schedule":
            raw_events = extract_schedule_events(url, html, source["label"])
        else:
            raw_events = []
            for article_url in article_urls:
                article_url, article_html = fetch_html(article_url)
                raw_events.extend(extract_article_events(article_url, article_html, source["label"]))

        for event in raw_events:
            event_date = datetime.strptime(event["date"], "%Y-%m-%d").date()
            if event_date < TODAY or event_date > WINDOW_END:
                continue
            key = (event["date"], event["title"].lower())
            if key in seen_keys:
                continue
            seen_keys.add(key)
            collected.append(event)

    collected.sort(key=lambda item: item["date"])
    return collected


def write_payload(events: list[dict]) -> None:
    payload = {
        "generatedAt": TODAY.isoformat(),
        "windowDays": WINDOW_DAYS,
        "events": events,
    }
    js = "window.CATALOG_EVENTS = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    Path("events.generated.js").write_text(js, encoding="utf-8")


def main() -> None:
    events = collect_events()
    write_payload(events)
    print(f"Collected {len(events)} events into events.generated.js")


if __name__ == "__main__":
    main()

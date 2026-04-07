#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import ssl
from collections import OrderedDict
from html import unescape
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

SITE_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
UNVERIFIED_CONTEXT = ssl._create_unverified_context()


def load_places():
    js = (
        "const fs=require('fs');"
        "const vm=require('vm');"
        "const code=fs.readFileSync('data.js','utf8')+'\\nthis.PLACES=PLACES;';"
        "const s={};vm.createContext(s);vm.runInContext(code,s);"
        "process.stdout.write(JSON.stringify(s.PLACES));"
    )
    out = subprocess.check_output(["node", "-e", js], text=True)
    return json.loads(out)


def clean_text(value):
    value = unescape(value or "")
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s*[\u2022·•]+\s*", " · ", value)
    value = value.strip(" -–—|")
    return value


def get_meta(soup, name=None, prop=None):
    if name:
        tag = soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
          return clean_text(tag["content"])
    if prop:
        tag = soup.find("meta", attrs={"property": prop})
        if tag and tag.get("content"):
            return clean_text(tag["content"])
    return ""


def normalize_url(url, base):
    if not url:
        return ""
    url = url.strip()
    if url.startswith("data:"):
        return ""
    return urljoin(base, url)


def score_image(url):
    low = url.lower()
    path = urlparse(low).path
    if not path.endswith((".jpg", ".jpeg", ".png", ".webp", ".svg")):
        return -1000
    score = 0
    if any(token in low for token in ("logo", "fav", "brand")):
        score += 120
    if any(token in low for token in ("hero", "main", "cover", "tonnel", "ski", "skym", "rollerm", "shoot", "img_", "photo")):
        score += 80
    if any(token in low for token in ("online", "icon", "sprite", "footer", "vk_black", "group_", "svg")):
        score -= 40
    if low.endswith(".webp"):
        score += 10
    if low.endswith(".jpg") or low.endswith(".jpeg"):
        score += 8
    if low.endswith(".png"):
        score += 4
    return score


def extract_blocks(soup):
    candidates = []
    roots = soup.select("main, article") or [soup.body or soup]
    for root in roots:
        for tag in root.find_all(["h1", "h2", "h3", "p", "li"], recursive=True):
            text = clean_text(tag.get_text(" ", strip=True))
            if not text:
                continue
            if len(text) < 22:
                continue
            if re.fullmatch(r"[0-9\s:+\-()]{1,20}", text):
                continue
            if text.lower() in {"контакты", "карта", "главная", "меню", "о нас"}:
                continue
            candidates.append(text)
    return candidates


def build_description(title, meta_desc, blocks):
    parts = []
    meta_desc = clean_text(meta_desc)
    title = clean_text(title)
    if meta_desc:
        parts.append(meta_desc)
    elif title and title not in parts:
        parts.append(title)
    for block in blocks:
        if block not in parts:
            parts.append(block)
        text = " · ".join(parts)
        if len(text) >= 300:
            break
    text = " ".join(parts)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 600:
        cut = text[:600]
        idx = max(cut.rfind("."), cut.rfind("!"), cut.rfind("?"))
        if idx > 260:
            cut = cut[: idx + 1]
        text = cut
    return text


def fetch_site(url):
    req = Request(url, headers={"User-Agent": SITE_USER_AGENT})
    with urlopen(req, timeout=20, context=UNVERIFIED_CONTEXT) as resp:
        return resp.read().decode(resp.headers.get_content_charset() or "utf-8", errors="replace")


def collect_for_place(place):
    website = place.get("website") or ""
    if not website:
        return None
    html = None
    errors = []
    attempts = [website]
    if website.startswith("https://"):
        attempts.append(website.replace("https://", "http://", 1))
    for candidate in attempts:
        try:
            html = fetch_site(candidate)
            website = candidate
            break
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    if html is None:
        return {"error": " | ".join(errors)}

    soup = BeautifulSoup(html, "html.parser")
    base = website
    title = get_meta(soup, prop="og:title") or clean_text(soup.title.get_text(" ", strip=True) if soup.title else place.get("name", ""))
    meta_desc = get_meta(soup, name="description") or get_meta(soup, prop="og:description") or get_meta(soup, name="twitter:description")
    blocks = extract_blocks(soup)
    description = build_description(title, meta_desc, blocks)

    image_candidates = []
    for content in [
        get_meta(soup, prop="og:image"),
        get_meta(soup, name="twitter:image"),
        get_meta(soup, prop="image"),
    ]:
        if content:
            image_candidates.append(normalize_url(content, base))

    for tag in soup.find_all(["img", "source"]):
        src = tag.get("src") or tag.get("data-original") or tag.get("data-src")
        if not src and tag.get("srcset"):
            src = tag.get("srcset").split(",")[0].strip().split(" ")[0]
        src = normalize_url(src, base)
        if src:
            image_candidates.append(src)

    unique = []
    seen = set()
    for url in image_candidates:
        if not url or url in seen:
            continue
        seen.add(url)
        unique.append(url)
    unique.sort(key=score_image, reverse=True)

    host = urlparse(website).netloc.replace("www.", "")
    source = f"официальный сайт {host}"

    return {
        "description": description,
        "photos": unique[:5],
        "source": source,
        "title": title,
        "meta_desc": meta_desc,
        "website": website,
    }


def main():
    places = load_places()
    report = {}
    changed = 0
    for place in places:
        if not place.get("website"):
            continue
        result = collect_for_place(place)
        if not result or result.get("error"):
            report[place["slug"]] = result or {"error": "unknown"}
            continue
        updated = False
        if result.get("description") and len(result["description"]) > 120:
            place["description"] = result["description"]
            updated = True
        if result.get("photos"):
            place["photos"] = result["photos"]
            updated = True
        if result.get("source"):
            place["source"] = result["source"]
            updated = True
        report[place["slug"]] = {
            "title": result.get("title"),
            "description": result.get("description"),
            "photos": result.get("photos", []),
            "source": result.get("source"),
            "updated": updated,
        }
        if updated:
            changed += 1

    data = "const PLACES = " + json.dumps(places, ensure_ascii=False, indent=2) + ";\n"
    with open("data.js", "w", encoding="utf-8") as f:
        f.write(data)
    with open("official_content_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"Updated {changed} places")


if __name__ == "__main__":
    main()

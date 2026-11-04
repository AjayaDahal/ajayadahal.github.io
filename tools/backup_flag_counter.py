"""Back up the Flag Counter stats behind the Global Visitors section of home.html.

Flag Counter deletes a free counter that has not logged a new visitor for 30 days, and its
history goes with it (https://flagcounter.com/faq.html). This script copies what the
counter's public stats pages show into data/flag-counter/WPje.json: the totals and records,
every country and region, the date each flag was first seen, and the visitors and views for
every day since the counter started.

    python tools/backup_flag_counter.py              refresh data/flag-counter/WPje.json
    python tools/backup_flag_counter.py --snapshot   also refresh images/flag-counter/snapshot.png,
                                                     the copy shown when a blocker hides the counter,
                                                     and its date in home.html

Reading the stats pages is not counted as a visit. Loading the counter image is, so
--snapshot adds this machine as a visitor for the day. A backup is never replaced by one
with lower totals, so a reset or deleted counter cannot overwrite the saved history.
"""

import argparse
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

COUNTER = "WPje"
SITE = "https://s01.flagcounter.com"
IMAGE = (f"{SITE}/countxl/{COUNTER}/bg_FFFFFF/txt_3e64ff/border_CCCCCC/columns_2/"
         "maxflags_20/viewers_0/labels_0/pageviews_0/flags_0/percent_0/")
ROOT = Path(__file__).resolve().parent.parent
BACKUP = ROOT / "data" / "flag-counter" / f"{COUNTER}.json"
SNAPSHOT = ROOT / "images" / "flag-counter" / "snapshot.png"
HOME = ROOT / "home.html"
AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) flag-counter-backup (+https://ajayadahal.github.io)"
DATE = r"[A-Z][a-z]+ \d{1,2}, \d{4}"


def fetch(url, binary=False):
    request = urllib.request.Request(url if url.startswith("http") else SITE + url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read()
    time.sleep(0.5)  # a free service: no bursts
    return body if binary else body.decode("utf-8", "replace")


def text(fragment):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def count(value):
    return int(value.replace(",", ""))


def day(value, now):
    """ISO date for Flag Counter's '2 hours ago' or 'October 4, 2026'; anything else is kept as written."""
    value = value.strip()
    match = re.fullmatch(r"(\d+) (minute|hour|day)s? ago", value)
    if match:
        return (now - dt.timedelta(**{match[2] + "s": int(match[1])})).date().isoformat()
    if value.lower() in ("today", "yesterday"):
        return (now.date() - dt.timedelta(days=value.lower() == "yesterday")).isoformat()
    try:
        return dt.datetime.strptime(value, "%B %d, %Y").date().isoformat()
    except ValueError:
        return value


def overview(now):
    page = text(fetch(f"/more/{COUNTER}/"))

    def find(pattern):
        match = re.search(pattern, page)
        if not match:
            sys.exit(f"The overview page has changed: nothing matches {pattern!r}. Backup not written.")
        return match

    places = find(r"([\d,]+) different countries have visited this site\. ([\d,]+) flags collected")
    last = find(rf"Last New Visitor (.+?) Visited (\d+ \w+ ago|{DATE})")
    newest = find(rf"Newest Country (.+?) Last Visited ({DATE})")
    visitors = find(rf"Visitors Yesterday: ([\d,]+) 30 day average: ([\d,]+) Record: ([\d,]+) on ({DATE})")
    views = find(rf"Flag Counter Views Yesterday: ([\d,]+) 30 day average: ([\d,]+) Record: ([\d,]+) on ({DATE})")
    return {
        "countries": count(places[1]),
        "flags": count(places[2]),
        "last_new_visitor": {"place": last[1], "date": day(last[2], now)},
        "newest_country": {"name": newest[1], "last_visit": day(newest[2], now)},
        "visitors": {"yesterday": count(visitors[1]), "average_30_days": count(visitors[2]),
                     "record": count(visitors[3]), "record_date": day(visitors[4], now)},
        "views": {"yesterday": count(views[1]), "average_30_days": count(views[2]),
                  "record": count(views[3]), "record_date": day(views[4], now)},
    }


def daily(now):
    first = fetch(f"/more30/{COUNTER}/")
    totals = re.search(r"viewed ([\d,]+) times by ([\d,]+) visitors?", text(first))
    if not totals:
        sys.exit("The history page has changed: no 'viewed N times by N visitors'. Backup not written.")
    pages = max([1] + [int(n) for n in re.findall(rf"/more30/{COUNTER}/(\d+)", first)])
    rows, today = [], None
    for number in range(1, pages + 1):
        page = first if number == 1 else fetch(f"/more30/{COUNTER}/{number}")
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
            cells = [text(cell) for cell in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
            if len(cells) != 3 or not all(re.fullmatch(r"[\d,]+", c) for c in cells[1:]):
                continue
            if cells[0] == "Today":
                today = [count(cells[1]), count(cells[2])]
            elif re.fullmatch(DATE, cells[0]):
                rows.append([day(cells[0], now), count(cells[1]), count(cells[2])])
    rows.sort()
    if today and rows:
        # Today's row has no date: it is the day after the newest dated one, on Flag Counter's calendar.
        rows.append([(dt.date.fromisoformat(rows[-1][0]) + dt.timedelta(days=1)).isoformat(), *today])
    return {"views": count(totals[1]), "visitors": count(totals[2])}, rows


def countries(now):
    page = fetch(f"/countries/{COUNTER}/")
    shown = re.search(r"Countries 1 - (\d+) of (\d+)", page)
    if shown and shown[1] != shown[2]:
        print(f"warning: the details page lists {shown[1]} of {shown[2]} countries; the rest are not saved")
    rows = list(re.finditer(r"<tr><td width=20><font face=arial size=-2>(\d+)\.</font></td>(.*?)</tr>", page, re.S))
    result = []
    for i, row in enumerate(rows):
        body = row[2]
        entry = {
            "rank": int(row[1]),
            "code": re.search(r'class="flag-([a-z0-9]+)-png"', body)[1],
            "name": text(re.search(r"<u>(.*?)</u>", body, re.S)[1]),
            "visitors": count(re.search(r"<td width=1%><font face=arial size=2>([\d,]+)</font>", body)[1]),
            "last_new_visitor": day(text(re.findall(r"<td>([^<]*)</td>", body)[-1]), now),
        }
        regions_html = page[row.end():rows[i + 1].start() if i + 1 < len(rows) else len(page)]
        label = re.search(r"<td colspan=2><b>(.*?)</b></td><td width=100><b>Visitors", regions_html)
        regions = re.findall(r"<td width=18><img src=https?://cdn\.boardhost\.com/[a-z_]+/([a-z0-9_-]+)\.png></td>"
                             r"<td width=225>(.*?)</td><td width=100>([\d,]+)</td><td><font[^>]*>(.*?)</font></td>",
                             regions_html, re.S)
        if label and regions:
            entry["region_type"] = text(label[1])
            entry["regions"] = [{"code": c, "name": text(n), "visitors": count(v), "last_new_visitor": day(text(d), now)}
                                for c, n, v, d in regions]
        result.append(entry)
    return result


def flag_history(now):
    first = fetch(f"/history/{COUNTER}/")
    pages = max([1] + [int(n) for n in re.findall(rf"/history/{COUNTER}\?(\d+)", first)])
    entries = []
    for number in range(1, pages + 1):
        page = first if number == 1 else fetch(f"/history/{COUNTER}?{number}")
        for date, cell in re.findall(r"<tr><td width=150><nobr>(.*?)</nobr>.*?</td><td width=300>(.*?)</td>", page, re.S):
            country = re.search(r"/flags/([a-z0-9]+)\.png", cell)
            region = re.search(r"/flags/[a-z0-9]+/([a-z0-9_-]+)\.png", cell)
            entry = {"date": day(text(date), now), "flag": text(cell).strip(" ,"), "country": country[1] if country else None}
            if region:
                entry["region"] = region[1]
            entries.append(entry)
    return sorted(entries, key=lambda e: e["date"])


def dump(data):
    """JSON with one line per day, region and flag, so a refreshed backup diffs line by line."""
    out = json.dumps(data, indent=2, ensure_ascii=False)
    flat = lambda m: m[1] + re.sub(r"\s*\n\s*", " ", m[2]).strip() + m[3]
    return re.sub(r"([\[{])\s*\n\s*([^\[\]{}]*?)\s*\n\s*([\]}])", flat, out) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--snapshot", action="store_true",
                        help="also refresh images/flag-counter/snapshot.png and its date in home.html")
    args = parser.parse_args()
    sys.stdout.reconfigure(errors="replace")

    now = dt.datetime.now().astimezone()
    summary = overview(now)
    totals, days = daily(now)
    if not days:
        sys.exit("No daily history came back. Backup not written.")
    places, flags = countries(now), flag_history(now)
    # The counter starts on the day of its first flag; Flag Counter's daily table can begin later.
    dates = [dt.date.fromisoformat(r[0]) for r in days]
    start = min([dates[0]] + [dt.date.fromisoformat(f["date"]) for f in flags if re.fullmatch(r"\d{4}-\d\d-\d\d", f["date"])])
    dates.insert(0, start - dt.timedelta(days=1))
    missing = [(a + dt.timedelta(days=k)).isoformat() for a, b in zip(dates, dates[1:]) for k in range(1, (b - a).days)]
    data = {
        "counter": COUNTER,
        "stats": f"{SITE}/more/{COUNTER}/",
        "retrieved": now.isoformat(timespec="seconds"),
        "notes": "Dates are Flag Counter's. 'Last new visitor' dates within the past day are converted from "
                 "'N hours ago' at retrieval time. The newest row of 'daily' is the day in progress. Flag Counter's "
                 "daily table leaves out the days in daily.missing_dates, so its rows fall short of the totals "
                 "by daily.totals_minus_rows.",
        "totals": {"visitors": totals["visitors"], "views": totals["views"],
                   "countries": summary.pop("countries"), "flags": summary.pop("flags")},
        **summary,
        "countries": places,
        "flag_history": flags,
        "daily": {
            "columns": ["date", "visitors", "views"],
            "missing_dates": missing,
            "totals_minus_rows": {"visitors": totals["visitors"] - sum(r[1] for r in days),
                                  "views": totals["views"] - sum(r[2] for r in days)},
            "rows": days,
        },
    }

    checks = [
        ("countries listed", len(data["countries"]), data["totals"]["countries"]),
        ("flags in the history", len(data["flag_history"]), data["totals"]["flags"]),
        ("visitors summed over countries", sum(c["visitors"] for c in data["countries"]), data["totals"]["visitors"]),
        ("visitors summed over days", sum(r[1] for r in days), data["totals"]["visitors"]),
        ("views summed over days", sum(r[2] for r in days), data["totals"]["views"]),
    ]
    for label, got, expected in checks:
        print(f"{label}: {got}" + ("" if got == expected else f" (Flag Counter's total: {expected})"))
    if missing:
        print("days Flag Counter's daily table leaves out:", ", ".join(missing))
    if not data["countries"]:
        sys.exit("No countries came back. Backup not written.")

    if BACKUP.exists():
        old = json.loads(BACKUP.read_text(encoding="utf-8"))["totals"]
        for key in ("visitors", "views", "countries", "flags"):
            if data["totals"][key] < old.get(key, 0):
                sys.exit(f"The counter reports {data['totals'][key]} {key}, the saved backup {old[key]}. "
                         "Was it reset or replaced? Backup not written.")
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    BACKUP.write_text(dump(data), encoding="utf-8")
    print(f"wrote {BACKUP.relative_to(ROOT)}: {data['totals']['visitors']} visitors, {data['totals']['views']} views, "
          f"{len(days)} days from {days[0][0]}")

    if args.snapshot:
        png = fetch(IMAGE, binary=True)
        if not png.startswith(b"\x89PNG"):
            sys.exit("The counter image did not come back as a PNG. Snapshot left as it was.")
        SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT.write_bytes(png)
        page = HOME.read_bytes().decode("utf-8")
        stamp = f'<time class="flag-snapshot-date" datetime="{now:%Y-%m-%d}">{now:%B} {now.day}, {now.year}</time>'
        page, found = re.subn(r'<time class="flag-snapshot-date" datetime="[^"]*">[^<]*</time>', stamp, page)
        if found != 1:
            sys.exit('home.html needs exactly one <time class="flag-snapshot-date">. Snapshot saved, date not updated.')
        HOME.write_bytes(page.encode("utf-8"))
        print(f"wrote {SNAPSHOT.relative_to(ROOT)} and dated it {now:%Y-%m-%d} in home.html")


if __name__ == "__main__":
    main()

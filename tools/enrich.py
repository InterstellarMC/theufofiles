#!/usr/bin/env python3
"""Enrich records.json with extracted metadata from PDF text + curated knowledge."""
import json, os, re, glob

# --- Geocoded locations (manually curated; lat,lng per location string) ---
GEO = {
    "Aegean Sea": (38.5, 25.0),
    "Arabian Gulf": (26.8, 51.5),
    "Arabian Sea": (15.0, 65.0),
    "Azerbaijan": (40.1431, 47.5769),
    "Detroit, MI": (42.3314, -83.0458),
    "Djibouti": (11.8251, 42.5903),
    "East China Sea": (29.0, 125.0),
    "Georgia": (32.1656, -82.9001),
    "Germany": (51.1657, 10.4515),
    "Greece": (39.0742, 21.8243),
    "Gulf of Aden": (12.0, 48.0),
    "Gulf of Oman": (24.5, 58.5),
    "Indo-PACOM": (20.0, 140.0),
    "Iran": (32.4279, 53.6880),
    "Iraq": (33.2232, 43.6793),
    "Japan": (36.2048, 138.2529),
    "Kazakhstan": (48.0196, 66.9237),
    "Low Earth Orbit": (0.0, 0.0),
    "Mediterranean Sea": (35.0, 18.0),
    "Mexico": (23.6345, -102.5528),
    "Middle East": (29.0, 41.0),
    "Moon": (0.0, 0.0),
    "Netherlands": (52.1326, 5.2913),
    "North America": (40.0, -100.0),
    "Pacific Ocean": (10.0, -150.0),
    "Pacific Time Zone": (37.5, -122.0),
    "Papua New Guinea": (-6.314993, 143.95555),
    "Southern United States": (32.0, -90.0),
    "Strait of Hormuz": (26.566, 56.25),
    "Syria": (34.8021, 38.9968),
    "Turkmenistan": (38.9697, 59.5563),
    "United Arab Emirates": (23.4241, 53.8478),
    "United States": (39.8283, -98.5795),
    "Western United States": (39.0, -113.0),
}

# --- Witness profiles (curated from public knowledge of cases) ---
WITNESSES = {
    "Frank Borman": {
        "title": "Astronaut, Gemini 7 Commander",
        "role": "On 5 December 1965 Borman radioed Houston during Gemini 7 reporting an unidentified object he called a 'bogey at 10 o'clock high.' The exchange is preserved in NASA-UAP-D3A.",
        "agencies": ["NASA"],
        "matches": ["Borman", "Frank Borman"],
    },
    "Jim Lovell": {
        "title": "Astronaut, Gemini 7 Pilot",
        "role": "Co-pilot on Gemini 7. After Borman's report Lovell concluded the bogey was likely the spent Titan II booster stage trailing in their orbit, but the audio was released as an unresolved UAP communication.",
        "agencies": ["NASA"],
        "matches": ["Lovell", "Jim Lovell"],
    },
    "Apollo 11 Crew": {
        "title": "Armstrong / Aldrin / Collins",
        "role": "During the technical crew debriefing (NASA-UAP-D4, 1969) the Apollo 11 crew described an unidentified object visible after trans-lunar injection, eventually attributed by NASA to a panel from the SLA but logged as unresolved at the time.",
        "agencies": ["NASA"],
        "matches": ["Apollo 11"],
    },
    "Apollo 12 Crew": {
        "title": "Conrad / Gordon / Bean",
        "role": "Apollo 12's transcript (NASA-UAP-D1, 1969) and onboard photography captured several unexplained luminous objects, six of which were released as the NASA-UAP-VM photo series.",
        "agencies": ["NASA"],
        "matches": ["Apollo 12"],
    },
    "Apollo 17 Crew": {
        "title": "Cernan / Evans / Schmitt",
        "role": "The Apollo 17 transcript (NASA-UAP-D2, 1972) and crew debriefings reference luminous flashes and an unidentified object during the lunar phase. Capt. Eugene Cernan was the last man to walk on the Moon.",
        "agencies": ["NASA"],
        "matches": ["Apollo 17"],
    },
    "Skylab Crew": {
        "title": "Skylab Mission Crew",
        "role": "The Skylab technical crew debriefing (NASA-UAP-D7, 1973) records visual sightings of an unknown rotating object during station-keeping.",
        "agencies": ["NASA"],
        "matches": ["Skylab"],
    },
    "U.S. Air Force": {
        "title": "United States Air Force",
        "role": "Lead service for early UFO investigations (Project SIGN, GRUDGE, BLUE BOOK). Author of the bulk of Cold War-era incident summaries (Box 7) and many Department of War mission reports in this release.",
        "agencies": ["Department of War"],
        "matches": ["Air Force", "USAF", "AFSOC"],
    },
    "U.S. Navy": {
        "title": "United States Navy",
        "role": "Source of multiple Range Fouler debriefs and shipborne sensor data, including PR36 (Middle East 2020) and the Iran-area encounters of August 2020.",
        "agencies": ["Department of War"],
        "matches": ["Navy", "USN", "Range Fouler"],
    },
    "U.S. Army": {
        "title": "United States Army",
        "role": "Reporting party for DOW-UAP-PR49 (North America, 2026). Historic ties via the Office of the Chief of Staff intelligence files (341_*).",
        "agencies": ["Department of War"],
        "matches": ["Army", "USARMY"],
    },
    "INDOPACOM Operators": {
        "title": "U.S. Indo-Pacific Command",
        "role": "Reporting unit for sightings off Japan (PR47), East China Sea (PR46) and the Indo-PACOM AOR (PR48).",
        "agencies": ["Department of War"],
        "matches": ["INDOPACOM", "Indo-Pacific"],
    },
    "CENTCOM Operators": {
        "title": "U.S. Central Command",
        "role": "Reporting unit for the bulk of recent unresolved UAP reports: Middle East 2020-2024, Iraq, Syria, the Arabian Gulf, and Greece.",
        "agencies": ["Department of War"],
        "matches": ["CENTCOM", "USCENTCOM", "Central Command"],
    },
    "FBI Field Agents": {
        "title": "Federal Bureau of Investigation",
        "role": "Authors of the 62-HQ-83894 case file and serial reports — investigative records, eyewitness testimonies, and public reports concerning Unidentified Flying Objects and flying discs documented between June 1947 and July 1968.",
        "agencies": ["FBI"],
        "matches": ["FBI", "Bureau", "Special Agent"],
    },
    "Department of State Officers": {
        "title": "U.S. Department of State",
        "role": "Authors of cables documenting overseas UAP reports — Papua New Guinea (Jan 1985), Kazakhstan (Jan 1994), Mexico, Iran and others.",
        "agencies": ["Department of State"],
        "matches": ["State Department", "Embassy", "DOS"],
    },
}

# --- date parsing ---
MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
def parse_date(s):
    if not s or s == "N/A":
        return None
    s = s.strip()
    m = re.match(r"^(19|20)\d{2}$", s)
    if m:
        y = int(s)
        return {"year": y, "month": 6, "day": 15, "label": s, "approx": True}
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if m:
        mo, da, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if yr < 100:
            yr = 1900 + yr if yr >= 40 else 2000 + yr
        return {"year": yr, "month": mo, "day": da,
                "label": f"{MONTHS[mo-1]} {da}, {yr}", "approx": False}
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})\s*-\s*(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        mo, da, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return {"year": yr, "month": mo, "day": da,
                "label": f"{MONTHS[mo-1]} {da}-{m.group(5)}, {yr}", "approx": False}
    if "Late 2025" in s:
        return {"year": 2025, "month": 12, "day": 1, "label": "Late 2025", "approx": True}
    return {"year": None, "month": None, "day": None, "label": s, "approx": True}

def first_meaningful_text(name):
    p = f"raw_text/{name}.txt"
    if not os.path.exists(p):
        return ""
    with open(p, encoding="utf-8", errors="replace") as f:
        text = f.read()
    lines = [ln.strip() for ln in text.splitlines()]
    body = []
    skip_keys = ("Declassified", "Dedasslfied", "Dedassified", "CLEARED",
                 "Recommendation by", "USCENTCOM Chief", "Department of Defense",
                 "OFFICE OF PREPUBLICATION", "Office of Prepublication",
                 "For Open Publication")
    for ln in lines:
        if not ln: continue
        if any(k in ln for k in skip_keys): continue
        body.append(ln)
    return "\n".join(body[:60])

def extract_witnesses(text, description):
    found = set()
    haystack = f"{description}\n{text}".lower()
    for name, info in WITNESSES.items():
        for needle in info["matches"]:
            if needle.lower() in haystack:
                found.add(name)
                break
    return sorted(found)

def filename_from_url(u):
    if not u: return ""
    return os.path.basename(u.split("?")[0])

with open("data/records.json") as f:
    records = json.load(f)

enriched = []
text_index = []
for r in records:
    text = ""
    if r["type"] == "PDF":
        fn = filename_from_url(r["asset_url"])
        tp = f"raw_text/{fn[:-4]}.txt"
        if os.path.exists(tp):
            text = open(tp, encoding="utf-8", errors="replace").read()
    desc = r.get("description","") or ""
    snippet = first_meaningful_text(filename_from_url(r["asset_url"])[:-4]) if r["type"] == "PDF" else ""
    wits = extract_witnesses(text, desc)
    loc = r.get("incident_location","")
    coords = GEO.get(loc) if loc and loc not in ("","N/A") else None
    date = parse_date(r.get("incident_date",""))
    e = dict(r)
    e["witnesses"] = wits
    e["coords"] = list(coords) if coords else None
    e["date_parsed"] = date
    e["pdf_snippet"] = snippet[:1500] if snippet else None
    e["pdf_text_available"] = bool(text)
    enriched.append(e)
    if text:
        clean = re.sub(r"[ \t]+", " ", text)
        clean = re.sub(r"\n{3,}", "\n\n", clean)
        text_index.append({"id": r["id"], "title": r["title"],
                           "agency": r["agency"], "type": r["type"],
                           "text": clean[:12000]})

with open("data/enriched.json","w") as f:
    json.dump(enriched, f, indent=2)
with open("data/text_index.json","w") as f:
    json.dump(text_index, f)
with open("data/witnesses.json","w") as f:
    json.dump(WITNESSES, f, indent=2)
with open("data/geo.json","w") as f:
    json.dump(GEO, f, indent=2)

print(f"Enriched {len(enriched)} records")
print(f"Text indexed {len(text_index)} PDFs")

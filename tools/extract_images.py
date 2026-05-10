#!/usr/bin/env python3
"""Extract images from PDFs and produce data/pdf_images.json + extracted_images/.

Strategy:
- Prefer DOW mission report PDFs (small, low page count, often contain FLIR/IR
  frames or sensor screenshots) and the smallest FBI files (which often hold
  legible diagrams). Skip extremely large scanned files - they're just letter
  scans with no useful imagery.
- Use pdfimages to extract raster images. Filter out tiny / very wide images
  (decoration, signature scans, letterhead).
- Sample at most N high-quality images per PDF to keep the gallery curated.
"""
import json, os, re, subprocess, glob
from PIL import Image

ROOT = os.path.abspath(os.path.dirname(__file__) + '/..')
PDF_DIR = os.path.join(ROOT, 'raw_pdfs')
OUT_DIR = os.path.join(ROOT, 'extracted_images')
os.makedirs(OUT_DIR, exist_ok=True)

with open(os.path.join(ROOT, 'data/records.json')) as f:
    records = json.load(f)

# Map filenames -> record
fn_to_rec = {}
for r in records:
    if r['type'] == 'PDF' and r.get('asset_url'):
        fn = os.path.basename(r['asset_url'].split('?')[0])
        if fn.endswith('.pdf'):
            fn_to_rec[fn] = r

# Heuristic: ignore very wide letterhead strips, very tiny images, and files
# that produce hundreds of identical letterhead images.
MIN_DIM = 240          # pixels per side minimum
MIN_AREA = 240*240     # minimum area
MAX_PER_PDF = 6        # cap per PDF (avoid one PDF dominating the gallery)
MAX_TOTAL = 240        # global cap
SKIP_FILES = {
    # FBI giant scans - just letterhead repeats; skip the large ones
    '65_HS1-834228961_62-HQ-83894_Section_4.pdf',
    '65_HS1-834228961_62-HQ-83894_Section_5.pdf',
    '65_HS1-834228961_62-HQ-83894_Section_6.pdf',
    '65_HS1-834228961_62-HQ-83894_Section_7.pdf',
    '65_HS1-834228961_62-HQ-83894_Section_8.pdf',
    '65_HS1-834228961_62-HQ-83894_Section_10.pdf',
}

def slug(s):
    return re.sub(r'[^A-Za-z0-9]+', '_', s).strip('_').lower()[:80]

results = []
total = 0

# Sort PDFs: prefer DOW mission reports first, then NASA, then small FBI
def priority(p):
    name = os.path.basename(p)
    if 'dow-uap' in name.lower():
        return (0, name)
    if 'nasa-uap' in name.lower():
        return (1, name)
    return (2, name)

pdf_paths = sorted(glob.glob(os.path.join(PDF_DIR, '*.pdf')), key=priority)
print(f"scanning {len(pdf_paths)} pdfs")

for pdf_path in pdf_paths:
    if total >= MAX_TOTAL:
        break
    fn = os.path.basename(pdf_path)
    if fn in SKIP_FILES:
        continue
    rec = fn_to_rec.get(fn)
    if not rec:
        continue
    size_mb = os.path.getsize(pdf_path) / 1024 / 1024
    # Skip very large files (likely huge scanned letterhead-only documents)
    if size_mb > 30:
        # but allow if filename mentions UAP / mission - those usually have FLIR frames
        if 'uap' not in fn.lower():
            continue
    pdf_slug = slug(fn[:-4])
    pdf_out_dir = os.path.join(OUT_DIR, pdf_slug)
    os.makedirs(pdf_out_dir, exist_ok=True)
    # already extracted? skip pdfimages but reuse files
    existing = sorted(glob.glob(os.path.join(pdf_out_dir, '*-???.[pj][pn]?')))
    if not existing:
        # extract first 30 pages worth (max 200 images) of the pdf
        try:
            subprocess.run(['pdfimages', '-j', '-p', '-l', '30', pdf_path,
                           os.path.join(pdf_out_dir, pdf_slug)],
                          timeout=180, check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            print(f"  pdfimages failed for {fn}: {e}")
            continue
        except subprocess.TimeoutExpired:
            print(f"  pdfimages timeout for {fn}")
            continue
        existing = sorted(glob.glob(os.path.join(pdf_out_dir, f'{pdf_slug}-*')))
    if not existing:
        continue
    # Filter and rank: keep big images, dedupe by file size hash bucket
    candidates = []
    seen_size = set()
    for img_path in existing:
        try:
            sz = os.path.getsize(img_path)
            # bucket sizes to dedupe identical extractions
            bucket = sz // 1024
            if bucket in seen_size:
                continue
            with Image.open(img_path) as im:
                w, h = im.size
                if w < MIN_DIM or h < MIN_DIM:
                    continue
                if w * h < MIN_AREA:
                    continue
                # ignore very thin (letterhead strips) or very tall
                ratio = max(w, h) / min(w, h)
                if ratio > 5:
                    continue
                seen_size.add(bucket)
                candidates.append((w * h, sz, img_path, w, h))
        except Exception as e:
            continue
    # Sort by area DESC, take top N
    candidates.sort(key=lambda c: -c[0])
    kept = candidates[:MAX_PER_PDF]
    for area, sz, img_path, w, h in kept:
        # convert to jpeg + thumbnail
        out_jpg = os.path.join(OUT_DIR, f"{pdf_slug}_p{len(results):03d}.jpg")
        try:
            with Image.open(img_path) as im:
                if im.mode != 'RGB':
                    im = im.convert('RGB')
                im.save(out_jpg, 'JPEG', quality=85)
        except Exception as e:
            print(f"  convert failed {img_path}: {e}")
            continue
        results.append({
            "pdf_id": rec["id"],
            "pdf_title": rec["title"],
            "pdf_url": rec["asset_url"],
            "agency": rec["agency"],
            "incident_date": rec.get("incident_date") or "",
            "incident_location": rec.get("incident_location") or "",
            "image": os.path.relpath(out_jpg, ROOT),
            "w": w, "h": h,
        })
        total += 1
        if total >= MAX_TOTAL:
            break

# Cleanup raw extracts (keep only converted jpegs)
import shutil
for sub in os.listdir(OUT_DIR):
    p = os.path.join(OUT_DIR, sub)
    if os.path.isdir(p):
        shutil.rmtree(p, ignore_errors=True)

with open(os.path.join(ROOT, 'data/pdf_images.json'), 'w') as f:
    json.dump(results, f, indent=2)
print(f"extracted {len(results)} images from {len(set(r['pdf_id'] for r in results))} PDFs")

#!/usr/bin/env python3
"""Extract EVERY embedded raster image from every PDF.

Differences from extract_images.py (the original curated 190-image set):
- No SKIP_FILES — process every PDF including the giant FBI scans.
- All pages, not just first 30.
- Per-PDF cap is generous (default 120) but de-duplicated by perceptual hash
  within the PDF so we don't get 200 identical letterhead crops.
- Minimum size loosened to 120x120 so signature scans, postage stamps,
  newspaper photos, FLIR thumbnails are all captured.
- Records the source page number for every image so UPhotos can deep-link
  back to the right PDF page.
- Optimizes output JPEGs to max-width 1600 @ q82, plus a 360-wide thumbnail
  per image so the gallery loads instantly.

Output: data/pdf_images.json (replaces curated set) — one entry per image
with pdf_id, pdf_url, agency, page (1-indexed), image, thumb, w, h.
"""
import json, os, re, subprocess, glob, hashlib, sys, time
from PIL import Image, ImageOps
import imagehash

ROOT = os.path.abspath(os.path.dirname(__file__) + '/..')
PDF_DIR = os.path.join(ROOT, 'raw_pdfs')
OUT_DIR = os.path.join(ROOT, 'extracted_images')
TMP_DIR = os.path.join(ROOT, '.extract_tmp')
THUMB_DIR = os.path.join(ROOT, 'extracted_thumbs')
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)

with open(os.path.join(ROOT, 'data/records.json')) as f:
    records = json.load(f)

fn_to_rec = {}
for r in records:
    if r.get('type') == 'PDF' and r.get('asset_url'):
        fn = os.path.basename(r['asset_url'].split('?')[0])
        if fn.endswith('.pdf'):
            fn_to_rec[fn] = r

MIN_DIM = 120
MIN_AREA = 120 * 120
MAX_PER_PDF = 120
MAX_OUT_W = 1600
THUMB_W = 360
PHASH_HAMMING = 4   # within a PDF, treat near-duplicates as same

ROTATE_FIX = True   # auto-orient via EXIF (mostly no-op for pdfimages output)

def slug(s):
    return re.sub(r'[^A-Za-z0-9]+', '_', s).strip('_').lower()[:80]

# Sort PDFs by size ASC so quick wins come first; allows resuming midway
pdf_paths = sorted(glob.glob(os.path.join(PDF_DIR, '*.pdf')),
                   key=lambda p: os.path.getsize(p))

print(f"scanning {len(pdf_paths)} pdfs", flush=True)

results = []
already_emitted = set()  # global (pdf_id, sha) to avoid emitting same file twice
start_t = time.time()

for pi, pdf_path in enumerate(pdf_paths):
    fn = os.path.basename(pdf_path)
    rec = fn_to_rec.get(fn)
    if not rec:
        continue
    pdf_slug = slug(fn[:-4])
    pdf_tmp = os.path.join(TMP_DIR, pdf_slug)
    os.makedirs(pdf_tmp, exist_ok=True)

    # If we've already extracted raw images for this PDF this run, reuse them.
    raw_existing = sorted(glob.glob(os.path.join(pdf_tmp, '*')))
    if not raw_existing:
        # Use -all so original JPEG / PNG streams are preserved (faster, no recompression).
        # -p prefixes filenames with page number so we can recover it.
        try:
            subprocess.run(
                ['pdfimages', '-all', '-p', pdf_path, os.path.join(pdf_tmp, 'img')],
                timeout=600, check=True, capture_output=True
            )
        except subprocess.CalledProcessError as e:
            err = (e.stderr or b'').decode(errors='ignore')[:200]
            print(f"  [{pi+1}/{len(pdf_paths)}] {fn}: pdfimages failed: {err}", flush=True)
            continue
        except subprocess.TimeoutExpired:
            print(f"  [{pi+1}/{len(pdf_paths)}] {fn}: pdfimages timeout", flush=True)
            continue
        raw_existing = sorted(glob.glob(os.path.join(pdf_tmp, '*')))

    candidates = []
    seen_phash = []
    seen_sha = set()

    for img_path in raw_existing:
        bn = os.path.basename(img_path)
        # Filename: img-<pageno>-<imgno>.<ext>
        mp = re.search(r'-(\d{1,4})-\d+\.(?:png|jpg|jpeg|tif|tiff|pbm|ppm|pgm|jp2|jb2|ccitt|bin)$', bn, re.I)
        page = int(mp.group(1)) if mp else 0
        try:
            with Image.open(img_path) as im:
                w, h = im.size
                if w < MIN_DIM or h < MIN_DIM: continue
                if w * h < MIN_AREA: continue
                ratio = max(w, h) / max(1, min(w, h))
                if ratio > 8: continue   # super-thin letterhead strips
                # phash with downsample for speed
                im_for_hash = im.convert('L').resize((64, 64))
                ph = imagehash.phash(im_for_hash)
                # near-dup against PDF's seen
                dup = False
                for prev in seen_phash:
                    if ph - prev <= PHASH_HAMMING:
                        dup = True; break
                if dup: continue
                seen_phash.append(ph)
                # File content sha to also dedupe identical files globally
                with open(img_path, 'rb') as fp:
                    sha = hashlib.sha1(fp.read()).hexdigest()[:16]
                if sha in seen_sha: continue
                seen_sha.add(sha)
                candidates.append((w * h, img_path, w, h, page, sha))
        except Exception:
            continue

    # Order so larger/earlier-page images come first; cap per PDF.
    candidates.sort(key=lambda c: (-c[0], c[4]))
    candidates = candidates[:MAX_PER_PDF]

    kept_count = 0
    for area, img_path, w, h, page, sha in candidates:
        key = (rec['id'], sha)
        if key in already_emitted: continue
        already_emitted.add(key)
        out_idx = len([r for r in results if r['pdf_id'] == rec['id']])
        out_jpg = os.path.join(OUT_DIR, f"{pdf_slug}_p{out_idx:03d}.jpg")
        out_thumb = os.path.join(THUMB_DIR, f"{pdf_slug}_p{out_idx:03d}.jpg")
        try:
            with Image.open(img_path) as im:
                if im.mode != 'RGB':
                    im = im.convert('RGB')
                if ROTATE_FIX:
                    im = ImageOps.exif_transpose(im)
                # Optimize size
                ow, oh = im.size
                if ow > MAX_OUT_W:
                    new_h = int(oh * MAX_OUT_W / ow)
                    im_full = im.resize((MAX_OUT_W, new_h), Image.LANCZOS)
                else:
                    im_full = im
                im_full.save(out_jpg, 'JPEG', quality=82, optimize=True)
                # Thumbnail
                tw = min(THUMB_W, im_full.width)
                th = int(im_full.height * tw / im_full.width)
                im_full.resize((tw, th), Image.LANCZOS).save(out_thumb, 'JPEG', quality=78, optimize=True)
        except Exception as e:
            print(f"  convert failed {img_path}: {e}", flush=True)
            continue
        results.append({
            "pdf_id": rec["id"],
            "pdf_title": rec["title"],
            "pdf_url": rec["asset_url"],
            "agency": rec["agency"],
            "incident_date": rec.get("incident_date") or "",
            "incident_location": rec.get("incident_location") or "",
            "page": page,
            "image": os.path.relpath(out_jpg, ROOT),
            "thumb": os.path.relpath(out_thumb, ROOT),
            "w": w, "h": h,
        })
        kept_count += 1

    elapsed = time.time() - start_t
    print(f"  [{pi+1}/{len(pdf_paths)}] {fn[:60]:60s} kept={kept_count:3d}  total={len(results):4d}  ({elapsed:.0f}s)", flush=True)

# Cleanup tmp
import shutil
shutil.rmtree(TMP_DIR, ignore_errors=True)

with open(os.path.join(ROOT, 'data/pdf_images.json'), 'w') as f:
    json.dump(results, f)
print(f"DONE: extracted {len(results)} images from {len(set(r['pdf_id'] for r in results))} PDFs in {time.time()-start_t:.0f}s")

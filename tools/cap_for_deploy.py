#!/usr/bin/env python3
"""Build a slimmed dist/ for the live preview.

Source tree (~/repos/ufo-archive/data/pdf_images.json + extracted_images/)
keeps ALL 2,349 images (so GitHub gets the full archive).

Deploy bundle (dist/data/pdf_images.json + dist/extracted_images/) keeps a
curated subset capped at N images per PDF, sorted by area DESC so the most
information-dense images survive."""
import json, os, glob, shutil

CAP = 12
ROOT = '/home/ubuntu/repos/ufo-archive'
src_manifest = os.path.join(ROOT, 'data/pdf_images.json')
dst_manifest = os.path.join(ROOT, 'dist/data/pdf_images.json')

imgs = json.load(open(src_manifest))
print(f"input: {len(imgs)} images")

# Sort then keep top-N per PDF
imgs.sort(key=lambda r: (r['pdf_id'], -(r.get('w',0) * r.get('h',0))))
kept = []
per = {}
for r in imgs:
    per.setdefault(r['pdf_id'], 0)
    if per[r['pdf_id']] < CAP:
        kept.append(r); per[r['pdf_id']] += 1

print(f"kept: {len(kept)} images (cap={CAP}/PDF) across {len(per)} PDFs")

with open(dst_manifest, 'w') as f:
    json.dump(kept, f)

keep_full = {r['image'] for r in kept}
keep_thumb = {r['thumb'] for r in kept}

removed_full = removed_thumb = 0
for p in glob.glob(os.path.join(ROOT, 'dist/extracted_images/*.jpg')):
    rel = 'extracted_images/' + os.path.basename(p)
    if rel not in keep_full:
        os.remove(p); removed_full += 1
for p in glob.glob(os.path.join(ROOT, 'dist/extracted_thumbs/*.jpg')):
    rel = 'extracted_thumbs/' + os.path.basename(p)
    if rel not in keep_thumb:
        os.remove(p); removed_thumb += 1

print(f"removed {removed_full} full + {removed_thumb} thumbs from dist/")

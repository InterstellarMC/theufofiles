#!/usr/bin/env python3
"""Resize and recompress extracted images to keep gallery snappy."""
import os, glob
from PIL import Image

ROOT = os.path.abspath(os.path.dirname(__file__) + '/..')
src_dir = os.path.join(ROOT, 'extracted_images')
out_dir = os.path.join(ROOT, 'extracted_images_thumbs')
os.makedirs(out_dir, exist_ok=True)

MAX_DIM = 1400          # for full image
THUMB_DIM = 480         # for grid thumbnail
QUALITY = 78

paths = sorted(glob.glob(os.path.join(src_dir, '*.jpg')))
saved_size = 0
total_size = 0
for p in paths:
    base = os.path.basename(p)
    full_out = os.path.join(src_dir, base)  # overwrite in place
    thumb_out = os.path.join(out_dir, base)
    try:
        with Image.open(p) as im:
            if im.mode != 'RGB':
                im = im.convert('RGB')
            w, h = im.size
            scale = min(1.0, MAX_DIM / max(w, h))
            if scale < 1.0:
                im2 = im.resize((int(w*scale), int(h*scale)), Image.LANCZOS)
            else:
                im2 = im.copy()
            im2.save(full_out, 'JPEG', quality=QUALITY, optimize=True)
            # thumbnail
            tscale = min(1.0, THUMB_DIM / max(im.size))
            timg = im.resize((int(im.size[0]*tscale), int(im.size[1]*tscale)), Image.LANCZOS) if tscale < 1.0 else im.copy()
            timg.save(thumb_out, 'JPEG', quality=72, optimize=True)
        sz = os.path.getsize(full_out)
        total_size += sz
    except Exception as e:
        print('failed', p, e)
print(f"compressed {len(paths)} images, total {total_size/1024/1024:.1f} MB")

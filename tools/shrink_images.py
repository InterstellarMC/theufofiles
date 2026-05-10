#!/usr/bin/env python3
"""Shrink dist/extracted_images/ to a reasonable hosting size by clamping
max dimension and using mozjpeg-friendly q70."""
import os, glob
from PIL import Image, ImageOps

MAX_W = 900
QUALITY = 75
ROOT = '/home/ubuntu/repos/ufo-archive/dist/extracted_images'

before = sum(os.path.getsize(p) for p in glob.glob(os.path.join(ROOT, '*.jpg')))
n = 0
for p in glob.glob(os.path.join(ROOT, '*.jpg')):
    try:
        with Image.open(p) as im:
            im = ImageOps.exif_transpose(im).convert('RGB')
            w, h = im.size
            if w > MAX_W:
                nh = int(h * MAX_W / w)
                im = im.resize((MAX_W, nh), Image.LANCZOS)
            im.save(p, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        n += 1
    except Exception as e:
        print(f"  fail {p}: {e}")
after = sum(os.path.getsize(p) for p in glob.glob(os.path.join(ROOT, '*.jpg')))
print(f"shrunk {n} files: {before/1024/1024:.0f} MB -> {after/1024/1024:.0f} MB")

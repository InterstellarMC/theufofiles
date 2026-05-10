"""Build per-page text + search chunk indexes from open-atlas corpus.jsonl."""
import json, re, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / 'data'
CORPUS = Path('/tmp/ufo-pursue-open-atlas/corpus.jsonl')
ATLAS_DATA = Path('/tmp/ufo-pursue-open-atlas/web/data.json')

# Load enriched records, build stem -> id map (with normalization)
enriched = json.load(open(DATA/'enriched.json'))
def norm(s): return re.sub(r'[^a-z0-9]+', '', s.lower())
stem_to_id = {}
for r in enriched:
    if r.get('type') != 'PDF': continue
    url = r.get('asset_url', '')
    if not url: continue
    stem = url.rsplit('/', 1)[-1].replace('.pdf', '')
    stem_to_id[norm(stem)] = r['id']

# Map every corpus row to one of our records
pages = []  # one entry per PDF page
unmatched = set()
with open(CORPUS) as f:
    for line in f:
        rec = json.loads(line)
        rid = stem_to_id.get(norm(rec['pdf_stem']))
        if not rid:
            unmatched.add(rec['pdf_stem'])
            continue
        pages.append({
            'rid': rid,
            'p': rec['page_num'],
            'tot': rec['total_pages'],
            'text': rec['text'],
        })
print(f'pages mapped: {len(pages)} unmatched stems: {len(unmatched)}')
print('unmatched:', unmatched)

# Save per-page json
(DATA/'pdf_pages.json').write_text(json.dumps(pages, ensure_ascii=False, separators=(',',':')))
print('wrote pdf_pages.json (%.1f MB)' % ((DATA/'pdf_pages.json').stat().st_size/1024/1024))

# Build search chunks: for each page, produce 1-N small chunks (~300 chars) for fast snippet search.
# But to keep file small we just store full pages + use client-side substring search.
# Compose a lightweight inverted-token index: token -> list of (rid, page) pairs (top 5000 tokens).
from collections import Counter
STOP = set('the a an and or of to in for on with by at from is are was were be been being it its this that those these as if then so than which who whose what when where why how but not no any all each every some many much most more less few several both either neither each only just very also into onto out over under above below up down off out back further then there here their them they we us our ours your you i he she his her him me my mine'.split())
WORD = re.compile(r"[a-zA-Z][a-zA-Z'-]{2,}")

# Build merged record full-text (one text per record across all its pages) for the legacy text_index UI usage
record_text = {}
for p in pages:
    record_text.setdefault(p['rid'], []).append(p['text'])
# Save merged record texts so legacy text_index.json gets richer
merged = []
for rid, parts in record_text.items():
    merged.append({'id': rid, 'text': '\n\n'.join(parts)})
print(f'merged record texts: {len(merged)}')

# Update text_index.json: keep title/agency from existing, refresh text
existing = json.load(open(DATA/'text_index.json'))
by_id_existing = {r['id']: r for r in existing}
for m in merged:
    rid = m['id']
    if rid in by_id_existing:
        by_id_existing[rid]['text'] = m['text']
    else:
        # find from enriched
        rec = next((r for r in enriched if r['id'] == rid), None)
        if rec:
            by_id_existing[rid] = {
                'id': rid,
                'title': rec.get('title',''),
                'agency': rec.get('agency',''),
                'type': rec.get('type','PDF'),
                'text': m['text'],
            }
out_index = list(by_id_existing.values())
(DATA/'text_index.json').write_text(json.dumps(out_index, ensure_ascii=False, separators=(',',':')))
print(f'text_index.json now has {len(out_index)} records')

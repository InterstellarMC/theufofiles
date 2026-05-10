/* umeni.js — keyword-grounded explanation engine over the declassified records */

const Umeni = (() => {

  const STOP = new Set(['the','a','an','of','and','or','to','in','on','at','for','from','by','is','are','was','were','be','been','being','it','its','this','that','these','those','as','with','about','any','all','what','where','when','who','how','why','which','do','does','did','i','me','my','you','your','we','our','they','their','please','tell','give','show','explain','summary','summarise','summarize','list','find','can','could','would','should','need','want','let','also','more','most','many','some']);

  function tokenize(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9'\-\s]/g,' ').split(/\s+/).filter(t => t && !STOP.has(t) && t.length > 1);
  }

  function fmtAgency(a) { return AGENCIES[a]?.short || a; }

  /* --- Inverted text index built lazily --- */
  let _index = null;
  function buildIndex() {
    if (_index) return _index;
    const docs = [];
    state.enriched.forEach(r => {
      const text = [r.title, r.description, r.incident_location, r.incident_date,
                    r.video_title, (r.witnesses||[]).join(' '),
                    r.pdf_snippet || ''].filter(Boolean).join(' \n ');
      docs.push({ id: r.id, text, kind:'meta' });
    });
    state.textIndex.forEach(t => docs.push({ id: t.id, text: t.text, kind:'pdf' }));
    _index = docs;
    return docs;
  }

  function snippetAround(text, term, radius = 180) {
    const i = text.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return null;
    const start = Math.max(0, i - radius);
    const end = Math.min(text.length, i + term.length + radius);
    let s = text.slice(start, end).replace(/\s+/g,' ').trim();
    if (start > 0) s = '… ' + s;
    if (end < text.length) s = s + ' …';
    return s;
  }

  function bestMultiSnippet(text, terms) {
    for (const t of terms) {
      const s = snippetAround(text, t);
      if (s) return s;
    }
    return null;
  }

  function rank(query) {
    const docs = buildIndex();
    const terms = tokenize(query);
    if (!terms.length) return [];
    const scores = {};
    docs.forEach(d => {
      const lc = d.text.toLowerCase();
      let score = 0;
      terms.forEach(t => {
        const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`, 'g');
        const m = lc.match(re);
        if (m) score += m.length * (d.kind === 'pdf' ? 1.0 : 1.4);
      });
      const phrase = terms.join(' ');
      if (lc.includes(phrase)) score += 4;
      if (score > 0) {
        if (!scores[d.id] || score > scores[d.id].score) {
          scores[d.id] = { id: d.id, score, kind: d.kind, text: d.text };
        }
      }
    });
    return Object.values(scores).sort((a,b) => b.score - a.score);
  }

  /* --- External knowledge cards --- */
  const EXTERNAL_NOTES = [
    {match:['borman','gemini'], note: 'Public reporting (Wikipedia, NASA history pages) attributes the December 5, 1965 "bogey at 10 o\'clock high" sighting on Gemini 7 to Frank Borman; Jim Lovell ultimately concluded the unidentified object was the spent Titan II booster trailing them in orbit.'},
    {match:['apollo 11'], note: 'Public reporting: the Apollo 11 crew (Armstrong, Aldrin, Collins) saw an unidentified object after trans-lunar injection in July 1969; NASA later attributed it to a panel from the SLA, but the original log entry was preserved as unresolved.'},
    {match:['apollo 12'], note: 'Public reporting: Apollo 12 (Conrad, Gordon, Bean) photographed unidentified luminous objects on the November 1969 mission; the six NASA-UAP-VM photos in this release are likely those frames.'},
    {match:['apollo 17','cernan','schmitt'], note: 'Public reporting: Apollo 17 (Cernan, Evans, Schmitt, December 1972) observed unidentified flashes during lunar transit and EVAs; Schmitt, the geologist, ran spectroscopy in his head and concluded "huh, weird".'},
    {match:['skylab'], note: 'Public reporting: a 1973 Skylab crew sighting was logged when the crew photographed a rotating object during station-keeping; the technical debriefing is NASA-UAP-D7.'},
    {match:['oak ridge','foo','foofighter'], note: 'Public reporting: 1944–45 "foo fighter" reports came from Allied bomber crews over Europe; the SHAEF intelligence summaries archived here include several first-person observations.'},
    {match:['flying disc','62-hq-83894','arnold'], note: 'External context: FBI file 62-HQ-83894 spans June 1947 – July 1968 and was previously partially posted on the FBI Vault; it includes the Kenneth Arnold case (24 June 1947) that coined the term "flying saucer".'},
    {match:['range fouler'], note: 'External context: "Range fouler" is a U.S. Navy term for an unidentified object that strays into a training range and disrupts an exercise — many of the recent CENTCOM debriefs use it.'},
    {match:['centcom'], note: 'External context: USCENTCOM (Tampa, FL) covers the Middle East AOR and reports UAP sightings to AARO via the Joint Staff process. Approval authority for the redacted MISREPs in this release was BG Brandon R. Tegtmeier and BG Richard A. Harrison.'},
    {match:['indopacom'], note: 'External context: USINDOPACOM (Camp Smith, HI) covers the Pacific theater. Two of its UAP debriefs are in this release.'},
    {match:['aaro'], note: 'External context: the All-domain Anomaly Resolution Office (AARO) was created in 2022 as the DOD/DOW lead for resolving UAP cases; AARO\'s 2024 historical review found no evidence of recovered NHI craft.'},
    {match:['pursue'], note: 'External context: PURSUE = Presidential Unsealing and Reporting System for UAP Encounters, the umbrella program for this rolling declassification announced May 8, 2026.'},
    {match:['misrep'], note: 'External context: MISREP = Mission Report, the standard form theater commands use to document a tactical engagement. Each redacted PDF in this release follows the same template.'},
    {match:['dvids'], note: 'External context: DVIDS (Defense Visual Information Distribution Service) is the Pentagon\'s public release portal — the videos in this drop have DVIDS mirrors.'},
    {match:['hegseth','war.gov','department of war'], note: 'External context: Pete Hegseth, U.S. Secretary of War, oversaw the May 8, 2026 release: "The Department of War is in lockstep with President Trump\'s directive to deliver maximum transparency."'},
    {match:['trump','potus','president'], note: 'External context: President Donald J. Trump signed the executive order creating PURSUE during his second term and posted the announcement on Truth Social on May 8, 2026.'},
    {match:['titan ii'], note: 'External context: the Titan II launch vehicle for Gemini 7 left a spent second stage trailing in a similar orbit; multiple analysts have argued this explained Borman\'s "bogey".'},
  ];

  function externalContextFor(query) {
    const q = query.toLowerCase();
    return EXTERNAL_NOTES.filter(n => n.match.some(m => q.includes(m))).map(n => n.note);
  }

  /* --- Recognisers --- */
  const YEAR_RE = /\b(19[4-9][0-9]|20[0-2][0-9])\b/;
  const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const MONTH_NUM = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };

  function parseTimeWindow(q) {
    const lc = q.toLowerCase();
    const ym = lc.match(YEAR_RE);
    let monthIdx = -1;
    for (let i=0;i<MONTH_NAMES.length;i++) if (lc.includes(MONTH_NAMES[i])) { monthIdx = i; break; }
    return { year: ym ? Number(ym[0]) : null, month: monthIdx >= 0 ? monthIdx + 1 : null };
  }

  function detectAgency(q) {
    const lc = q.toLowerCase();
    if (/\bfbi\b/.test(lc)) return 'FBI';
    if (/\bnasa\b|apollo|gemini|skylab/.test(lc)) return 'NASA';
    if (/\bdept\.? of war\b|\bdepartment of war\b|\bdow\b|\bpentagon\b/.test(lc)) return 'Department of War';
    if (/\bdept\.? of state\b|\bdepartment of state\b/.test(lc)) return 'Department of State';
    return null;
  }

  function detectType(q) {
    const lc = q.toLowerCase();
    if (/\bphoto|photograph|image|picture/.test(lc)) return 'IMG';
    if (/\bvideo|footage|clip|film/.test(lc)) return 'VID';
    if (/\bdocument|pdf|file|memo|report/.test(lc)) return 'PDF';
    return null;
  }

  function detectLocation(q) {
    const lc = q.toLowerCase();
    const seen = new Set();
    state.enriched.forEach(r => { if (r.incident_location && r.incident_location !== 'N/A') seen.add(r.incident_location); });
    for (const loc of seen) if (lc.includes(loc.toLowerCase())) return loc;
    return null;
  }

  function detectWitness(q) {
    const lc = q.toLowerCase();
    for (const name of Object.keys(state.witnesses)) {
      const matches = [name, ...(state.witnesses[name].matches || [])];
      if (matches.some(m => lc.includes(m.toLowerCase()))) return name;
    }
    return null;
  }

  function detectRecord(q) {
    const lc = q.toLowerCase();
    for (const r of state.enriched) {
      if (lc.includes(r.id.toLowerCase())) return r;
      // record code like DOW-UAP-PR49, NASA-UAP-D3
      const code = (r.title.split(',')[0] || '').toLowerCase().trim();
      if (code.length > 6 && lc.includes(code)) return r;
    }
    return null;
  }

  function isCountQuery(q) { return /\bhow many\b|\bcount\b|\bnumber of\b|\btotal\b/i.test(q); }
  function isComparison(q) { return /\bcompare|contrast|differ|vs\b|versus/i.test(q); }
  function isDefinition(q) { return /\bwhat is\b|\bwhat does\b|\bdefine\b|\bstands? for\b|\bwhat are\b/i.test(q); }
  function isOverview(q) { return /\bsumm[ae]ri[sz]e\b|\bsummary\b|\boverview\b|\bbullet\b|\brelease\b/i.test(q) && !/witness|record|case/i.test(q); }
  function isMostRecent(q) { return /\bmost recent\b|\blatest\b|\bnewest\b|\brecent(ly)?\b/i.test(q); }
  function isWhoQuery(q) { return /\bwho\b/i.test(q) && !/\bwho is\b/i.test(q); }
  function isMissingExplanation(q) { return /\bunresolved\b|\bunidentified\b|\bunknown\b|\bunexplain/i.test(q); }

  /* --- Definition handler --- */
  const DEFINITIONS = {
    'pursue': 'PURSUE — Presidential Unsealing and Reporting System for UAP Encounters. The umbrella program directed by Executive Order under President Donald J. Trump for ongoing UAP declassification. The May 8, 2026 release ("Release 01") is the first batch of documents, photos, and videos under this system.',
    'aaro': 'AARO — All-domain Anomaly Resolution Office. Created in 2022 inside the Office of the Secretary of Defense (now Secretary of War) as the lead organisation for resolving Unidentified Anomalous Phenomena cases across DOD/DOW.',
    'centcom': 'USCENTCOM — U.S. Central Command, headquartered in Tampa, FL. Area of responsibility covers 21 nations across the Middle East and Central Asia. Many of the 2020-2025 UAP MISREPs in this release came from CENTCOM operators.',
    'indopacom': 'USINDOPACOM — U.S. Indo-Pacific Command, headquartered at Camp H.M. Smith, HI. Covers the Pacific theatre.',
    'misrep': 'MISREP — Mission Report. The standard tactical-event reporting form used by U.S. military theatre commands. Most of the redacted PDFs in this release follow the MDR-form / MISREP template.',
    'range fouler': 'Range Fouler — U.S. Navy slang for an unidentified object that wanders into a training range and disrupts an exercise. The term appears throughout the recent CENTCOM debriefs.',
    'foia': 'FOIA — Freedom of Information Act, 1966. The original mechanism by which most pre-PURSUE UAP files (e.g. FBI Vault) were forced into the public.',
    'dvids': 'DVIDS — Defense Visual Information Distribution Service. Public Pentagon portal where most of the videos in this release have a mirror.',
    'mdr': 'MDR — Mandatory Declassification Review. The administrative process used to release the redacted CENTCOM mission reports in this drop.',
    'dow': 'DOW — Department of War. The May 2025 rebrand of the Department of Defense, restoring the pre-1947 name. Owner of the war.gov UFO release portal.',
    'umail': 'Umail is the interface you\'re looking at — a Gmail-style reader for the declassified UAP records. Each record is laid out like an email, with sender (the agency), recipient (the President), incident metadata, and attachments (PDFs, videos, photos).',
    'umeni': 'Umeni is the assistant you\'re talking to. I read every released file and description before answering. When I have to draw on outside knowledge (press, NASA history pages, Wikipedia), I clearly mark it with a ↪ "External context" prefix.',
    'utube': 'UTube is the video archive — every declassified UAP video in this release with a YouTube-style player and worldwide audience comments.',
    'udrive': 'UDrive is the document grid — every PDF in this release organised by agency and excerpt-availability.',
    'uphotos': 'UPhotos is the photograph gallery — both the official photo releases (FBI 2025 IR series + NASA-UAP-VM Apollo frames) and embedded images extracted from the document PDFs.',
    'uearth': 'UEarth is the global map — every geocoded sighting plotted on a dark-themed Leaflet map with a side panel of locations.',
    'ucalendar': 'UCalendar is the disclosure timeline — every dated sighting from 1945 to 2026, grouped by year and month.',
  };
  function definitionAnswer(q) {
    const lc = q.toLowerCase();
    for (const k of Object.keys(DEFINITIONS).sort((a,b) => b.length - a.length)) {
      if (lc.includes(k)) {
        let html = `<strong>${k.toUpperCase()}</strong><br>${escapeHtml(DEFINITIONS[k])}`;
        const rec = state.enriched.filter(r => (r.title + ' ' + r.description).toLowerCase().includes(k)).slice(0, 4);
        if (rec.length) {
          html += `<br><span class="grounding-label">Records that mention "${escapeHtml(k)}"</span><div>` +
            rec.map(r => `<span class="source" data-rid="${r.id}">${r.id.toUpperCase()} · ${escapeHtml(fmtTitle(r.title)).slice(0,80)}</span>`).join('') +
            `</div>`;
        }
        const ext = externalContextFor(q + ' ' + k);
        if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
        return html;
      }
    }
    return null;
  }

  /* --- Overview / release summary --- */
  function overviewAnswer(q) {
    const total = state.enriched.length;
    const byType = { PDF:0, VID:0, IMG:0 };
    state.enriched.forEach(r => byType[r.type] = (byType[r.type]||0) + 1);
    const byAgency = {};
    state.enriched.forEach(r => byAgency[r.agency] = (byAgency[r.agency]||0) + 1);
    const years = state.enriched.filter(r => r.date_parsed?.year).map(r => r.date_parsed.year);
    const minY = Math.min(...years), maxY = Math.max(...years);
    const locations = new Set(); state.enriched.forEach(r => { if (r.incident_location && r.incident_location !== 'N/A') locations.add(r.incident_location); });

    const bullets = [
      `<strong>${total} declassified records</strong> in PURSUE Release 01 (May 8, 2026): ${byType.PDF} documents, ${byType.VID} videos, ${byType.IMG} photographs.`,
      `Agencies: ${Object.entries(byAgency).sort((a,b) => b[1]-a[1]).map(([a,c]) => `${fmtAgency(a)} (${c})`).join(', ')}.`,
      `Incident dates span <strong>${minY}–${maxY}</strong> — from World War II "foo-fighter" reports to October 2025 FBI photographs.`,
      `Geocoded across <strong>${locations.size}</strong> distinct locations, with the heaviest clustering in the CENTCOM AOR (Iraq, Syria, Arabian Gulf, Strait of Hormuz) and Apollo-era lunar / low-Earth orbit cases.`,
      `Headline cases: Gemini 7 (1965, Frank Borman), Apollo 11 / 12 / 17 transcripts and onboard photography, FBI file 62-HQ-83894 (1947 onward), and the 2020–2025 CENTCOM Mission Reports under "Range Fouler" disposition.`,
    ];
    let html = `<strong>PURSUE Release 01 — overview</strong><ul>${bullets.map(b => `<li style="margin-bottom:6px">${b}</li>`).join('')}</ul>`;
    const ext = externalContextFor('pursue trump hegseth');
    if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
    return html;
  }

  /* --- Year/Month bucket --- */
  function timeBucketAnswer(q, win) {
    const items = state.enriched.filter(r => {
      if (!r.date_parsed) return false;
      if (win.year && r.date_parsed.year !== win.year) return false;
      if (win.month && r.date_parsed.month !== win.month) return false;
      return true;
    });
    if (!items.length) return null;
    const monthName = win.month ? MONTH_NAMES[win.month-1].replace(/^./, c=>c.toUpperCase()) : '';
    const label = win.month && win.year ? `${monthName} ${win.year}` : (win.year ? String(win.year) : monthName);
    let html = `<strong>${escapeHtml(label)}</strong> — ${items.length} declassified record${items.length===1?'':'s'}.`;
    html += `<ul>` + items.slice(0, 12).map(r => {
      const ag = AGENCIES[r.agency];
      const date = r.incident_date && r.incident_date !== 'N/A' ? r.incident_date : 'date redacted';
      const brief = (r.description || '').split(/[\n.]/)[0].slice(0, 140);
      return `<li style="margin-bottom:6px"><span class="source" data-rid="${r.id}">${r.id.toUpperCase()}</span> <em style="color:${ag.color}">${ag.short}</em> · <strong>${escapeHtml(fmtTitle(r.title))}</strong> · ${escapeHtml(date)}<br><span style="font-size:12px;color:#3c4043">${escapeHtml(brief)}…</span></li>`;
    }).join('') + (items.length > 12 ? `<li>+ ${items.length - 12} more</li>` : '') + `</ul>`;
    const ext = externalContextFor(q);
    if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
    return html;
  }

  /* --- Witness profile --- */
  function witnessAnswer(name, q) {
    const info = state.witnesses[name];
    const ids = (state.witnessRecords[name] || []);
    let html = `<strong>${escapeHtml(name)}</strong> — <em>${escapeHtml(info.title || '')}</em><br>${escapeHtml(info.role || '')}`;
    if (ids.length) {
      html += `<br><span class="grounding-label">Records mentioning ${escapeHtml(name)} (${ids.length})</span><div>`;
      ids.slice(0, 12).forEach(id => {
        const r = state.byId[id];
        html += `<span class="source" data-rid="${r.id}">${r.id.toUpperCase()} · ${escapeHtml(fmtTitle(r.title)).slice(0,80)}</span>`;
      });
      html += `</div>`;
    }
    const ext = externalContextFor(q + ' ' + name);
    if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
    return html;
  }

  /* --- Single record deep dive --- */
  function recordAnswer(r, q) {
    const ag = AGENCIES[r.agency];
    let html = `<strong>${escapeHtml(fmtTitle(r.title))}</strong> · <em style="color:${ag.color}">${escapeHtml(ag.short)}</em>`;
    const meta = [];
    if (r.incident_date && r.incident_date !== 'N/A') meta.push(`Date: ${escapeHtml(r.incident_date)}`);
    if (r.incident_location && r.incident_location !== 'N/A') meta.push(`Location: ${escapeHtml(r.incident_location)}`);
    if (r.witnesses && r.witnesses.length) meta.push(`Witnesses: ${r.witnesses.join(', ')}`);
    if (meta.length) html += `<br><small style="color:#5f6368">${meta.join(' · ')}</small>`;
    if (r.description) {
      const summary = r.description.split(/\n\n/).slice(0, 2).join('\n\n').slice(0, 800);
      html += `<br><br>${escapeHtml(summary)}${r.description.length > 800 ? '…' : ''}`;
    }
    if (r.pdf_snippet) {
      html += `<br><span class="grounding-label">From the PDF</span><div style="font-family:'Space Mono',monospace;font-size:12px;line-height:1.55;color:#3c4043;background:#fafafa;padding:8px;border-radius:6px;white-space:pre-wrap">${escapeHtml(r.pdf_snippet.slice(0, 900))}${r.pdf_snippet.length > 900 ? '…' : ''}</div>`;
    }
    html += `<div style="margin-top:8px"><span class="source" data-rid="${r.id}">Open ${r.id.toUpperCase()} →</span></div>`;
    const ext = externalContextFor(q + ' ' + r.title + ' ' + (r.witnesses||[]).join(' '));
    if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
    return html;
  }

  /* --- Location list --- */
  function locationAnswer(loc, q) {
    const records = state.enriched.filter(r => r.incident_location === loc);
    let html = `<strong>${escapeHtml(loc)}</strong> — ${records.length} declassified record${records.length===1?'':'s'} are filed under this location.`;
    html += `<ul>`;
    records.slice(0, 10).forEach(r => {
      const date = r.incident_date && r.incident_date !== 'N/A' ? r.incident_date : 'date redacted';
      const ag = AGENCIES[r.agency];
      html += `<li><span class="source" data-rid="${r.id}">${r.id.toUpperCase()}</span> · <strong>${escapeHtml(fmtTitle(r.title))}</strong> · <em>${escapeHtml(date)}</em> <span style="color:${ag.color}">· ${ag.short}</span></li>`;
    });
    if (records.length > 10) html += `<li>+ ${records.length - 10} more</li>`;
    html += `</ul>`;
    const ext = externalContextFor(q + ' ' + loc);
    if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
    return html;
  }

  /* --- Agency / type collection --- */
  function collectionAnswer(filters, q) {
    let items = state.enriched;
    if (filters.agency) items = items.filter(r => r.agency === filters.agency);
    if (filters.type) items = items.filter(r => r.type === filters.type);
    if (filters.year) items = items.filter(r => r.date_parsed?.year === filters.year);
    if (filters.unresolved) items = items.filter(r => /unresolved|unidentified|unknown|did not resolve|not resolved/i.test(r.description||''));
    if (!items.length) return null;
    const tag = [filters.agency, filters.type === 'PDF' ? 'documents' : filters.type === 'VID' ? 'videos' : filters.type === 'IMG' ? 'photographs' : null, filters.year].filter(Boolean).join(' ');
    let html = `<strong>${items.length} ${escapeHtml(tag || 'records')}</strong> match this query.`;
    html += `<ul>` + items.slice(0, 12).map(r => {
      const ag = AGENCIES[r.agency];
      const date = r.incident_date && r.incident_date !== 'N/A' ? r.incident_date : (r.date_parsed?.label || 'released ' + fmtRelDate(r.release_date));
      const brief = (r.description || '').split(/[\n.]/)[0].slice(0, 130);
      return `<li style="margin-bottom:6px"><span class="source" data-rid="${r.id}">${r.id.toUpperCase()}</span> <em style="color:${ag.color}">${ag.short}</em> · <strong>${escapeHtml(fmtTitle(r.title))}</strong> · ${escapeHtml(date)}<br><span style="font-size:12px;color:#3c4043">${escapeHtml(brief)}…</span></li>`;
    }).join('') + (items.length > 12 ? `<li>+ ${items.length - 12} more</li>` : '') + `</ul>`;
    const ext = externalContextFor(q);
    if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
    return html;
  }

  /* --- Count answer --- */
  function countAnswer(q) {
    const ag = detectAgency(q);
    const ty = detectType(q);
    const win = parseTimeWindow(q);
    const loc = detectLocation(q);
    let items = state.enriched;
    if (ag) items = items.filter(r => r.agency === ag);
    if (ty) items = items.filter(r => r.type === ty);
    if (win.year) items = items.filter(r => r.date_parsed?.year === win.year);
    if (win.month) items = items.filter(r => r.date_parsed?.month === win.month);
    if (loc) items = items.filter(r => r.incident_location === loc);
    const labels = [ag && fmtAgency(ag), ty === 'PDF'?'documents':ty === 'VID'?'videos':ty === 'IMG'?'photographs':null, win.year, loc].filter(Boolean).join(' ');
    let html = `<strong>${items.length}</strong> record${items.length===1?'':'s'} match "${escapeHtml(labels || 'the requested filter')}".`;
    if (items.length) {
      html += ` Click any code below to open it.<ul>` + items.slice(0, 8).map(r => {
        const a = AGENCIES[r.agency];
        return `<li><span class="source" data-rid="${r.id}">${r.id.toUpperCase()}</span> · <strong>${escapeHtml(fmtTitle(r.title))}</strong> · <em style="color:${a.color}">${a.short}</em></li>`;
      }).join('') + (items.length > 8 ? `<li>+ ${items.length - 8} more</li>` : '') + `</ul>`;
    }
    return html;
  }

  /* --- Most recent --- */
  function mostRecentAnswer(q) {
    const items = state.enriched.filter(r => r.date_parsed?.year)
      .sort((a,b) => {
        const da = new Date(a.date_parsed.year, (a.date_parsed.month||1)-1, a.date_parsed.day||1);
        const db = new Date(b.date_parsed.year, (b.date_parsed.month||1)-1, b.date_parsed.day||1);
        return db - da;
      });
    if (!items.length) return null;
    const r = items[0];
    let html = `The most recent dated UAP sighting in this release is <strong>${escapeHtml(fmtTitle(r.title))}</strong> on <strong>${escapeHtml(r.date_parsed.label)}</strong>${r.incident_location && r.incident_location !== 'N/A' ? ` in <strong>${escapeHtml(r.incident_location)}</strong>` : ''}.<br><br>`;
    html += escapeHtml((r.description||'').slice(0, 500));
    html += `<div style="margin-top:8px"><span class="source" data-rid="${r.id}">Open ${r.id.toUpperCase()} →</span></div>`;
    return html;
  }

  /* --- Comparison answer --- */
  function comparisonAnswer(q) {
    const lc = q.toLowerCase();
    const subjects = [];
    if (lc.includes('gemini 7') || lc.includes('borman')) subjects.push({label:'Gemini 7 (Borman/Lovell, 1965)', match:'gemini'});
    if (lc.includes('apollo 11') || lc.includes('armstrong')) subjects.push({label:'Apollo 11 (Armstrong/Aldrin/Collins, 1969)', match:'apollo 11'});
    if (lc.includes('apollo 12') || lc.includes('conrad')) subjects.push({label:'Apollo 12 (Conrad/Gordon/Bean, 1969)', match:'apollo 12'});
    if (lc.includes('apollo 17') || lc.includes('cernan')) subjects.push({label:'Apollo 17 (Cernan/Evans/Schmitt, 1972)', match:'apollo 17'});
    if (lc.includes('skylab')) subjects.push({label:'Skylab (1973)', match:'skylab'});
    if (lc.includes('iraq')) subjects.push({label:'Iraq CENTCOM cases', match:'iraq'});
    if (lc.includes('syria')) subjects.push({label:'Syria CENTCOM cases', match:'syria'});
    if (subjects.length < 2) return null;
    let html = `<strong>Comparing ${subjects.map(s=>escapeHtml(s.label)).join(' vs. ')}</strong>`;
    html += `<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">`;
    html += `<tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e8eaed;color:#5f6368">Subject</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e8eaed;color:#5f6368">Records</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e8eaed;color:#5f6368">Notable detail</th></tr>`;
    subjects.forEach(s => {
      const recs = state.enriched.filter(r => (r.title+' '+r.description).toLowerCase().includes(s.match));
      const note = (recs[0]?.description || '').split(/[\n.]/)[0].slice(0, 220);
      html += `<tr><td style="padding:6px 8px;border-bottom:1px solid #f1f3f4"><strong>${escapeHtml(s.label)}</strong></td><td style="padding:6px 8px;border-bottom:1px solid #f1f3f4">${recs.length}</td><td style="padding:6px 8px;border-bottom:1px solid #f1f3f4;color:#3c4043">${escapeHtml(note)}…</td></tr>`;
    });
    html += `</table>`;
    const ext = externalContextFor(q);
    if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
    return html;
  }

  /* --- Generic fallback --- */
  function genericAnswer(q) {
    const results = rank(q).slice(0, 6);
    if (!results.length) {
      const ext = externalContextFor(q);
      if (ext.length) return `Umeni couldn't find a direct reference inside the released files, but here is the relevant outside context:<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
      return `Umeni couldn't find a direct reference to "${escapeHtml(q)}" inside the released files.<br>Try a year (e.g. 2020), a location (e.g. Greece, Iraq), an agency (FBI, NASA, Dept. of War), or a witness (Frank Borman, Apollo 12 Crew).`;
    }
    const terms = tokenize(q);
    let html = `Here is what I found across the released files:<ul>`;
    results.forEach(res => {
      const r = state.byId[res.id];
      const ag = AGENCIES[r.agency];
      const snippet = bestMultiSnippet(res.text, terms) || (r.description || '').slice(0, 240);
      html += `<li style="margin-bottom:8px"><span class="source" data-rid="${r.id}">${r.id.toUpperCase()} · <em style="color:${ag.color}">${ag.short}</em></span> — <strong>${escapeHtml(fmtTitle(r.title))}</strong><br><span style="font-size:12px;color:#3c4043">${escapeHtml(snippet)}</span></li>`;
    });
    html += `</ul><span class="grounding-label">Grounded in ${results.length} record${results.length===1?'':'s'} from the May 8, 2026 release.</span>`;
    const ext = externalContextFor(q);
    if (ext.length) html += `<div class="external">${ext.map(e => '↪ ' + escapeHtml(e)).join('<br>')}</div>`;
    return html;
  }

  /* --- Follow-up suggestions --- */
  function suggestFollowups(q, ctx) {
    const lc = q.toLowerCase();
    const out = [];
    if (ctx.witness) {
      out.push(`Show the PDF excerpt for ${ctx.witness}.`);
      out.push(`What was the official explanation for the ${ctx.witness} sighting?`);
    }
    if (ctx.location) {
      out.push(`How many records are filed under ${ctx.location}?`);
      out.push(`Show me the videos from ${ctx.location}.`);
    }
    if (ctx.year) {
      out.push(`Compare ${ctx.year} sightings to ${ctx.year - 1}.`);
      out.push(`Were any ${ctx.year} sightings flagged unresolved?`);
    }
    if (ctx.record) {
      out.push(`Who else witnessed cases like ${ctx.record.id.toUpperCase()}?`);
      out.push(`Show the original PDF for ${ctx.record.id.toUpperCase()}.`);
    }
    if (!out.length) {
      out.push('Summarise this disclosure release in 5 bullet points.', 'Show me the most recent UAP sighting.', 'Which records mention Frank Borman?');
    }
    return out.slice(0, 3);
  }

  /* --- Composer --- */
  function composeAnswer(query) {
    const q = query.trim();

    // Definitions
    const defAns = isDefinition(q) ? definitionAnswer(q) : null;
    if (defAns) return { html: defAns, ctx: {} };

    // Overviews
    if (isOverview(q)) return { html: overviewAnswer(q), ctx: {} };

    // Most recent
    if (isMostRecent(q)) {
      const ans = mostRecentAnswer(q);
      if (ans) return { html: ans, ctx: {} };
    }

    // Comparison (must run before witness/record so "compare apollo 11 vs gemini 7" wins)
    if (isComparison(q)) {
      const ans = comparisonAnswer(q);
      if (ans) return { html: ans, ctx: {} };
    }

    // Specific record
    const rec = detectRecord(q);
    if (rec) return { html: recordAnswer(rec, q), ctx: {record: rec} };

    // Witness
    const wit = detectWitness(q);
    if (wit) return { html: witnessAnswer(wit, q), ctx: {witness: wit} };

    // Count queries
    if (isCountQuery(q)) return { html: countAnswer(q), ctx: {} };

    // Time window
    const win = parseTimeWindow(q);
    if (win.year || win.month) {
      const ans = timeBucketAnswer(q, win);
      if (ans) return { html: ans, ctx: {year: win.year, month: win.month} };
    }

    // Location only
    const loc = detectLocation(q);
    if (loc) return { html: locationAnswer(loc, q), ctx: {location: loc} };

    // Agency / type collection
    const ag = detectAgency(q);
    const ty = detectType(q);
    if (ag || ty || isMissingExplanation(q)) {
      const ans = collectionAnswer({agency:ag, type:ty, unresolved:isMissingExplanation(q)}, q);
      if (ans) return { html: ans, ctx: {} };
    }

    // Generic
    return { html: genericAnswer(q), ctx: {} };
  }

  /* --- View runner --- */
  function appendBubble(host, role, html) {
    const div = document.createElement('div');
    div.className = `umeni-msg ${role}`;
    div.innerHTML = html;
    host.appendChild(div);
    host.scrollTop = host.scrollHeight;
    div.querySelectorAll('.source').forEach(s => s.addEventListener('click', () => {
      const r = state.byId[s.dataset.rid];
      if (r) openRecord(r._idx);
    }));
    return div;
  }

  function runQuery(query, host) {
    host = host || document.getElementById('umeniMain') || document.getElementById('umeniPanelBody');
    if (!host) return;
    appendBubble(host, 'user', escapeHtml(query));
    const thinking = appendBubble(host, 'bot', '<em style="color:#5f6368">Searching declassified files…</em>');
    setTimeout(() => {
      try {
        const result = composeAnswer(query);
        const followups = suggestFollowups(query, result.ctx);
        let html = result.html;
        if (followups.length) {
          html += `<div class="umeni-followups"><span class="grounding-label" style="display:block;margin-top:10px">Follow up</span>` +
            followups.map(f => `<button class="chip" data-fu="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join('') +
            `</div>`;
        }
        thinking.innerHTML = html;
        thinking.querySelectorAll('.source').forEach(s => s.addEventListener('click', () => {
          const r = state.byId[s.dataset.rid]; if (r) openRecord(r._idx);
        }));
        thinking.querySelectorAll('.umeni-followups .chip').forEach(c => c.addEventListener('click', () => runQuery(c.dataset.fu, host)));
        host.scrollTop = host.scrollHeight;
      } catch (e) {
        console.error(e);
        thinking.innerHTML = `<em style="color:#c5221f">Umeni hit an error: ${escapeHtml(e.message)}</em>`;
      }
    }, 220);
  }

  /* --- Floating panel --- */
  let _panelOpened = false;
  function togglePanel(force) {
    const panel = document.getElementById('umeniPanel');
    const open = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !open;
    if (open && !_panelOpened) {
      _panelOpened = true;
      const host = document.getElementById('umeniPanelBody');
      appendBubble(host, 'bot', `Hi — I'm <strong>Umeni</strong>. Ask me anything about the ${state.enriched.length} declassified UAP records. I read the actual file text + descriptions before answering. Try:<br>• <em>What did Frank Borman report on Gemini 7?</em><br>• <em>How many sightings in 2025?</em><br>• <em>What does PURSUE stand for?</em>`);
    }
  }

  function askFromPanel() {
    const inp = document.getElementById('umeniPanelInput');
    const v = inp.value.trim();
    if (!v) return;
    runQuery(v, document.getElementById('umeniPanelBody'));
    inp.value = '';
  }

  return { runQuery, togglePanel, askFromPanel };
})();

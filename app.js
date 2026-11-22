/* Umail / U-apps :: declassified UAP archive
 * - Loads enriched records, witness profiles, text index
 * - Routes between Umail / UTube / UDrive / UPhotos / UEarth / UCalendar / Umeni
 */

const CONFIG = {
  recipient: 'Donald J. Trump <potus@war.gov>',
  release_url: 'https://www.war.gov/UFO/',
};

const AGENCIES = {
  "CIA": {"short": "CIA", "full": "CIA", "domain": "@cia.gov", "color": "#5f6368", "initials": "CI", "pill": "dow"},
  "Department of Energy": {"short": "Dept. of Energy", "full": "Department of Energy", "domain": "@energy.gov", "color": "#5f6368", "initials": "Do", "pill": "dow"},
  "Office of the Director of National Intelligence": {"short": "ODNI", "full": "Office of the Director of National Intelligence", "domain": "@dni.gov", "color": "#5f6368", "initials": "OD", "pill": "dow"},
  "Local Law Enforcement": {"short": "Local Law Enforcement", "full": "Local Law Enforcement", "domain": "", "color": "#5f6368", "initials": "LL", "pill": "dow"},
  "Executive Office of the President": {"short": "Executive Office", "full": "Executive Office of the President", "domain": "@whitehouse.gov", "color": "#5f6368", "initials": "EO", "pill": "dow"},
  "U.S. Government": {"short": "U.S. Government", "full": "U.S. Government", "domain": "", "color": "#5f6368", "initials": "UG", "pill": "dow"},
  "Intelligence Community Agency": {"short": "Intelligence Community", "full": "Intelligence Community Agency", "domain": "", "color": "#5f6368", "initials": "IC", "pill": "dow"},

  'FBI': { short:'FBI', full:'Federal Bureau of Investigation', domain:'@fbi.gov', color:'#1a73e8', initials:'FB', pill:'fbi' },
  'NASA': { short:'NASA', full:'National Aeronautics and Space Administration', domain:'@nasa.gov', color:'#ea4335', initials:'NA', pill:'nasa' },
  'Department of War': { short:'Dept. of War', full:'United States Department of War', domain:'@war.gov', color:'#34a853', initials:'DW', pill:'dow' },
  'Department of State': { short:'Dept. of State', full:'United States Department of State', domain:'@state.gov', color:'#fbbc04', initials:'DS', pill:'dos' },
};

const APPS = [
  { id:'umail', name:'Umail', tagline:'UAP Inbox', glyph:'M', bg:'linear-gradient(135deg,#ea4335,#c5221f)' },
  { id:'utube', name:'UTube', tagline:'UAP Videos', glyph:'▶', bg:'#ff0033' },
  { id:'udrive', name:'UDrive', tagline:'Documents', glyph:'△', bg:'conic-gradient(#fbbc04 0% 33%,#34a853 33% 66%,#1a73e8 66% 100%)' },
  { id:'uphotos', name:'UPhotos', tagline:'Photographs', glyph:'❋', bg:'conic-gradient(#fbbc04 0 90deg,#34a853 90deg 180deg,#1a73e8 180deg 270deg,#ea4335 270deg 360deg)' },
  { id:'uearth', name:'UEarth', tagline:'Sighting map', glyph:'🌎', bg:'radial-gradient(circle at 30% 30%,#34a853,#1a73e8 80%)' },
  { id:'ucalendar', name:'UCalendar', tagline:'Disclosure timeline', glyph:'26', bg:'#1a73e8' },
  { id:'usearch', name:'USearch', tagline:'Full-text search', glyph:'⌕', bg:'#202124' },
  { id:'umeni', name:'Umeni', tagline:'AI assistant', glyph:'✦', bg:'linear-gradient(135deg,#9334e9,#1a73e8 60%,#34a853 100%)' },
];

const state = {
  records: [],
  enriched: [],
  witnesses: {},        // map name -> info
  textIndex: [],        // [{id, text}]
  filtered: [],
  selectedRelease: 0,
  selectedFolder: 'inbox',
  selectedAgency: null,
  selectedType: null,
  selectedTab: 'all',
  selectedWitness: null,
  selectedView: 'umail',
  search: '',
  starred: new Set(JSON.parse(localStorage.getItem('uap_starred') || '[]')),
  read: new Set(JSON.parse(localStorage.getItem('uap_read') || '[]')),
  sortBy: 'date',
  sortDir: 'asc',
  modalIndex: -1,
};

/* ----------------------- Init ----------------------- */
async function init() {
  try {
    const [recRes, enRes, witRes, txtRes, imgRes, cmtRes, pgRes, laterRes] = await Promise.all([
      fetch('data/records.json'),
      fetch('data/enriched.json'),
      fetch('data/witnesses.json'),
      fetch('data/text_index.json'),
      fetch('data/pdf_images.json').catch(() => null),
      fetch('data/comments_seed.json').catch(() => null),
      fetch('data/pdf_pages.json').catch(() => null),
      fetch('data/releases-02-08.json'),
    ]);
    state.records = await recRes.json();
    state.enriched = await enRes.json();
    state.witnesses = await witRes.json();
    state.textIndex = await txtRes.json();
    state.pdfImages = imgRes ? await imgRes.json().catch(()=>[]) : [];
    state.pdfPages = pgRes ? await pgRes.json().catch(()=>[]) : [];
    const later = await laterRes.json();
    state.records.push(...later.records);
    state.enriched.push(...later.records);
    state.pdfPages.push(...later.pages);
    const pageTexts = new Map();
    for (const page of later.pages) {
      if (!pageTexts.has(page.rid)) pageTexts.set(page.rid, []);
      pageTexts.get(page.rid).push(page.text);
    }
    for (const [id, texts] of pageTexts) state.textIndex.push({id, text: texts.join('\n')});
    const seed = cmtRes ? await cmtRes.json().catch(()=>null) : null;
    if (seed && typeof Comments !== 'undefined') Comments.init(seed);
    // index records by id for quick lookup
    state.byId = {};
    state.enriched.forEach((r, i) => {
      r._idx = i;
      r._email = makeEmailFor(r);
      state.byId[r.id] = r;
    });
    // build witness->records mapping
    state.witnessRecords = {};
    state.enriched.forEach(r => (r.witnesses || []).forEach(w => {
      (state.witnessRecords[w] = state.witnessRecords[w] || []).push(r.id);
    }));
    state.filtered = state.enriched.slice();

    renderAppsPop();
    renderAgencyList();
    renderWitnessList();
    setNavCounts();
    bindGlobalEvents();
    routeTo('umail', false);

    setTimeout(() => {
      document.querySelector('.app-shell').hidden = false;
      document.getElementById('loading-screen').classList.add('hide');
      setTimeout(() => document.getElementById('loading-screen').remove(), 400);
    }, 300);

    // honor #hash on load (e.g. #r042 or #app=utube)
    const hash = location.hash.slice(1);
    if (hash.startsWith('app=')) {
      routeTo(hash.slice(4), false);
    } else if (hash && state.byId[hash]) {
      openRecord(state.byId[hash]._idx);
    }
  } catch (e) {
    console.error('init error', e);
    document.getElementById('loading-screen').innerHTML =
      '<p style="color:#c5221f;font-family:Roboto;padding:40px">Failed to decrypt records.<br>Check the console.</p>';
  }
}

/* ----------------------- Helpers ----------------------- */
function sourceVideo(r) {
  if (/^\d+$/.test(r.dvids_id || '')) return `<iframe class="video-player" title="${escapeHtml(r.title)}" src="https://www.dvidshub.net/video/embed/${r.dvids_id}" allowfullscreen></iframe>`;
  return r.asset_url ? `<a href="${escapeHtml(r.asset_url)}" target="_blank" rel="noreferrer">Open official video record</a>` : 'Video unavailable.';
}
function makeEmailFor(r) {
  const ag = AGENCIES[r.agency] || AGENCIES['Department of War'];
  const base = (r.title.split(/[_\s]+/)[0] || 'records').toLowerCase().slice(0, 12);
  const slug = base.replace(/[^a-z0-9]/g, '');
  return `${slug || 'records'}.uap${ag.domain}`;
}
function fmtTitle(t) {
  return t.replace(/_/g, ' ').replace(/-/g, '\u2011').replace(/\s+/g, ' ').trim();
}
function fmtRelDate(d) {
  if (!d) return '';
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[Number(m[1]) - 1]} ${m[2]}`;
}
function fmtTime(rec) {
  const seed = rec._idx;
  const h = (8 + (seed * 13) % 12);
  const mm = (seed * 7) % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12 + 1);
  return `${fmtRelDate(rec.release_date)}, ${hh}:${String(mm).padStart(2,'0')} ${ampm}`;
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const safe = escapeHtml(text);
  const needle = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(needle, 'gi'), m => `<mark class="search-hit">${m}</mark>`);
}
function fileNameFromUrl(u) {
  if (!u) return '';
  try { return decodeURIComponent(u.split('/').pop().split('?')[0]); }
  catch { return u; }
}
function witnessInitials(name) {
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
}
function witnessColor(name) {
  // Stable hashed color
  let h = 0;
  for (let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) & 0xffffff;
  const palette = ['#ea4335','#fbbc04','#34a853','#1a73e8','#9334e9','#ff6f00','#00897b','#3949ab'];
  return palette[Math.abs(h) % palette.length];
}

/* ----------------------- Navigation counts ----------------------- */
function setNavCounts() {
  const total = state.enriched.length;
  document.getElementById('cnt-inbox').textContent = total;
  document.getElementById('cnt-att').textContent = total;
  document.getElementById('cnt-pdf').textContent = state.enriched.filter(r => r.type==='PDF').length;
  document.getElementById('cnt-vid').textContent = state.enriched.filter(r => r.type==='VID').length;
  document.getElementById('cnt-img').textContent = state.enriched.filter(r => r.type==='IMG').length;
  document.getElementById('cnt-starred').textContent = state.starred.size || 0;
}

/* ----------------------- Sidebar agency list ----------------------- */
function renderAgencyList() {
  const ul = document.getElementById('agencyList');
  const counts = {};
  state.enriched.forEach(r => { counts[r.agency] = (counts[r.agency] || 0) + 1; });
  ul.innerHTML = '';
  Object.entries(AGENCIES).forEach(([key, info]) => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.dataset.agency = key;
    li.innerHTML = `
      <span class="agency-pill ${info.pill}"></span>
      <span class="nav-label">${info.short}</span>
      <span class="nav-count">${counts[key] || 0}</span>
    `;
    li.addEventListener('click', () => selectAgency(key));
    ul.appendChild(li);
  });
}

/* ----------------------- Sidebar witnesses ----------------------- */
function renderWitnessList() {
  const ul = document.getElementById('witnessList');
  ul.innerHTML = '';
  Object.entries(state.witnesses).forEach(([name, info]) => {
    const count = (state.witnessRecords[name] || []).length;
    const li = document.createElement('li');
    li.className = 'nav-item witness-item';
    li.dataset.witness = name;
    li.title = info.title;
    li.innerHTML = `
      <span class="witness-icon" style="background:${witnessColor(name)}">${witnessInitials(name)}</span>
      <span class="nav-label">${escapeHtml(name)}</span>
      <span class="nav-count">${count}</span>
    `;
    li.addEventListener('click', () => openWitness(name));
    ul.appendChild(li);
  });
}

/* ----------------------- Apps popover ----------------------- */
function renderAppsPop() {
  const pop = document.getElementById('appsPop');
  pop.innerHTML = APPS.map(a => `
    <div class="pop-item" data-app="${a.id}">
      <span class="pop-glyph" style="background:${a.bg}">${a.glyph}</span>
      <span class="pop-name">${a.name}</span>
    </div>
  `).join('');
  pop.querySelectorAll('.pop-item').forEach(it => {
    it.addEventListener('click', () => { routeTo(it.dataset.app); pop.hidden = true; });
  });
}

/* ----------------------- Filters ----------------------- */
function applyFilters() {
  const q = state.search.toLowerCase();
  state.filtered = state.enriched.filter(r => {
    if (state.selectedRelease && (r.release || 1) !== state.selectedRelease) return false;
    if (state.selectedFolder === 'starred' && !state.starred.has(r.id)) return false;
    if (state.selectedAgency && r.agency !== state.selectedAgency) return false;
    if (state.selectedType && r.type !== state.selectedType) return false;
    if (state.selectedTab !== 'all' && r.type !== state.selectedTab) return false;
    if (state.selectedWitness && !(r.witnesses || []).includes(state.selectedWitness)) return false;
    if (q) {
      const hay = (r.title + ' ' + r.description + ' ' + r.agency + ' ' +
                   (r.incident_location || '') + ' ' + (r.video_title || '') + ' ' +
                   (r.witnesses || []).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (state.sortBy === 'title') {
    state.filtered.sort((a,b) => fmtTitle(a.title).localeCompare(fmtTitle(b.title)));
  } else if (state.sortBy === 'agency') {
    state.filtered.sort((a,b) => (a.agency||'').localeCompare(b.agency||'') || a._idx - b._idx);
  } else {
    state.filtered.sort((a,b) => a._idx - b._idx);
  }
  if (state.sortDir === 'desc') state.filtered.reverse();
  if (typeof renderInbox === 'function' && state.selectedView === 'umail') renderInbox();
  if (state.selectedView === 'udrive') Views.udrive.render();
  if (state.selectedView === 'utube') Views.utube.render();
  if (state.selectedView === 'uphotos') Views.uphotos.render();
}

/* ----------------------- Folder / agency / type / witness ----------------------- */
function clearActive() {
  document.querySelectorAll('.app-sidebar .nav-item').forEach(li => li.classList.remove('active'));
}
function selectFolder(folder) {
  state.selectedFolder = folder;
  state.selectedAgency = null;
  state.selectedType = null;
  state.selectedWitness = null;
  clearActive();
  const el = document.querySelector(`.nav-item[data-folder="${folder}"]`);
  if (el) el.classList.add('active');
  routeTo('umail');
  applyFilters();
}
function selectAgency(name) {
  state.selectedFolder = 'inbox';
  state.selectedAgency = name;
  state.selectedType = null;
  state.selectedWitness = null;
  clearActive();
  document.querySelectorAll(`.nav-item[data-agency="${CSS.escape(name)}"]`).forEach(li => li.classList.add('active'));
  if (state.selectedView !== 'umail') routeTo('umail');
  applyFilters();
}
function selectType(t) {
  state.selectedFolder = 'inbox';
  state.selectedAgency = null;
  state.selectedType = t;
  state.selectedWitness = null;
  clearActive();
  document.querySelectorAll(`.type-item[data-type="${t}"]`).forEach(li => li.classList.add('active'));
  if (state.selectedView !== 'umail') routeTo('umail');
  applyFilters();
}
function selectTab(tab) {
  state.selectedTab = tab;
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  const el = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (el) el.classList.add('active');
  applyFilters();
}
function selectWitnessFilter(name) {
  state.selectedFolder = 'inbox';
  state.selectedAgency = null;
  state.selectedType = null;
  state.selectedWitness = name;
  clearActive();
  document.querySelectorAll(`.witness-item[data-witness="${CSS.escape(name)}"]`).forEach(li => li.classList.add('active'));
  if (state.selectedView !== 'umail') routeTo('umail');
  applyFilters();
}

/* ----------------------- Witness modal ----------------------- */
function openWitness(name) {
  const info = state.witnesses[name];
  if (!info) return;
  document.getElementById('witnessName').textContent = name;
  document.getElementById('witnessTitle').textContent = info.title || '';
  document.getElementById('witnessRole').textContent = info.role || '';
  const av = document.getElementById('witnessAvatar');
  av.style.background = witnessColor(name);
  av.textContent = witnessInitials(name);
  const ids = state.witnessRecords[name] || [];
  document.getElementById('witnessCount').textContent = ids.length;
  const ul = document.getElementById('witnessRecords');
  ul.innerHTML = ids.length ? ids.map(id => {
    const r = state.byId[id];
    const ag = AGENCIES[r.agency] || AGENCIES['Department of War'];
    const tagClass = r.type==='PDF'?'tag-pdf':r.type==='VID'?'tag-vid':'tag-img';
    const tagLabel = r.type==='PDF'?'PDF':r.type==='VID'?'VIDEO':'IMG';
    return `<li data-id="${r.id}">
      <span class="row-tag ${tagClass}">${tagLabel}</span>
      <span class="row-title">${escapeHtml(fmtTitle(r.title))}</span>
      <span class="row-meta">${escapeHtml(ag.short)} · ${escapeHtml(r.incident_location || 'Unknown')}</span>
    </li>`;
  }).join('') : `<li><span class="row-meta">No matching records.</span></li>`;
  ul.querySelectorAll('li[data-id]').forEach(li => {
    li.addEventListener('click', () => {
      const r = state.byId[li.dataset.id];
      closeWitness();
      openRecord(r._idx);
    });
  });
  // Add filter button
  document.getElementById('witnessModal').dataset.witness = name;
  document.getElementById('witnessModal').hidden = false;
}
function closeWitness() {
  document.getElementById('witnessModal').hidden = true;
}

/* ----------------------- Record modal ----------------------- */
function openRecord(idx) {
  const r = state.enriched[idx];
  if (!r) return;
  state.modalIndex = idx;
  markRead(r.id);
  renderModal(r);
  const modal = document.getElementById('recordModal');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  history.replaceState(null, '', `#${r.id}`);
}
function closeRecord() {
  document.getElementById('recordModal').hidden = true;
  document.body.style.overflow = '';
  const v = document.querySelector('#modalAttachment video');
  if (v) v.pause();
  history.replaceState(null, '', window.location.pathname);
}
function navModal(delta) {
  const list = state.filtered.length ? state.filtered : state.enriched;
  if (!list.length) return;
  const visibleIds = list.map(r => r._idx);
  let pos = visibleIds.indexOf(state.modalIndex);
  if (pos === -1) {
    const next = Math.max(0, Math.min(state.enriched.length - 1, state.modalIndex + delta));
    openRecord(next);
    return;
  }
  pos = (pos + delta + visibleIds.length) % visibleIds.length;
  openRecord(visibleIds[pos]);
}

function renderModal(r) {
  const ag = AGENCIES[r.agency] || AGENCIES['Department of War'];
  const tagClass = r.type === 'PDF' ? 'tag-pdf' : r.type === 'VID' ? 'tag-vid' : 'tag-img';
  const tagLabel = r.type === 'PDF' ? 'Document' : r.type === 'VID' ? 'Video' : 'Photograph';
  document.getElementById('modalSubject').innerHTML = highlight(fmtTitle(r.title), state.search);
  const tagEl = document.getElementById('modalTag');
  tagEl.className = 'record-tag ' + tagClass;
  tagEl.textContent = tagLabel;

  const senderAvatar = document.getElementById('modalSenderAvatar');
  senderAvatar.style.background = ag.color;
  senderAvatar.textContent = ag.initials;
  document.getElementById('modalSender').textContent = ag.full;
  document.getElementById('modalSenderEmail').textContent = `<${r._email}>`;
  document.getElementById('modalRecipient').textContent = CONFIG.recipient;
  // sender time uses release date
  const senderTime = document.querySelector('#recordModal .sender-time');
  if (senderTime) senderTime.id = 'modalTime';
  document.getElementById('modalTime') && (document.getElementById('modalTime').textContent = fmtTime(r));

  // incident card
  const incidentCard = document.getElementById('modalIncidentCard');
  const bits = [];
  if (r.incident_date && r.incident_date !== 'N/A') bits.push(`<span><strong>Incident date:</strong> ${escapeHtml(r.incident_date)}</span>`);
  if (r.incident_location && r.incident_location !== 'N/A') bits.push(`<span><strong>Location:</strong> ${escapeHtml(r.incident_location)}</span>`);
  if (r.witnesses && r.witnesses.length) bits.push(`<span><strong>Witnesses:</strong> ${r.witnesses.length}</span>`);
  if (bits.length) {
    document.getElementById('modalIncident').innerHTML = bits.join('');
    incidentCard.hidden = false;
  } else { incidentCard.hidden = true; }

  document.getElementById('modalDescription').textContent = r.description || (r.video_title ? r.video_title + '.' : '');
  document.getElementById('modalAttachment').innerHTML = renderAttachment(r);

  // witnesses
  const wHtml = (r.witnesses || []).map(w => `
    <span class="witness-chip" data-witness="${escapeHtml(w)}">
      <span class="witness-icon" style="background:${witnessColor(w)}">${witnessInitials(w)}</span>${escapeHtml(w)}
    </span>`).join('');
  document.getElementById('modalWitnesses').innerHTML = wHtml ?
    `<h5 style="margin:14px 0 6px;font-family:'Google Sans';font-size:12px;color:#5f6368;letter-spacing:.4px;text-transform:uppercase">Witnesses</h5>
     <div class="witness-chip-row">${wHtml}</div>` : '';
  document.querySelectorAll('#modalWitnesses .witness-chip').forEach(ch => {
    ch.addEventListener('click', () => openWitness(ch.dataset.witness));
  });

  // pdf snippet
  const snip = document.getElementById('modalSnippet');
  if (r.type === 'PDF' && r.pdf_snippet) {
    snip.hidden = false;
    snip.innerHTML = `<h5>Excerpt extracted from PDF</h5>${escapeHtml(r.pdf_snippet)}`;
  } else { snip.hidden = true; snip.innerHTML = ''; }

  document.getElementById('modalSignoff').innerHTML =
    `Sincerely,<br>${ag.full}<br>` +
    `<span style="font-family:'Space Mono',monospace;font-size:12px;color:#5f6368">` +
    `Released ${fmtRelDate(r.release_date)} · Record ID ${r.id.toUpperCase()} · UAP/${'Release_' + String(r.release || 1).padStart(2, '0')}</span>`;

  const starBtn = document.getElementById('modalStar');
  starBtn.querySelector('i').textContent = state.starred.has(r.id) ? 'star' : 'star_border';
  starBtn.onclick = () => { toggleStar(r.id); starBtn.querySelector('i').textContent = state.starred.has(r.id) ? 'star' : 'star_border'; };

  document.getElementById('modalIndex').textContent =
    `${(state.filtered.findIndex(x => x._idx === r._idx) + 1) || (r._idx+1)} of ${(state.filtered.length || state.enriched.length)}`;
}

function renderAttachment(r) {
  const head = (icon, name, meta, dl) => `
    <div class="attachment-head">
      <div class="attachment-icon ${icon}"><i class="material-icons">${icon==='pdf'?'picture_as_pdf':icon==='vid'?'play_arrow':'image'}</i></div>
      <div class="attachment-info">
        <div class="attachment-name">${escapeHtml(name)}</div>
        <div class="attachment-meta">${escapeHtml(meta)}</div>
      </div>
      <div class="attachment-actions">
        ${dl ? `<a class="attachment-action" href="${escapeHtml(dl)}" target="_blank" rel="noreferrer"><i class="material-icons">open_in_new</i>Open</a>` : ''}
        ${dl ? `<a class="attachment-action" href="${escapeHtml(dl)}" download target="_blank" rel="noreferrer"><i class="material-icons">file_download</i>Download</a>` : ''}
      </div>
    </div>`;
  if (r.type === 'PDF') {
    const url = r.asset_url;
    return head('pdf', fileNameFromUrl(url), `PDF · war.gov · Release ${String(r.release || 1).padStart(2, "0")}`, url) +
      `<div class="attachment-body">
        <iframe class="pdf-frame" src="${escapeHtml(url)}#toolbar=1&view=FitH" title="${escapeHtml(r.title)}"></iframe>
      </div>`;
  }
  if (r.type === 'VID') {
    const url = r.video_url || '';
    const poster = r.poster_url || r.thumbnail_local || r.thumbnail_url || '';
    const meta = `Video · ${r.duration ? Math.round(r.duration) + 's' : 'mp4'} · DVIDS ${r.dvids_id || ''}`;
    return head('vid', r.video_title || fileNameFromUrl(url), meta, url) +
      `<div class="attachment-body">
        ${url ? `<video class="video-player" controls preload="metadata" poster="${escapeHtml(poster)}">
          <source src="${escapeHtml(url)}" type="video/mp4">
          Your browser does not support video playback.
        </video>` : sourceVideo(r)}
        ${r.dvids_url ? `<p style="font-size:12px;color:#5f6368;margin-top:8px">Source: <a href="${escapeHtml(r.dvids_url)}" target="_blank" rel="noreferrer">DVIDS</a></p>` : ''}
      </div>`;
  }
  if (r.type === 'IMG') {
    const url = r.asset_url;
    return head('img', fileNameFromUrl(url), `Photograph · war.gov`, url) +
      `<div class="attachment-body image-attachment">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(r.title)}" />
      </div>`;
  }
  return '';
}

/* ----------------------- Star / Read state ----------------------- */
function toggleStar(id) {
  if (state.starred.has(id)) state.starred.delete(id); else state.starred.add(id);
  localStorage.setItem('uap_starred', JSON.stringify([...state.starred]));
  document.getElementById('cnt-starred').textContent = state.starred.size || 0;
  if (state.selectedFolder === 'starred') applyFilters();
  // update row star icon
  const star = document.querySelector(`.email-row[data-id="${id}"] .row-star`);
  if (star) {
    star.classList.toggle('starred', state.starred.has(id));
    star.querySelector('i').textContent = state.starred.has(id) ? 'star' : 'star_border';
  }
}
function markRead(id) {
  if (!state.read.has(id)) {
    state.read.add(id);
    localStorage.setItem('uap_read', JSON.stringify([...state.read]));
    const row = document.querySelector(`.email-row[data-id="${id}"]`);
    if (row) { row.classList.add('read'); row.classList.remove('unread'); }
  }
}

/* ----------------------- Inbox view ----------------------- */
function renderInbox() {
  const main = document.getElementById('appMain');
  main.classList.remove('bg-flush');
  main.innerHTML = `
    <div class="ai-overview">
      <div class="ai-overview-inner">
        <i class="material-icons ai-icon">auto_awesome</i>
        <span class="ai-title" style="font-family:'Google Sans'">AI Overview</span>
      </div>
      <p class="ai-overview-body">
        You are logged in as <strong>Donald J. Trump</strong> (potus@war.gov). These are
        real UAP records <a href="${CONFIG.release_url}" target="_blank" rel="noreferrer">published in PURSUE Releases 01–08</a>
        as part of the <em>Presidential Unsealing and Reporting System for UAP Encounters (PURSUE)</em>.
        Explore <span>${state.enriched.length}</span> declassified files by name, search, or
        <a href="#" id="randomLink">visit a random page</a>. Use the dock below for
        <a href="#" data-app="utube">UTube</a>, <a href="#" data-app="udrive">UDrive</a>,
        <a href="#" data-app="uphotos">UPhotos</a>, <a href="#" data-app="uearth">UEarth</a>,
        <a href="#" data-app="ucalendar">UCalendar</a>, and <a href="#" data-app="umeni">Umeni</a>. Additional summaries and page transcriptions by <a href="https://uapinsight.com/pursue/data">uapinsight.com</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>).
      </p>
    </div>

    <div class="toolbar">
      <div class="toolbar-left">
        <button class="icon-btn" id="refreshBtn" title="Refresh"><i class="material-icons">refresh</i></button>
        <button class="icon-btn" id="randomBtn" title="Open random record"><i class="material-icons">casino</i></button>
        <label class="toolbar-chip release-chip"><i class="material-icons">folder</i><select id="releaseFilter" aria-label="Filter inbox by release" style="font:inherit;color:inherit;background:transparent;border:0"><option value="0">All releases</option>${Array.from({length:8}, (_, i) => `<option value="${i+1}" ${state.selectedRelease === i+1 ? 'selected' : ''}>Release ${String(i+1).padStart(2,'0')}</option>`).join('')}</select></label>
        <button class="toolbar-chip" id="sortChip"><i class="material-icons">date_range</i><span id="sortLabel">Date</span><i class="material-icons small">arrow_drop_down</i></button>
        ${state.selectedWitness ? `<button class="toolbar-chip" id="clearWitness" style="color:#ea4335"><i class="material-icons">close</i><span>Witness: ${escapeHtml(state.selectedWitness)}</span></button>`:''}
        ${state.selectedAgency ? `<button class="toolbar-chip" id="clearAgency" style="color:#ea4335"><i class="material-icons">close</i><span>Agency: ${escapeHtml(state.selectedAgency)}</span></button>`:''}
      </div>
      <div class="toolbar-right">
        <span class="page-info" id="pageInfo">${state.filtered.length===0?'0 of 0':`1–${state.filtered.length} of ${state.filtered.length}`}</span>
      </div>
    </div>

    <div class="tabs" id="tabs">
      <button class="tab ${state.selectedTab==='all'?'active':''}" data-tab="all"><i class="material-icons">inbox</i><span>Primary</span></button>
      <button class="tab ${state.selectedTab==='VID'?'active':''}" data-tab="VID"><i class="material-icons">label</i><span>Videos</span><span class="tab-count">${state.enriched.filter(r=>r.type==='VID').length}</span></button>
      <button class="tab ${state.selectedTab==='IMG'?'active':''}" data-tab="IMG"><i class="material-icons">image</i><span>Photos</span><span class="tab-count">${state.enriched.filter(r=>r.type==='IMG').length}</span></button>
      <button class="tab ${state.selectedTab==='PDF'?'active':''}" data-tab="PDF"><i class="material-icons">description</i><span>Documents</span><span class="tab-count">${state.enriched.filter(r=>r.type==='PDF').length}</span></button>
    </div>

    <div class="email-list" id="emailList"></div>

    <footer class="page-footer">
      <span>Terms · Privacy · Program Policies</span>
      <span>Last account activity: <strong>just now</strong> (38°52′15″N, 77°03′18″W)</span>
    </footer>
  `;

  // Bindings
  const list = document.getElementById('emailList');
  if (!state.filtered.length) {
    list.innerHTML = `<div style="padding:40px;text-align:center;color:#5f6368;font-size:14px">
      No records match the current filters.</div>`;
  } else {
    list.innerHTML = state.filtered.map(r => rowHtml(r)).join('');
    list.querySelectorAll('.email-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.row-star')) {
          e.stopPropagation();
          toggleStar(row.dataset.id);
          return;
        }
        if (e.target.closest('.row-check')) return;
        openRecord(Number(row.dataset.idx));
      });
    });
  }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));
  document.getElementById('randomBtn')?.addEventListener('click', () => {
    const list = state.filtered.length ? state.filtered : state.enriched;
    const r = list[Math.floor(Math.random()*list.length)];
    openRecord(r._idx);
  });
  document.getElementById('releaseFilter')?.addEventListener('change', e => { state.selectedRelease = Number(e.target.value); applyFilters(); });
  document.getElementById('refreshBtn')?.addEventListener('click', () => applyFilters());
  document.getElementById('randomLink')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('randomBtn').click();
  });
  document.querySelectorAll('.ai-overview-body a[data-app]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); routeTo(a.dataset.app); });
  });
  document.getElementById('clearWitness')?.addEventListener('click', () => { state.selectedWitness = null; clearActive(); document.querySelector('.nav-item[data-folder="inbox"]').classList.add('active'); applyFilters(); });
  document.getElementById('clearAgency')?.addEventListener('click', () => { state.selectedAgency = null; clearActive(); document.querySelector('.nav-item[data-folder="inbox"]').classList.add('active'); applyFilters(); });
  document.getElementById('sortChip')?.addEventListener('click', () => {
    const sorts = ['date','title','agency'];
    state.sortBy = sorts[(sorts.indexOf(state.sortBy)+1) % sorts.length];
    document.getElementById('sortLabel').textContent = { date:'Date', title:'Title', agency:'Agency' }[state.sortBy];
    applyFilters();
  });
}

function rowHtml(r) {
  const ag = AGENCIES[r.agency] || AGENCIES['Department of War'];
  const isRead = state.read.has(r.id);
  const isStarred = state.starred.has(r.id);
  const tagClass = r.type === 'PDF' ? 'tag-pdf' : r.type === 'VID' ? 'tag-vid' : 'tag-img';
  const tagLabel = r.type === 'PDF' ? 'Document' : r.type === 'VID' ? 'Video' : 'Photo';
  const subjShort = fmtTitle(r.title);
  const previewText = r.description || (r.video_title || '');
  const dateLabel = fmtRelDate(r.release_date);
  const senderName = ag.short;
  const senderEmail = r._email;
  const count = ((r.pdf_pairing && r.pdf_pairing !== '') ? 2 : 1);
  return `
    <div class="email-row ${isRead ? 'read' : 'unread'}" data-id="${r.id}" data-idx="${r._idx}">
      <label class="row-check"><input type="checkbox" /></label>
      <span class="row-star ${isStarred ? 'starred' : ''}" role="button" aria-label="Star">
        <i class="material-icons">${isStarred ? 'star' : 'star_border'}</i>
      </span>
      <span class="row-icon-meta" title="Attachments"><i class="material-icons">attach_file</i>${count}</span>
      <span class="row-icon-meta" title="${escapeHtml(r.agency)}"><span class="agency-pill ${ag.pill}"></span></span>
      <span class="row-sender" title="${escapeHtml(senderName + ' <' + senderEmail + '>')}">${highlight(senderName, state.search)}</span>
      <span class="row-subject-wrap">
        <span class="row-tag ${tagClass}">${tagLabel}</span>
        <span class="row-subject">${highlight(subjShort, state.search)}</span>
        <span class="row-preview"> - ${highlight(previewText, state.search)}</span>
      </span>
      <span class="row-date">${dateLabel}</span>
    </div>`;
}

/* ----------------------- Router ----------------------- */
function routeTo(app, push = true) {
  if (!APPS.find(a => a.id === app)) app = 'umail';
  state.selectedView = app;
  document.querySelectorAll('.dock-item').forEach(d => d.classList.toggle('active', d.dataset.app === app));
  // Update header logo
  const glyphMap = {
    umail:    {bg:'linear-gradient(135deg,#ea4335,#c5221f)', label:'M', word:'Umail'},
    utube:    {bg:'#ff0033', label:'▶', word:'UTube'},
    udrive:   {bg:'conic-gradient(#fbbc04 0% 33%,#34a853 33% 66%,#1a73e8 66% 100%)', label:'△', word:'UDrive'},
    uphotos:  {bg:'conic-gradient(#fbbc04 0 90deg,#34a853 90deg 180deg,#1a73e8 180deg 270deg,#ea4335 270deg 360deg)', label:'❋', word:'UPhotos'},
    uearth:   {bg:'radial-gradient(circle at 30% 30%,#34a853,#1a73e8 80%)', label:'🌎', word:'UEarth'},
    ucalendar:{bg:'#1a73e8', label:'26', word:'UCalendar'},
    usearch:  {bg:'#202124', label:'⌕', word:'USearch'},
    umeni:    {bg:'linear-gradient(135deg,#9334e9,#1a73e8 60%,#34a853 100%)', label:'✦', word:'Umeni'},
  };
  const g = glyphMap[app];
  document.getElementById('logoGlyph').style.background = g.bg;
  document.getElementById('logoGlyph').textContent = g.label;
  document.getElementById('logoWord').textContent = g.word;

  if (push) history.replaceState(null, '', `#app=${app}`);

  if (app === 'umail') applyFilters();
  else if (Views[app]) Views[app].mount();
}

/* ----------------------- Event bindings ----------------------- */
function bindGlobalEvents() {
  // sidebar folders
  document.getElementById('folderList').addEventListener('click', e => {
    const li = e.target.closest('.nav-item');
    if (!li) return;
    selectFolder(li.dataset.folder);
  });
  document.getElementById('typeList').addEventListener('click', e => {
    const li = e.target.closest('.type-item');
    if (!li) return;
    selectType(li.dataset.type);
  });

  // search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', () => {
    state.search = searchInput.value.trim();
    searchClear.hidden = !state.search;
    if (state.selectedView === 'usearch') {
      Views.usearch.q = state.search;
      const f = document.getElementById('usearchInput');
      if (f && f.value !== state.search) f.value = state.search;
      Views.usearch.run();
    } else {
      applyFilters();
    }
  });
  // Pressing Enter / clicking the magnifier → jump to USearch full-text view
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.search) {
      e.preventDefault();
      routeTo('usearch');
    }
  });
  document.querySelector('.header-search .search-icon')?.addEventListener('click', () => {
    if (state.search) routeTo('usearch');
    else searchInput.focus();
  });
  searchClear.addEventListener('click', () => { searchInput.value=''; state.search=''; searchClear.hidden=true; applyFilters(); });

  // Ko-fi support card open/close
  const kofiCard = document.getElementById('kofiCard');
  document.querySelector('.dock-kofi')?.addEventListener('click', (e) => {
    // open the card AND let the link open Ko-fi in new tab
    if (kofiCard) {
      kofiCard.hidden = false;
    }
  });
  document.getElementById('kofiClose')?.addEventListener('click', () => { if (kofiCard) kofiCard.hidden = true; });
  // Auto-show Ko-fi card briefly on first session load (1.4s after init)
  setTimeout(() => {
    if (!localStorage.getItem('kofi_seen')) {
      if (kofiCard) kofiCard.hidden = false;
      localStorage.setItem('kofi_seen', '1');
      setTimeout(() => { if (kofiCard) kofiCard.hidden = true; }, 8000);
    }
  }, 1500);

  // dock (Ko-fi link opens externally; ignore it here)
  document.querySelectorAll('.dock-item').forEach(d => {
    if (d.classList.contains('dock-kofi')) return;
    d.addEventListener('click', () => routeTo(d.dataset.app));
  });

  // apps popover
  document.getElementById('appsBtn').addEventListener('click', e => {
    e.stopPropagation();
    const pop = document.getElementById('appsPop');
    pop.hidden = !pop.hidden;
  });
  document.addEventListener('click', e => {
    const pop = document.getElementById('appsPop');
    if (!pop.contains(e.target) && !e.target.closest('#appsBtn')) pop.hidden = true;
  });

  // header umeni button -> open umeni panel
  document.getElementById('headerUmeniBtn').addEventListener('click', () => {
    if (state.selectedView === 'umeni') {
      // toggle floating panel inside Umeni view
    }
    if (typeof Umeni !== 'undefined') Umeni.togglePanel();
  });
  document.getElementById('umeniPanelClose').addEventListener('click', () => Umeni.togglePanel(false));
  document.getElementById('umeniPanelForm').addEventListener('submit', e => { e.preventDefault(); Umeni.askFromPanel(); });

  // record modal
  document.getElementById('modalClose').addEventListener('click', closeRecord);
  document.getElementById('modalBack').addEventListener('click', closeRecord);
  document.getElementById('modalPrev').addEventListener('click', () => navModal(-1));
  document.getElementById('modalNext').addEventListener('click', () => navModal(1));
  document.getElementById('modalShare').addEventListener('click', async () => {
    const url = location.origin + location.pathname + location.hash;
    try { await navigator.clipboard.writeText(url); alert('Link copied: '+url); } catch(e){ alert(url); }
  });

  // witness modal
  document.getElementById('witnessClose').addEventListener('click', closeWitness);
  // Filter all records by witness shortcut at bottom of witness modal
  document.getElementById('witnessModal').addEventListener('click', e => {
    if (e.target === document.getElementById('witnessModal')) closeWitness();
  });

  // compose
  document.getElementById('composeBtn').addEventListener('click', () => {
    document.getElementById('composeModal').hidden = false;
  });
  document.getElementById('composeClose').addEventListener('click', () => {
    document.getElementById('composeModal').hidden = true;
  });

  // keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('recordModal').hidden) closeRecord();
      else if (!document.getElementById('witnessModal').hidden) closeWitness();
      else if (!document.getElementById('lightbox').hidden) Views.uphotos.closeLightbox();
    }
    if (!document.getElementById('recordModal').hidden) {
      if (e.key === 'ArrowLeft') navModal(-1);
      if (e.key === 'ArrowRight') navModal(1);
    }
  });

  // logo: go home
  document.getElementById('logoWrap').addEventListener('click', e => { e.preventDefault(); routeTo('umail'); });

  // lightbox
  document.getElementById('lightboxClose').addEventListener('click', () => Views.uphotos.closeLightbox());
  document.getElementById('lightboxPrev').addEventListener('click', () => Views.uphotos.lightboxNav(-1));
  document.getElementById('lightboxNext').addEventListener('click', () => Views.uphotos.lightboxNav(1));
}

/* ----------------------- Boot ----------------------- */
window.addEventListener('DOMContentLoaded', init);

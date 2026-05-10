/* views.js — UTube / UDrive / UPhotos / UEarth / UCalendar / Umeni mount points */

const Views = {};

/* ============== UTube ============== */
Views.utube = {
  filter: 'all',
  searchQ: '',
  mount() {
    const main = document.getElementById('appMain');
    main.classList.add('bg-flush');
    main.innerHTML = `
      <div class="utube">
        <div class="utube-header">
          <div class="utube-title">
            <span class="utube-play-glyph"><i class="material-icons">play_arrow</i></span>
            UTube · UAP video archive
          </div>
          <div class="muted" style="color:#aaa">${state.enriched.filter(r=>r.type==='VID').length} declassified videos</div>
        </div>
        <div class="utube-chips" id="utubeChips"></div>
        <div class="utube-grid" id="utubeGrid"></div>
      </div>`;
    this.renderChips();
    this.render();
  },
  renderChips() {
    const chips = document.getElementById('utubeChips');
    if (!chips) return;
    const opts = [
      ['all', 'All'],
      ['CENTCOM', 'CENTCOM'],
      ['INDOPACOM', 'INDOPACOM'],
      ['NASA', 'NASA / Apollo'],
      ['Iraq', 'Iraq'],
      ['Syria', 'Syria'],
      ['Greece', 'Greece'],
      ['Arabian', 'Arabian Gulf'],
      ['UAE', 'UAE'],
      ['recent', 'Recent (2022–2026)'],
    ];
    chips.innerHTML = opts.map(([k,l]) => `<button class="chip ${this.filter===k?'active':''}" data-k="${k}">${l}</button>`).join('');
    chips.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
      this.filter = c.dataset.k;
      chips.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x.dataset.k===this.filter));
      this.render();
    }));
  },
  render() {
    const grid = document.getElementById('utubeGrid');
    if (!grid) return;
    let items = state.enriched.filter(r => r.type === 'VID');
    if (this.filter !== 'all') {
      const f = this.filter;
      items = items.filter(r => {
        const hay = (r.title + ' ' + r.description + ' ' + (r.incident_location||'') + ' ' + (r.video_title||'')).toLowerCase();
        if (f === 'recent') return ['2022','2023','2024','2025','2026'].some(y => (r.incident_date||'').includes(y));
        if (f === 'NASA') return r.agency === 'NASA';
        if (f === 'CENTCOM') return hay.includes('centcom') || hay.includes('iraq') || hay.includes('syria') || hay.includes('arabian') || hay.includes('greece') || hay.includes('uae') || hay.includes('united arab');
        if (f === 'INDOPACOM') return hay.includes('indopacom') || hay.includes('east china') || hay.includes('japan');
        if (f === 'Arabian') return hay.includes('arabian');
        if (f === 'UAE') return hay.includes('united arab') || hay.includes('uae');
        return hay.includes(f.toLowerCase());
      });
    }
    grid.innerHTML = items.length ? items.map(r => this.cardHtml(r)).join('') :
      `<div style="grid-column:1/-1;padding:60px;text-align:center;color:#aaa">No videos match this filter.</div>`;
    grid.querySelectorAll('.vid-card').forEach(c => c.addEventListener('click', () => this.openPlayer(c.dataset.id)));
  },
  cardHtml(r) {
    const ag = AGENCIES[r.agency];
    const title = r.video_title || fmtTitle(r.title);
    const dur = r.duration ? `${Math.floor(r.duration/60)}:${String(Math.round(r.duration%60)).padStart(2,'0')}` : 'mp4';
    const poster = r.poster_url || r.thumbnail_url || r.thumbnail_local || '';
    const dateLabel = (r.incident_date && r.incident_date !== 'N/A') ? r.incident_date : (r.incident_location || 'declassified');
    const views = Comments.viewCount(r.id);
    return `
      <div class="vid-card" data-id="${r.id}">
        <div class="vid-thumb">
          ${poster ? `<img src="${escapeHtml(poster)}" alt="" />` : '<div style="width:100%;height:100%;background:#272727"></div>'}
          <span class="vid-duration">${dur}</span>
        </div>
        <div class="vid-meta">
          <div class="vid-channel" style="background:${ag.color}">${ag.initials}</div>
          <div class="vid-text">
            <div class="vid-title">${escapeHtml(title)}</div>
            <div class="vid-channel-name">${escapeHtml(ag.short)} · UAP archive</div>
            <div class="vid-stats">${views} views · ${escapeHtml(dateLabel)} · Released ${escapeHtml(fmtRelDate(r.release_date))}</div>
          </div>
        </div>
      </div>`;
  },
  openPlayer(id) {
    const r = state.byId[id];
    if (!r) return;
    Players.openYouTube(r);
  }
};

/* ============== YouTube-style player ============== */
const Players = {
  current: null,
  openYouTube(r) {
    // Build full-screen YouTube-style overlay
    if (this.current) this.current.remove();
    const overlay = document.createElement('div');
    overlay.className = 'yt-modal';
    overlay.innerHTML = this.layoutHtml(r);
    document.body.appendChild(overlay);
    this.current = overlay;

    overlay.querySelector('#ytClose').addEventListener('click', () => this.close());
    overlay.querySelector('#ytLike')?.addEventListener('click', e => {
      e.currentTarget.classList.toggle('active');
      const cnt = e.currentTarget.querySelector('.lk-cnt');
      const liked = e.currentTarget.classList.contains('active');
      cnt.textContent = (parseInt(cnt.dataset.base) + (liked?1:0)).toLocaleString();
    });
    overlay.querySelector('#ytSave')?.addEventListener('click', e => e.currentTarget.classList.toggle('active'));
    overlay.querySelector('#ytSubscribe')?.addEventListener('click', e => {
      const btn = e.currentTarget;
      btn.classList.toggle('active');
      btn.textContent = btn.classList.contains('active') ? 'Subscribed' : 'Subscribe';
    });
    overlay.querySelector('#ytShare')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(location.href.split('#')[0] + '#vid=' + r.id);
      const t = overlay.querySelector('#ytShare');
      const orig = t.innerHTML;
      t.innerHTML = '<i class="material-icons">check</i> Copied';
      setTimeout(()=>{ t.innerHTML = orig; }, 1400);
    });
    overlay.querySelector('#ytShowDesc')?.addEventListener('click', e => {
      const el = overlay.querySelector('.yt-desc');
      el.classList.toggle('expanded');
      e.currentTarget.textContent = el.classList.contains('expanded') ? 'Show less' : 'Show more';
    });

    // Comments
    Comments.mount(r, overlay.querySelector('#ytComments'));

    // Related videos
    this.bindRelated(overlay, r);

    // Esc
    this._esc = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._esc);
  },
  layoutHtml(r) {
    const ag = AGENCIES[r.agency];
    const title = r.video_title || fmtTitle(r.title);
    const views = Comments.viewCount(r.id);
    const baseLikes = Comments.likeCount(r.id);
    const dateLabel = (r.incident_date && r.incident_date !== 'N/A') ? r.incident_date : 'date redacted';
    const subs = Comments.subscriberCount(r.agency);
    const desc = (r.description || '').replace(/\n+/g, '<br>');
    const tagsLine = ['#UAP', '#PURSUE', '#'+r.agency.replace(/\s+/g,''), r.incident_location ? '#'+r.incident_location.replace(/\s+/g,'') : ''].filter(Boolean).map(t=>`<span class="yt-tag">${escapeHtml(t)}</span>`).join('');
    const player = r.video_url
      ? `<video controls autoplay playsinline poster="${escapeHtml(r.poster_url || '')}"><source src="${escapeHtml(r.video_url)}" type="video/mp4"></video>`
      : `<div class="yt-no-video"><i class="material-icons">videocam_off</i><div>Video unavailable</div></div>`;
    return `
      <div class="yt-shell">
        <div class="yt-topbar">
          <div class="yt-topbar-left">
            <button class="icon-btn" id="ytClose" title="Back to UTube"><i class="material-icons">arrow_back</i></button>
            <span class="utube-play-glyph"><i class="material-icons">play_arrow</i></span>
            <span class="yt-brand">UTube</span>
          </div>
          <div class="yt-search-wrap">
            <input id="ytSearch" placeholder="Search UTube" />
            <button class="yt-search-btn"><i class="material-icons">search</i></button>
          </div>
          <div class="yt-topbar-right">
            <span class="material-icons" title="Notifications">notifications</span>
            <span class="avatar-circle small" style="background:#9334e9">DT</span>
          </div>
        </div>
        <div class="yt-body">
          <div class="yt-main">
            <div class="yt-player">${player}</div>
            <h1 class="yt-title">${escapeHtml(title)}</h1>
            <div class="yt-channel-row">
              <div class="yt-channel">
                <span class="yt-channel-avatar" style="background:${ag.color}">${ag.initials}</span>
                <div class="yt-channel-info">
                  <div class="yt-channel-name">${escapeHtml(ag.short)} <i class="material-icons" style="font-size:14px;color:#aaa;vertical-align:middle">verified</i></div>
                  <div class="yt-channel-subs">${subs} subscribers</div>
                </div>
                <button class="yt-subscribe" id="ytSubscribe">Subscribe</button>
              </div>
              <div class="yt-actions">
                <button class="yt-action-btn" id="ytLike">
                  <i class="material-icons">thumb_up</i><span class="lk-cnt" data-base="${baseLikes}">${baseLikes.toLocaleString()}</span>
                </button>
                <button class="yt-action-btn" id="ytShare">
                  <i class="material-icons">share</i> Share
                </button>
                <button class="yt-action-btn" id="ytSave">
                  <i class="material-icons">bookmark_add</i> Save
                </button>
                <button class="yt-action-btn">
                  <i class="material-icons">download</i> Download
                </button>
                <button class="yt-action-btn">
                  <i class="material-icons">more_horiz</i>
                </button>
              </div>
            </div>
            <div class="yt-desc">
              <div class="yt-desc-meta">
                <strong>${views} views</strong> · ${escapeHtml(dateLabel)} · Released by Department of War on ${escapeHtml(fmtRelDate(r.release_date))}
              </div>
              <div class="yt-tags">${tagsLine}</div>
              <div class="yt-desc-body">${desc}</div>
              ${r.dvids_url ? `<div class="yt-desc-link"><a href="${escapeHtml(r.dvids_url)}" target="_blank" rel="noreferrer">↪ Open original on DVIDS</a></div>` : ''}
              ${r.asset_url ? `<div class="yt-desc-link"><a href="${escapeHtml(r.asset_url)}" target="_blank" rel="noreferrer">↪ Mission report PDF (war.gov)</a></div>` : ''}
              <button class="yt-show-more" id="ytShowDesc">Show more</button>
            </div>
            <div class="yt-comments-section" id="ytComments"></div>
          </div>
          <aside class="yt-sidebar" id="ytSidebar"></aside>
        </div>
      </div>`;
  },
  bindRelated(overlay, r) {
    const others = state.enriched.filter(x => x.type === 'VID' && x.id !== r.id);
    // Prefer same-region / same-agency
    const same = others.filter(x => x.agency === r.agency || (r.incident_location && x.incident_location === r.incident_location));
    const list = same.concat(others.filter(x => !same.includes(x))).slice(0, 18);
    const html = list.map(x => {
      const ag = AGENCIES[x.agency];
      const title = x.video_title || fmtTitle(x.title);
      const dur = x.duration ? `${Math.floor(x.duration/60)}:${String(Math.round(x.duration%60)).padStart(2,'0')}` : 'mp4';
      const poster = x.poster_url || x.thumbnail_url || x.thumbnail_local || '';
      const v = Comments.viewCount(x.id);
      return `
        <div class="yt-related" data-id="${x.id}">
          <div class="yt-related-thumb">
            ${poster ? `<img src="${escapeHtml(poster)}">` : ''}
            <span class="yt-related-dur">${dur}</span>
          </div>
          <div class="yt-related-meta">
            <div class="yt-related-title">${escapeHtml(title)}</div>
            <div class="yt-related-chan">${escapeHtml(ag.short)}</div>
            <div class="yt-related-stats">${v} views · ${escapeHtml(fmtRelDate(x.release_date))}</div>
          </div>
        </div>`;
    }).join('');
    overlay.querySelector('#ytSidebar').innerHTML = html;
    overlay.querySelectorAll('.yt-related').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.id;
      const next = state.byId[id];
      if (next) this.openYouTube(next);
    }));
  },
  close() {
    if (!this.current) return;
    this.current.querySelector('video')?.pause();
    this.current.remove();
    this.current = null;
    document.removeEventListener('keydown', this._esc);
  }
};

/* ============== Comments engine ============== */
const Comments = {
  seed: null,
  loaded: null,
  init(seed) { this.seed = seed; },
  /* deterministic PRNG from string */
  rng(str) {
    let h = 2166136261;
    for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return () => { h = (h * 1103515245 + 12345) >>> 0; return (h % 1000000) / 1000000; };
  },
  pickTemplate(r) {
    const hay = ((r.title||'') + ' ' + (r.description||'') + ' ' + (r.incident_location||'')).toLowerCase();
    const t = this.seed.templates;
    const buckets = [];
    if (hay.includes('apollo 11')) buckets.push(t.apollo_11);
    if (hay.includes('apollo 12')) buckets.push(t.apollo_12);
    if (hay.includes('apollo 17')) buckets.push(t.apollo_17);
    if (hay.includes('gemini')) buckets.push(t.gemini_7);
    if (hay.includes('skylab')) buckets.push(t.skylab);
    if (hay.includes('moon') || hay.includes('lunar')) buckets.push(t.moon);
    if (hay.includes('iraq')) buckets.push(t.centcom_iraq);
    if (hay.includes('syria')) buckets.push(t.centcom_syria);
    if (hay.includes('united arab') || hay.includes('uae')) buckets.push(t.centcom_uae);
    if (hay.includes('greece') || hay.includes('aegean')) buckets.push(t.centcom_greece);
    if (hay.includes('oman') || hay.includes('hormuz')) buckets.push(t.centcom_oman);
    if (hay.includes('yemen') || hay.includes('aden')) buckets.push(t.centcom_yemen);
    if (r.agency === 'FBI') buckets.push(t.fbi_modern);
    if (hay.includes('centcom')) buckets.push(t.centcom_generic);
    buckets.push(t.general);
    // flatten
    return [].concat(...buckets);
  },
  build(r, count = 18) {
    const seed = `${r.id}|${r.title||''}`;
    const rng = this.rng(seed);
    const names = this.seed.names;
    const templates = this.pickTemplate(r);
    const out = [];
    const used = new Set();
    for (let i=0; i<count; i++) {
      let nameIdx = Math.floor(rng()*names.length);
      let attempts = 0;
      while (used.has(nameIdx) && attempts<20) { nameIdx = Math.floor(rng()*names.length); attempts++; }
      used.add(nameIdx);
      const [name, place, ini, color] = names[nameIdx];
      const text = templates[Math.floor(rng()*templates.length)];
      const likes = Math.floor(rng() * (i===0 ? 12000 : i<3 ? 4500 : 1100)) + (i<3 ? 110 : 8);
      const replies = i<6 ? Math.floor(rng()*9) : 0;
      const daysAgo = Math.floor(rng()*38) + 1;
      out.push({ name, place, ini, color, text, likes, replies, daysAgo });
    }
    return out;
  },
  storageKey(id) { return `umail.utube.comments.${id}`; },
  loadCustom(id) {
    try { return JSON.parse(localStorage.getItem(this.storageKey(id)) || '[]'); }
    catch { return []; }
  },
  saveCustom(id, list) { localStorage.setItem(this.storageKey(id), JSON.stringify(list)); },
  viewCount(id) {
    const rng = this.rng(id+'|views');
    const base = Math.floor(rng() * 9000000) + 80000;
    return base.toLocaleString();
  },
  likeCount(id) {
    const rng = this.rng(id+'|likes');
    return Math.floor(rng() * 280000) + 9000;
  },
  subscriberCount(agency) {
    const map = { 'Department of War':'4.9M', 'NASA':'8.1M', 'FBI':'3.2M', 'Department of State':'1.7M' };
    return map[agency] || '512K';
  },
  ago(d) {
    if (d <= 1) return '1 day ago';
    if (d < 7) return `${d} days ago`;
    if (d < 14) return '1 week ago';
    if (d < 30) return `${Math.floor(d/7)} weeks ago`;
    return '1 month ago';
  },
  mount(r, host) {
    if (!host) return;
    const auto = this.build(r, 22);
    const custom = this.loadCustom(r.id);
    const all = custom.concat(auto);
    host.innerHTML = `
      <div class="yt-cmt-head">
        <span class="yt-cmt-count"><strong>${(all.length+ Math.floor(Math.random()*180+40)).toLocaleString()}</strong> Comments</span>
        <span class="yt-cmt-sort"><i class="material-icons">sort</i> Sort by</span>
      </div>
      <div class="yt-cmt-compose">
        <span class="yt-cmt-avatar" style="background:#9334e9">DT</span>
        <div class="yt-cmt-input-wrap">
          <input id="ytNewComment" placeholder="Add a comment..." />
          <div class="yt-cmt-actions">
            <button class="yt-cmt-cancel" type="button">Cancel</button>
            <button class="yt-cmt-submit primary-btn" type="button">Comment</button>
          </div>
        </div>
      </div>
      <div class="yt-cmt-list" id="ytCmtList"></div>
    `;
    const renderList = () => {
      const list = (this.loadCustom(r.id)).concat(auto);
      host.querySelector('#ytCmtList').innerHTML = list.map(c => `
        <div class="yt-cmt">
          <span class="yt-cmt-avatar" style="background:${c.color || '#1a73e8'}">${escapeHtml(c.ini || (c.name||'?')[0])}</span>
          <div class="yt-cmt-body">
            <div class="yt-cmt-row">
              <strong>${escapeHtml(c.name)}</strong>
              <span class="yt-cmt-place">· ${escapeHtml(c.place||'')}</span>
              <span class="yt-cmt-time">${this.ago(c.daysAgo)}</span>
            </div>
            <div class="yt-cmt-text">${escapeHtml(c.text)}</div>
            <div class="yt-cmt-meta">
              <span><i class="material-icons">thumb_up</i> ${c.likes.toLocaleString()}</span>
              <span><i class="material-icons">thumb_down</i></span>
              <span class="yt-cmt-reply">Reply</span>
              ${c.replies ? `<span class="yt-cmt-replies">▾ ${c.replies} repl${c.replies===1?'y':'ies'}</span>` : ''}
            </div>
          </div>
        </div>`).join('');
    };
    renderList();
    const input = host.querySelector('#ytNewComment');
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      const list = this.loadCustom(r.id);
      list.unshift({ name:'Donald J. Trump', place:'White House, USA', ini:'DT', color:'#9334e9', text:v, likes:1, replies:0, daysAgo:0 });
      this.saveCustom(r.id, list);
      input.value = '';
      renderList();
    };
    host.querySelector('.yt-cmt-submit').addEventListener('click', submit);
    host.querySelector('.yt-cmt-cancel').addEventListener('click', () => { input.value = ''; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  }
};

/* ============== UDrive ============== */
Views.udrive = {
  filter: 'all',
  mount() {
    const main = document.getElementById('appMain');
    main.classList.remove('bg-flush');
    main.innerHTML = `
      <div class="udrive">
        <div class="udrive-head">
          <div class="udrive-title">UDrive · Declassified UAP documents</div>
          <div style="margin-left:auto;color:#5f6368;font-size:13px">${state.enriched.filter(r=>r.type==='PDF').length} files</div>
        </div>
        <div class="udrive-chips" id="udriveChips"></div>
        <div class="udrive-grid" id="udriveGrid"></div>
      </div>`;
    this.renderChips();
    this.render();
  },
  renderChips() {
    const chips = document.getElementById('udriveChips');
    const opts = [
      ['all', 'All'],
      ['FBI', 'FBI'],
      ['Department of War', 'Dept. of War'],
      ['Department of State', 'Dept. of State'],
      ['NASA', 'NASA'],
      ['has-snippet', 'With excerpts'],
    ];
    chips.innerHTML = opts.map(([k,l]) => `<button class="chip ${this.filter===k?'active':''}" data-k="${k}">${l}</button>`).join('');
    chips.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
      this.filter = c.dataset.k;
      chips.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x.dataset.k===this.filter));
      this.render();
    }));
  },
  render() {
    const grid = document.getElementById('udriveGrid');
    let items = state.enriched.filter(r => r.type === 'PDF');
    if (this.filter !== 'all') {
      if (this.filter === 'has-snippet') items = items.filter(r => r.pdf_snippet);
      else items = items.filter(r => r.agency === this.filter);
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter(r => (r.title+' '+r.description+' '+(r.pdf_snippet||'')).toLowerCase().includes(q));
    }
    grid.innerHTML = items.length ? items.map(r => this.cardHtml(r)).join('') :
      `<div style="grid-column:1/-1;padding:60px;text-align:center;color:#5f6368">No documents in this view.</div>`;
    grid.querySelectorAll('.doc-card').forEach(c => c.addEventListener('click', () => openRecord(state.byId[c.dataset.id]._idx)));
  },
  cardHtml(r) {
    const ag = AGENCIES[r.agency];
    const thumb = r.thumbnail_local || '';
    return `
      <div class="doc-card" data-id="${r.id}">
        <div class="doc-thumb">
          ${thumb ? `<img loading="lazy" src="${escapeHtml(thumb)}" alt="" onerror="this.style.display='none'" />` : `<i class="material-icons" style="font-size:48px;color:#bdc1c6">picture_as_pdf</i>`}
        </div>
        <div class="doc-info">
          <div class="ic"><i class="material-icons">picture_as_pdf</i></div>
          <div style="min-width:0">
            <div class="doc-name">${escapeHtml(fmtTitle(r.title))}</div>
            <div class="doc-agency">${escapeHtml(ag.short)} · ${escapeHtml(r.incident_location && r.incident_location!=='N/A' ? r.incident_location : 'Released '+fmtRelDate(r.release_date))}</div>
          </div>
        </div>
      </div>`;
  }
};

/* ============== UPhotos ============== */
Views.uphotos = {
  filter: 'all',
  source: 'official', // 'official' | 'documents'
  lightboxIdx: -1,
  lightboxList: [],
  mount() {
    const main = document.getElementById('appMain');
    main.classList.remove('bg-flush');
    const docCount = (state.pdfImages || []).length;
    main.innerHTML = `
      <div class="uphotos">
        <div class="uphotos-head">
          <div class="uphotos-title">UPhotos · UAP photographs</div>
          <div class="uphotos-tabs" id="uphotosSource">
            <button class="ut-btn ${this.source==='official'?'active':''}" data-s="official">Official photo releases (${state.enriched.filter(r=>r.type==='IMG').length})</button>
            <button class="ut-btn ${this.source==='documents'?'active':''}" data-s="documents">Embedded in documents (${docCount})</button>
          </div>
        </div>
        <div class="uphotos-tabs" id="uphotosChips" style="margin-top:10px"></div>
        <div class="uphotos-grid" id="uphotosGrid"></div>
      </div>`;
    document.querySelectorAll('#uphotosSource .ut-btn').forEach(b => b.addEventListener('click', () => {
      this.source = b.dataset.s;
      this.filter = 'all';
      this.mount();
    }));
    this.renderChips();
    this.render();
  },
  renderChips() {
    const chips = document.getElementById('uphotosChips');
    let opts;
    if (this.source === 'official') {
      opts = [
        ['all', `All (${state.enriched.filter(r=>r.type==='IMG').length})`],
        ['NASA', `Apollo / NASA`],
        ['FBI', `FBI`],
      ];
    } else {
      const imgs = state.pdfImages || [];
      const ag = {};
      imgs.forEach(i => ag[i.agency] = (ag[i.agency]||0)+1);
      opts = [['all', `All (${imgs.length})`]].concat(Object.keys(ag).sort().map(a=>[a, `${a} (${ag[a]})`]));
    }
    chips.innerHTML = opts.map(([k,l]) => `<button class="chip ${this.filter===k?'active':''}" data-k="${k}" style="background:var(--surface-2);border:1px solid var(--line);padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer">${l}</button>`).join('');
    chips.querySelectorAll('button').forEach(c => c.addEventListener('click', () => {
      this.filter = c.dataset.k;
      chips.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.k===this.filter));
      this.render();
    }));
  },
  render() {
    const grid = document.getElementById('uphotosGrid');
    if (!grid) return;
    if (this.source === 'official') {
      let items = state.enriched.filter(r => r.type === 'IMG');
      if (this.filter !== 'all') items = items.filter(r => r.agency === this.filter);
      if (state.search) {
        const q = state.search.toLowerCase();
        items = items.filter(r => (r.title+' '+r.description).toLowerCase().includes(q));
      }
      this.lightboxList = items.map(r => ({ kind:'official', r,
        full: r.asset_url, thumb: r.asset_url, title: fmtTitle(r.title),
        sub: `${AGENCIES[r.agency].short} · ${r.incident_location || 'Unknown'} · ${r.incident_date || 'Released ' + fmtRelDate(r.release_date)}`,
        link: null
      }));
      grid.innerHTML = this.lightboxList.length ? this.lightboxList.map((p, i) => this.cardHtmlOfficial(p, i)).join('') :
        `<div style="grid-column:1/-1;padding:60px;text-align:center;color:#5f6368">No photographs in this view.</div>`;
    } else {
      let items = state.pdfImages || [];
      if (this.filter !== 'all') items = items.filter(p => p.agency === this.filter);
      if (state.search) {
        const q = state.search.toLowerCase();
        items = items.filter(p => (p.pdf_title + ' ' + (p.incident_location||'')).toLowerCase().includes(q));
      }
      this.lightboxList = items.map(p => ({ kind:'doc', r: state.byId[p.pdf_id],
        full: p.image, thumb: p.thumb || p.image,
        title: fmtTitle(p.pdf_title),
        sub: `${AGENCIES[p.agency].short} · ${p.incident_location || 'Unknown'} · ${p.incident_date || 'Released ' + fmtRelDate(state.byId[p.pdf_id]?.release_date||'')}`,
        link: p.pdf_url, w: p.w, h: p.h
      }));
      grid.innerHTML = this.lightboxList.length ? this.lightboxList.map((p, i) => this.cardHtmlDoc(p, i)).join('') :
        `<div style="grid-column:1/-1;padding:60px;text-align:center;color:#5f6368">No embedded images in this view.</div>`;
    }
    grid.querySelectorAll('.photo-card').forEach((c, i) => c.addEventListener('click', () => this.openLightbox(i)));
  },
  cardHtmlOfficial(p, i) {
    return `
      <div class="photo-card" data-i="${i}">
        <img loading="lazy" src="${escapeHtml(p.thumb)}" alt="${escapeHtml(p.title)}" onerror="this.style.display='none'" />
        <div class="photo-overlay">
          ${escapeHtml(p.title)}
          <div class="photo-loc">${escapeHtml(p.sub)}</div>
        </div>
      </div>`;
  },
  cardHtmlDoc(p, i) {
    return `
      <div class="photo-card" data-i="${i}">
        <img loading="lazy" src="${escapeHtml(p.thumb)}" alt="${escapeHtml(p.title)}" onerror="this.style.display='none'" />
        <div class="photo-overlay">
          From document
          <div class="photo-loc" style="font-weight:600">${escapeHtml(p.title)}</div>
          <div class="photo-loc">${escapeHtml(p.sub)}</div>
        </div>
      </div>`;
  },
  openLightbox(i) {
    this.lightboxIdx = i;
    const p = this.lightboxList[i];
    if (!p) return;
    const lb = document.getElementById('lightbox');
    document.getElementById('lightboxStage').innerHTML = `<img src="${escapeHtml(p.full)}" alt="${escapeHtml(p.title)}" />`;
    const recBtn = p.r ? `<button class="primary-btn" id="lbOpenRec" style="margin-left:10px">Open record</button>` : '';
    const linkBtn = p.link ? `<a href="${escapeHtml(p.link)}" target="_blank" rel="noreferrer" style="margin-left:10px;color:#9ec1ff">↪ Source PDF</a>` : '';
    document.getElementById('lightboxCaption').innerHTML = `
      <strong>${escapeHtml(p.title)}</strong>
      <div style="margin-top:4px;opacity:.85">${escapeHtml(p.sub)}</div>
      <div style="margin-top:8px"><span style="font-size:11px;opacity:.6">${i+1} / ${this.lightboxList.length} · ← / → to navigate · Esc to close</span> ${recBtn}${linkBtn}</div>`;
    lb.hidden = false;
    document.getElementById('lbOpenRec')?.addEventListener('click', () => {
      const r = p.r;
      this.closeLightbox();
      if (r && typeof r._idx === 'number') openRecord(r._idx);
    });
  },
  closeLightbox() {
    document.getElementById('lightbox').hidden = true;
  },
  lightboxNav(d) {
    if (this.lightboxIdx < 0) return;
    this.lightboxIdx = (this.lightboxIdx + d + this.lightboxList.length) % this.lightboxList.length;
    this.openLightbox(this.lightboxIdx);
  }
};

/* ============== UEarth (clustered atlas + time slider + agency colors) ============== */
/* ============== UEarth · 3D globe (globe.gl / three.js) ============== */
const LAUNCH_SITES = {
  'Kennedy Space Center, FL': { lat: 28.573, lng: -80.649, label: 'Kennedy Space Center · Florida' },
  'Cape Canaveral, FL':       { lat: 28.488, lng: -80.577, label: 'Cape Canaveral · Florida' },
  'Houston, TX':              { lat: 29.560, lng: -95.094, label: 'Johnson Space Center · Houston' },
  'Baikonur, Kazakhstan':     { lat: 45.965, lng: 63.305,  label: 'Baikonur Cosmodrome' }
};
function pickLaunchSite(r) {
  const t = ((r.title||'') + ' ' + (r.description||'') + ' ' + (r.incident_location||'')).toLowerCase();
  if (/baikonur|soyuz|salyut/.test(t)) return LAUNCH_SITES['Baikonur, Kazakhstan'];
  if (/houston|johnson|mission control/.test(t)) return LAUNCH_SITES['Houston, TX'];
  if (/apollo|gemini|skylab|saturn|ksc|kennedy/.test(t)) return LAUNCH_SITES['Kennedy Space Center, FL'];
  return LAUNCH_SITES['Cape Canaveral, FL'];
}

Views.uearth = {
  globe: null,
  layerMode: 'pins',          // 'pins' | 'density'
  agencyFilter: new Set(['FBI','NASA','Department of War','Department of State']),
  yearMin: null, yearMax: null,
  yearWindow: null,
  showOffEarth: true,
  selectedRecordId: null,
  resizeBound: false,
  mount() {
    const main = document.getElementById('appMain');
    main.classList.add('bg-flush');
    main.innerHTML = `
      <div class="uearth">
        <div class="map-wrap">
          <div class="uearth-globe" id="uearthGlobe"></div>
          <div class="uearth-overlay" id="uearthOverlay">
            <div class="uearth-overlay-row">
              <div class="uearth-pill"><span class="uearth-spark">🌎</span><strong>UEarth</strong> · UAP Atlas</div>
              <div class="uearth-mode" id="uearthMode">
                <button class="${this.layerMode==='pins'?'active':''}" data-m="pins"><i class="material-icons">scatter_plot</i> Pins</button>
                <button class="${this.layerMode==='density'?'active':''}" data-m="density"><i class="material-icons">whatshot</i> Density</button>
                <button data-m="rotate" id="uearthRotateBtn" class="active" title="Auto-rotate"><i class="material-icons">rotate_right</i></button>
                <button data-m="reset" id="uearthResetBtn" title="Reset view"><i class="material-icons">restart_alt</i></button>
              </div>
            </div>
            <div class="uearth-overlay-row uearth-agencies" id="uearthAgencies"></div>
            <div class="uearth-overlay-row uearth-time" id="uearthTime"></div>
          </div>
          <div class="uearth-globe-empty" id="uearthGlobeEmpty" hidden>
            <i class="material-icons">public</i>
            <div>Loading 3D globe…</div>
          </div>
        </div>
        <aside class="uearth-side">
          <header class="uearth-side-head">
            <h3>UEarth · UAP Atlas</h3>
            <p>A 3D globe of every declassified UAP report. Drag to spin, scroll to zoom, click a pin to open its record, drag the timeline to filter by year, or switch to <em>Density</em> for a global heat-bin view. Off-Earth incidents (Apollo, Gemini, Skylab, orbital) fly out of the globe as animated arcs.</p>
          </header>
          <div class="uearth-stats" id="uearthStats"></div>
          <div class="uearth-section">
            <h4>Top locations</h4>
            <ul class="uearth-list" id="uearthList"></ul>
          </div>
          <div class="uearth-section" id="uearthOffWrap" hidden>
            <h4>Off-Earth incidents <span id="uearthOffCount" class="badge"></span></h4>
            <ul class="uearth-list uearth-off" id="uearthOff"></ul>
          </div>
          <div class="uearth-credit">3D globe rendered with <a href="https://globe.gl/" target="_blank" rel="noreferrer">globe.gl</a> · Atlas data inspired by <a href="https://github.com/AlexZhangji/ufo-pursue-open-atlas" target="_blank" rel="noreferrer">PURSUE Open Atlas</a> (CC0). Off-Earth arcs use the launch site closest to each mission.</div>
        </aside>
      </div>`;
    setTimeout(() => this.init(), 30);
  },
  init() {
    const ys = state.enriched.map(r => r.year || (r.incident_date && /\b(19|20)\d{2}\b/.exec(r.incident_date) ? Number(/\b((?:19|20)\d{2})\b/.exec(r.incident_date)[1]) : null)).filter(y => y);
    this.yearMin = Math.min(...ys);
    this.yearMax = Math.max(...ys);
    if (!this.yearWindow) this.yearWindow = [this.yearMin, this.yearMax];

    const host = document.getElementById('uearthGlobe');
    if (!host) return;
    if (typeof Globe !== 'function') {
      document.getElementById('uearthGlobeEmpty').hidden = false;
      document.getElementById('uearthGlobeEmpty').innerHTML = '<i class="material-icons">cloud_off</i><div>3D globe library failed to load — check network.</div>';
      return;
    }
    if (this.globe) {
      try { this.globe._destructor && this.globe._destructor(); } catch (e) {}
      host.innerHTML = '';
      this.globe = null;
    }
    const globe = Globe()(host)
      .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg')
      .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-topology.png')
      .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/night-sky.png')
      .atmosphereColor('#3b82f6')
      .atmosphereAltitude(0.18)
      .showGlobe(true)
      .showAtmosphere(true);
    globe.width(host.clientWidth);
    globe.height(host.clientHeight);
    globe.pointOfView({ lat: 22, lng: 12, altitude: 2.6 }, 0);
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    this.globe = globe;

    if (!this.resizeBound) {
      this._onResize = () => {
        if (!this.globe) return;
        const h = document.getElementById('uearthGlobe');
        if (!h) return;
        this.globe.width(h.clientWidth); this.globe.height(h.clientHeight);
      };
      window.addEventListener('resize', this._onResize);
      this.resizeBound = true;
    }
    setTimeout(() => this._onResize && this._onResize(), 60);

    this.renderAgencyChips();
    this.renderTimeSlider();
    this.renderModeToggle();
    this.renderLayer();
    this.renderSidebar();
  },
  effectiveCoords(r) {
    if (r.atlas_lat != null && r.atlas_lng != null) return [r.atlas_lat, r.atlas_lng];
    if (r.lat_base != null && r.lng_base != null) return [r.lat_base, r.lng_base];
    if (r.coords) return r.coords;
    return null;
  },
  yearOf(r) {
    if (r.year) return r.year;
    const m = /\b((?:19|20)\d{2})\b/.exec(r.incident_date || '');
    return m ? Number(m[1]) : null;
  },
  agencyColorOf(r) {
    if (r.agency_color) return r.agency_color;
    return (AGENCIES[r.agency] || {}).color || '#9aa0a6';
  },
  filtered() {
    return state.enriched.filter(r => {
      if (!this.agencyFilter.has(r.agency)) return false;
      const y = this.yearOf(r);
      if (y && (y < this.yearWindow[0] || y > this.yearWindow[1])) return false;
      return true;
    });
  },
  renderModeToggle() {
    const host = document.getElementById('uearthMode');
    host.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.m;
      if (m === 'rotate') {
        if (!this.globe) return;
        const c = this.globe.controls();
        c.autoRotate = !c.autoRotate;
        b.classList.toggle('active', c.autoRotate);
        return;
      }
      if (m === 'reset') {
        if (!this.globe) return;
        this.globe.pointOfView({ lat: 22, lng: 12, altitude: 2.6 }, 900);
        this.globe.controls().autoRotate = true;
        document.getElementById('uearthRotateBtn').classList.add('active');
        return;
      }
      this.layerMode = m;
      host.querySelectorAll('button[data-m="pins"], button[data-m="density"]').forEach(x => x.classList.toggle('active', x.dataset.m===this.layerMode));
      this.renderLayer();
    }));
  },
  renderAgencyChips() {
    const host = document.getElementById('uearthAgencies');
    const order = ['Department of War','FBI','NASA','Department of State'];
    const counts = {};
    state.enriched.forEach(r => { counts[r.agency] = (counts[r.agency] || 0) + 1; });
    host.innerHTML = order.map(a => {
      const c = AGENCIES[a]?.color || '#999';
      const on = this.agencyFilter.has(a);
      return `<button class="uearth-chip ${on?'on':''}" data-a="${escapeHtml(a)}" style="--c:${c}"><span class="dot"></span>${AGENCIES[a]?.short||a} <em>${counts[a]||0}</em></button>`;
    }).join('');
    host.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (this.agencyFilter.has(a)) this.agencyFilter.delete(a); else this.agencyFilter.add(a);
      b.classList.toggle('on', this.agencyFilter.has(a));
      this.renderLayer(); this.renderSidebar();
    }));
  },
  renderTimeSlider() {
    const host = document.getElementById('uearthTime');
    host.innerHTML = `
      <div class="uearth-time-head">
        <span>Year window</span>
        <span class="uearth-time-range" id="uearthTimeRange">${this.yearWindow[0]}–${this.yearWindow[1]}</span>
        <button class="uearth-link" id="uearthTimeReset">reset</button>
      </div>
      <div class="uearth-histogram" id="uearthHisto"></div>
      <div class="uearth-time-axis">
        <span>${this.yearMin}</span><span>${Math.round((this.yearMin+this.yearMax)/2)}</span><span>${this.yearMax}</span>
      </div>`;
    // histogram
    const buckets = {};
    state.enriched.forEach(r => { const y = this.yearOf(r); if (y) buckets[y] = (buckets[y]||0)+1; });
    const max = Math.max(1, ...Object.values(buckets));
    const hist = document.getElementById('uearthHisto');
    const bars = [];
    for (let y = this.yearMin; y <= this.yearMax; y++) {
      const v = buckets[y] || 0;
      const inside = (y >= this.yearWindow[0] && y <= this.yearWindow[1]);
      bars.push(`<div class="uearth-bar ${inside?'on':''}" data-y="${y}" style="--h:${(v/max)*100}%" title="${y}: ${v} record${v===1?'':'s'}"></div>`);
    }
    hist.innerHTML = bars.join('');
    // drag-to-window
    let dragStart = null;
    const yearAt = (e) => {
      const rect = hist.getBoundingClientRect();
      const x = (e.touches?e.touches[0].clientX:e.clientX) - rect.left;
      const frac = Math.max(0, Math.min(1, x / rect.width));
      const span = (this.yearMax - this.yearMin);
      return Math.round(this.yearMin + frac * span);
    };
    const onMove = (e) => {
      if (dragStart == null) return;
      const y = yearAt(e);
      this.yearWindow = [Math.min(dragStart, y), Math.max(dragStart, y)];
      document.getElementById('uearthTimeRange').textContent = `${this.yearWindow[0]}–${this.yearWindow[1]}`;
      hist.querySelectorAll('.uearth-bar').forEach(b => {
        const yy = Number(b.dataset.y);
        b.classList.toggle('on', yy >= this.yearWindow[0] && yy <= this.yearWindow[1]);
      });
    };
    const onUp = () => {
      if (dragStart == null) return;
      dragStart = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      this.renderLayer(); this.renderSidebar();
    };
    hist.addEventListener('mousedown', (e) => {
      dragStart = yearAt(e);
      this.yearWindow = [dragStart, dragStart];
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
    hist.addEventListener('touchstart', (e) => {
      dragStart = yearAt(e);
      this.yearWindow = [dragStart, dragStart];
      window.addEventListener('touchmove', onMove, {passive:true});
      window.addEventListener('touchend', onUp);
    });
    document.getElementById('uearthTimeReset').addEventListener('click', () => {
      this.yearWindow = [this.yearMin, this.yearMax];
      this.renderTimeSlider();
      this.renderLayer(); this.renderSidebar();
    });
  },
  renderLayer() {
    const g = this.globe;
    if (!g) return;
    const items = this.filtered();
    const located = items.filter(r => this.effectiveCoords(r));
    const off = items.filter(r => !this.effectiveCoords(r));

    if (this.layerMode === 'density') {
      const pts = located.map(r => { const [lat,lng] = this.effectiveCoords(r); return { lat, lng, w: 1, record: r }; });
      const colorScale = (typeof d3 !== 'undefined' && d3.interpolateInferno) ? d3.interpolateInferno : (t => `rgba(${Math.round(t*255)},${Math.round(t*120)},${Math.round((1-t)*200)},0.9)`);
      g.pointsData([])
        .arcsData([])
        .ringsData([])
        .htmlElementsData([])
        .hexBinPointsData(pts)
        .hexBinPointLat('lat').hexBinPointLng('lng').hexBinPointWeight('w')
        .hexBinResolution(3)
        .hexAltitude(d => Math.min(0.5, 0.04 + d.sumWeight * 0.025))
        .hexTopColor(d => colorScale(Math.min(1, d.sumWeight / 6)))
        .hexSideColor(d => colorScale(Math.min(1, d.sumWeight / 6)))
        .hexBinMerge(false)
        .hexLabel(d => `<div class="uearth-tip"><strong>${d.points.length} record${d.points.length===1?'':'s'}</strong><br/><em>${d.points.slice(0,4).map(p => escapeHtml(fmtTitle(p.record.title))).join('<br/>')}</em>${d.points.length>4?`<br/>+${d.points.length-4} more`:''}</div>`);
      return;
    }

    // pins mode: surface markers + animated arcs for off-earth
    const pinData = located.map(r => {
      const [lat,lng] = this.effectiveCoords(r);
      return { lat, lng, color: this.agencyColorOf(r), record: r };
    });
    const arcData = off.map(r => {
      const ls = pickLaunchSite(r);
      // jitter end point so arcs spread, not overlap
      const dy = (Math.sin((r.id||'').length * 1.3) * 8) || 6;
      const dx = (Math.cos((r.id||'').length * 1.7) * 18) || -12;
      const c = this.agencyColorOf(r);
      return {
        startLat: ls.lat, startLng: ls.lng,
        endLat: ls.lat + dy, endLng: ls.lng + dx,
        color: [c, '#ffffff'], record: r, launch: ls.label
      };
    });

    const root = document.getElementById('uearthGlobe');
    const self = this;
    g.hexBinPointsData([])
      .htmlElementsData(pinData)
      .htmlElement(d => {
        const el = document.createElement('div');
        el.className = 'uearth-globe-pin';
        el.style.setProperty('--c', d.color);
        el.innerHTML = '<span class="uearth-globe-pin-dot"></span><span class="uearth-globe-pin-pulse"></span>';
        el.title = fmtTitle(d.record.title);
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.addEventListener('mouseenter', () => self._tip(self.popupHtml(d.record), root));
        el.addEventListener('mouseleave', () => self._tip(null, root));
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.byId[d.record.id]) openRecord(state.byId[d.record.id]._idx);
        });
        return el;
      })
      .pointsData([])
      .arcsData(arcData)
      .arcStartLat('startLat').arcStartLng('startLng')
      .arcEndLat('endLat').arcEndLng('endLng')
      .arcColor('color')
      .arcAltitude(0.45)
      .arcStroke(0.55)
      .arcDashLength(0.45).arcDashGap(0.18).arcDashAnimateTime(2200)
      .arcLabel(d => `<div class="uearth-tip"><span class="uearth-tip-tag">Off-Earth · launched from ${escapeHtml(d.launch)}</span><strong>${escapeHtml(fmtTitle(d.record.title))}</strong><br/>${escapeHtml((d.record.description||'').slice(0,160))}${(d.record.description||'').length>160?'…':''}</div>`)
      .onArcClick(d => { if (d.record && state.byId[d.record.id]) openRecord(state.byId[d.record.id]._idx); });
  },
  _tip(html, host) {
    let tip = host.querySelector('.uearth-tip-floating');
    if (!html) { if (tip) tip.remove(); return; }
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'uearth-tip-floating';
      host.appendChild(tip);
    }
    tip.innerHTML = html;
  },
  popupHtml(r) {
    const ag = AGENCIES[r.agency] || {};
    const y = this.yearOf(r);
    const date = (r.date_label || r.incident_date || (y ? `~${y}` : 'Date unknown'));
    return `<div class="uearth-card">
      <div class="uearth-card-head"><span class="uearth-card-dot" style="background:${this.agencyColorOf(r)}"></span><strong>${escapeHtml(ag.short || r.agency)}</strong> · ${escapeHtml(date)}</div>
      <div class="uearth-card-title">${escapeHtml(fmtTitle(r.title))}</div>
      ${r.incident_location && r.incident_location!=='N/A' ? `<div class="uearth-card-loc"><i class="material-icons">place</i>${escapeHtml(r.incident_location)}</div>`:''}
      <p>${escapeHtml((r.description || '').slice(0, 200))}${(r.description||'').length>200?'…':''}</p>
      <span class="uearth-open">Click to open record →</span>
    </div>`;
  },
  renderSidebar() {
    const items = this.filtered();
    // grouped by location
    const grouped = {};
    items.forEach(r => {
      const c = this.effectiveCoords(r);
      if (!c) return;
      const loc = r.incident_location && r.incident_location!=='N/A' ? r.incident_location : (r.cluster_key || 'Unknown');
      const key = loc;
      (grouped[key] = grouped[key] || { loc, lat:c[0], lng:c[1], records:[], colors:new Set() }).records.push(r);
      grouped[key].colors.add(this.agencyColorOf(r));
    });
    const sorted = Object.values(grouped).sort((a,b) => b.records.length - a.records.length);
    const list = document.getElementById('uearthList');
    list.innerHTML = sorted.slice(0, 40).map(g => `
      <li data-lat="${g.lat}" data-lng="${g.lng}">
        <span class="uearth-loc">${escapeHtml(g.loc)}</span>
        <span class="uearth-dots">${[...g.colors].map(c => `<i style="background:${c}"></i>`).join('')}</span>
        <span class="uearth-cnt">${g.records.length}</span>
      </li>`).join('') || '<li class="muted">No records in this filter.</li>';
    list.querySelectorAll('li[data-lat]').forEach(li => li.addEventListener('click', () => {
      const lat = Number(li.dataset.lat), lng = Number(li.dataset.lng);
      if (this.globe) {
        this.globe.controls().autoRotate = false;
        const btn = document.getElementById('uearthRotateBtn'); if (btn) btn.classList.remove('active');
        this.globe.pointOfView({ lat, lng, altitude: 1.6 }, 1200);
      }
    }));
    // off-earth
    const off = items.filter(r => !this.effectiveCoords(r));
    const offWrap = document.getElementById('uearthOffWrap');
    const offEl = document.getElementById('uearthOff');
    if (off.length) {
      offWrap.hidden = false;
      document.getElementById('uearthOffCount').textContent = off.length;
      offEl.innerHTML = off.map(r => `<li data-id="${r.id}"><span class="uearth-loc">${escapeHtml(fmtTitle(r.title))}</span><span class="uearth-cnt">${this.yearOf(r)||''}</span></li>`).join('');
      offEl.querySelectorAll('li').forEach(li => li.addEventListener('click', () => { const r = state.byId[li.dataset.id]; if (r) openRecord(r._idx); }));
    } else {
      offWrap.hidden = true;
    }
    // stats
    const stats = document.getElementById('uearthStats');
    const total = items.length;
    const located = total - off.length;
    stats.innerHTML = `<div><strong>${total}</strong> record${total===1?'':'s'}</div>
                       <div><strong>${located}</strong> located</div>
                       <div><strong>${off.length}</strong> off-Earth</div>
                       <div><strong>${this.yearWindow[0]}–${this.yearWindow[1]}</strong></div>`;
  }
};

/* ============== USearch (full-text search across PDFs incl. FBI scans) ============== */
Views.usearch = {
  q: '',
  results: [],
  agencyFilter: new Set(),
  mount() {
    const main = document.getElementById('appMain');
    main.classList.remove('bg-flush');
    main.innerHTML = `
      <div class="usearch">
        <div class="usearch-head">
          <div class="usearch-title"><span class="usearch-glyph"><i class="material-icons">search</i></span> USearch · Full-text across all <strong>${(state.pdfPages||[]).length}</strong> declassified pages</div>
          <p class="muted">Searches every page of every PDF — including FBI scanned files — using cleaned VLM-extracted text. Results show the matching snippet; click to open the source page.</p>
        </div>
        <form class="usearch-form" id="usearchForm">
          <input id="usearchInput" type="search" placeholder='Try: "flying disc", "PURSUE", "Tehran", "Apollo 11", "Roswell", "GO FAST", "Tic Tac"…' autocomplete="off" autofocus />
          <button class="usearch-go" type="submit"><i class="material-icons">search</i> Search</button>
        </form>
        <div class="usearch-tips" id="usearchTips"></div>
        <div class="usearch-stats" id="usearchStats"></div>
        <div class="usearch-results" id="usearchResults"></div>
      </div>`;
    document.getElementById('usearchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.q = document.getElementById('usearchInput').value.trim();
      this.run();
    });
    document.getElementById('usearchInput').addEventListener('input', (e) => {
      this.q = e.target.value.trim();
      // debounce
      clearTimeout(this._t); this._t = setTimeout(() => this.run(), 220);
    });
    this.renderTips();
    if (state.search) {
      document.getElementById('usearchInput').value = state.search;
      this.q = state.search;
      this.run();
    } else {
      this.run();
    }
  },
  renderTips() {
    const tips = document.getElementById('usearchTips');
    const samples = ['flying disc','Roswell','Tic Tac','GO FAST','Tehran','Project Blue Book','silver disc','Pentagon','UAP Task Force','Apollo 11','Gemini 7','PURSUE','Whirring','Ramey','Project Sign','J. Edgar Hoover','foo fighter','CENTCOM','sphere','metallic'];
    tips.innerHTML = `<span class="usearch-tip-label">Try:</span> ${samples.map(s => `<button class="chip" data-q="${escapeHtml(s)}">${s}</button>`).join('')}`;
    tips.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
      this.q = c.dataset.q;
      document.getElementById('usearchInput').value = this.q;
      this.run();
    }));
  },
  run() {
    const out = document.getElementById('usearchResults');
    const stats = document.getElementById('usearchStats');
    if (!this.q) { out.innerHTML = ''; stats.innerHTML = `<span>${(state.pdfPages||[]).length.toLocaleString()} pages indexed across ${state.enriched.filter(r=>r.type==='PDF').length} declassified PDFs.</span>`; return; }
    const pages = state.pdfPages || [];
    const tokens = this.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) { out.innerHTML=''; return; }
    // Score each page: tokens-found + phrase-match bonus
    const phrase = this.q.toLowerCase();
    const groups = {}; // rid -> { rec, hits:[{p, score, snippet}] }
    let totalHits = 0;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const t = (p.text || '').toLowerCase();
      let score = 0;
      for (const tk of tokens) {
        const c = (t.split(tk).length - 1);
        if (c) score += c;
      }
      if (!score) continue;
      if (t.includes(phrase)) score += 5;
      const snippet = makeSnippet(p.text, this.q, 240);
      (groups[p.rid] = groups[p.rid] || { rid:p.rid, hits:[], total:0 });
      groups[p.rid].hits.push({ p:p.p, tot:p.tot, score, snippet });
      groups[p.rid].total += score;
      totalHits++;
    }
    const sorted = Object.values(groups).sort((a,b) => b.total - a.total);
    const matchedRecs = sorted.length;
    stats.innerHTML = totalHits
      ? `<strong>${totalHits.toLocaleString()}</strong> page${totalHits===1?'':'s'} matched <strong>${matchedRecs}</strong> document${matchedRecs===1?'':'s'} for <em>"${escapeHtml(this.q)}"</em>`
      : `<span class="muted">No pages match "${escapeHtml(this.q)}".</span>`;
    out.innerHTML = sorted.slice(0, 50).map(g => {
      const r = state.byId[g.rid];
      if (!r) return '';
      const ag = AGENCIES[r.agency] || {};
      const top = g.hits.sort((a,b)=>b.score-a.score).slice(0, 3);
      return `<article class="usearch-card" data-id="${r.id}">
        <header>
          <span class="agency-pill ${ag.pill||''}" style="background:${ag.color||'#999'}"></span>
          <strong>${escapeHtml(fmtTitle(r.title))}</strong>
          <span class="muted">· ${escapeHtml(ag.short || r.agency)} · ${g.hits.length} matching page${g.hits.length===1?'':'s'}</span>
        </header>
        ${top.map(h => `
          <a class="usearch-snippet" data-id="${r.id}" data-page="${h.p}">
            <span class="usearch-page">page ${h.p}/${h.tot}</span>
            <span class="usearch-text">${highlightSnippet(h.snippet, this.q)}</span>
          </a>`).join('')}
      </article>`;
    }).join('');
    out.querySelectorAll('.usearch-snippet').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const r = state.byId[a.dataset.id];
      if (r) openRecord(r._idx);
    }));
  }
};

/* highlight + snippet helpers */
function makeSnippet(text, q, len = 240) {
  const tl = text.toLowerCase();
  const ql = q.toLowerCase();
  let i = tl.indexOf(ql);
  if (i < 0) {
    const tokens = ql.split(/\s+/);
    for (const t of tokens) { i = tl.indexOf(t); if (i >= 0) break; }
  }
  if (i < 0) i = 0;
  const start = Math.max(0, i - 60);
  const end = Math.min(text.length, start + len);
  let s = text.slice(start, end).replace(/\s+/g,' ').trim();
  if (start > 0) s = '… ' + s;
  if (end < text.length) s = s + ' …';
  return s;
}
function highlightSnippet(s, q) {
  const safe = escapeHtml(s);
  const tokens = q.split(/\s+/).filter(t => t.length >= 2);
  let out = safe;
  // longest first to avoid nested overwriting
  tokens.sort((a,b)=>b.length-a.length);
  for (const t of tokens) {
    const re = new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')', 'ig');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}

/* ============== UCalendar ============== */
Views.ucalendar = {
  view: 'timeline',
  mount() {
    const main = document.getElementById('appMain');
    main.classList.remove('bg-flush');
    main.innerHTML = `
      <div class="ucalendar">
        <div class="uc-head">
          <div class="uc-title"><span class="uc-cube">26</span> UCalendar · UAP disclosure timeline</div>
          <div class="uc-toggle">
            <button class="${this.view==='timeline'?'active':''}" data-v="timeline">Timeline</button>
            <button class="${this.view==='months'?'active':''}" data-v="months">By month</button>
          </div>
        </div>
        <div id="ucBody"></div>
      </div>`;
    document.querySelectorAll('.uc-toggle button').forEach(b => b.addEventListener('click', () => {
      this.view = b.dataset.v;
      document.querySelectorAll('.uc-toggle button').forEach(x => x.classList.toggle('active', x.dataset.v===this.view));
      this.render();
    }));
    this.render();
  },
  render() {
    const events = state.enriched
      .filter(r => r.date_parsed && r.date_parsed.year)
      .sort((a,b) => {
        const da = new Date(a.date_parsed.year, (a.date_parsed.month||1)-1, a.date_parsed.day||1);
        const db = new Date(b.date_parsed.year, (b.date_parsed.month||1)-1, b.date_parsed.day||1);
        return da - db;
      });
    const body = document.getElementById('ucBody');
    if (this.view === 'months') {
      const buckets = {};
      events.forEach(e => {
        const k = `${e.date_parsed.year}-${String(e.date_parsed.month||0).padStart(2,'0')}`;
        (buckets[k] = buckets[k] || []).push(e);
      });
      const keys = Object.keys(buckets).sort();
      const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      body.innerHTML = `<div class="uc-month-grid">` +
        keys.map(k => {
          const [y,m] = k.split('-');
          return `<div class="uc-month-card" data-y="${y}" data-m="${m}">
            <div class="uc-mon">${months[Number(m)] || '—'} ${y}</div>
            <div class="uc-cnt">${buckets[k].length}</div>
          </div>`;
        }).join('') + `</div>`;
      body.querySelectorAll('.uc-month-card').forEach(c => c.addEventListener('click', () => {
        this.view = 'timeline';
        this.mount();
        setTimeout(() => {
          const yr = c.dataset.y;
          const heading = body.querySelector(`[data-year="${yr}"]`);
          if (heading) heading.scrollIntoView({behavior:'smooth', block:'start'});
        }, 50);
      }));
      return;
    }
    const byYear = {};
    events.forEach(e => (byYear[e.date_parsed.year] = byYear[e.date_parsed.year] || []).push(e));
    const years = Object.keys(byYear).sort();
    body.innerHTML = `<div class="uc-timeline">` +
      years.map(y => `
        <h3 class="uc-year" data-year="${y}">${y} · ${byYear[y].length} sighting${byYear[y].length===1?'':'s'}</h3>
        ` + byYear[y].map(e => {
          const ag = AGENCIES[e.agency];
          const tag = e.type==='PDF' ? 'DOC' : e.type==='VID' ? 'VID' : 'IMG';
          const brief = e.description ? e.description.split(/[\n.]/).slice(0,2).join('. ').slice(0,220) + (e.description.length > 220 ? '…' : '') : '';
          return `<div class="uc-event" data-id="${e.id}">
            <div class="uc-date">${escapeHtml(e.date_parsed.label)}</div>
            <div class="uc-loc"><i class="material-icons">place</i>${escapeHtml(e.incident_location || 'Unknown')}</div>
            <div class="uc-detail">
              <span class="uc-tag">${tag}</span>${escapeHtml(fmtTitle(e.title))}
              <div class="muted" style="margin-top:4px;color:#5f6368;font-weight:400">${escapeHtml(brief)}</div>
            </div>
            <div class="muted" style="color:${ag.color};font-weight:600">${escapeHtml(ag.short)}</div>
          </div>`;
        }).join('')
      ).join('') +
      `</div>`;
    body.querySelectorAll('.uc-event').forEach(el => el.addEventListener('click', () => openRecord(state.byId[el.dataset.id]._idx)));
  }
};

/* ============== Umeni view ============== */
Views.umeni = {
  mount() {
    const main = document.getElementById('appMain');
    main.classList.remove('bg-flush');
    main.innerHTML = `
      <div style="padding:36px 40px;max-width:980px;margin:0 auto">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">
          <span class="dock-glyph umeni-glyph" style="width:44px;height:44px;font-size:24px">✦</span>
          <h1 style="font-family:'Google Sans';font-size:32px;font-weight:500;margin:0;background:linear-gradient(135deg,#9334e9,#1a73e8 60%,#34a853);-webkit-background-clip:text;background-clip:text;color:transparent">Hello, Mr. President</h1>
        </div>
        <p style="color:#5f6368;font-size:16px;margin:0 0 24px">Ask Umeni anything about the ${state.enriched.length} declassified UAP records. Answers are grounded in the actual file text and descriptions; outside context is clearly marked.</p>
        <div id="umeniSuggestRow" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px"></div>
        <div id="umeniMain" style="background:#fff;border-radius:16px;border:1px solid #e8eaed;padding:18px 18px 8px"></div>
        <form id="umeniInlineForm" style="display:flex;gap:10px;margin-top:14px;align-items:center;background:#fff;border-radius:99px;border:1px solid #dadce0;padding:6px 6px 6px 16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
          <i class="material-icons" style="color:#5f6368">auto_awesome</i>
          <input id="umeniInlineInput" placeholder="Ask Umeni — e.g. What did Frank Borman report on Gemini 7?" style="flex:1;border:none;outline:none;font-size:15px;padding:10px 0;background:transparent" />
          <button type="submit" class="primary-btn" style="border-radius:99px;padding:10px 22px">Ask</button>
        </form>
      </div>`;

    const suggestions = [
      'Summarise the Apollo 12 sightings.',
      'What happened in Greece in October 2023?',
      'Which records mention Frank Borman?',
      'List unresolved CENTCOM reports from 2020.',
      'How many sightings occurred in 2025?',
      'Where did the most recent UAP sighting occur?',
      'Tell me about Range Fouler reports.',
      'What does PURSUE stand for?',
      'Show me FBI photos.',
      'Compare the Gemini 7 and Apollo 11 sightings.',
    ];
    document.getElementById('umeniSuggestRow').innerHTML = suggestions.map(s =>
      `<button class="chip" data-q="${escapeHtml(s)}" style="background:#f1f3f4;border:1px solid #e8eaed;color:#3c4043;font-size:13px;padding:8px 14px;border-radius:99px;cursor:pointer">${escapeHtml(s)}</button>`
    ).join('');
    document.querySelectorAll('#umeniSuggestRow .chip').forEach(c => c.addEventListener('click', () => Umeni.runQuery(c.dataset.q, document.getElementById('umeniMain'))));
    document.getElementById('umeniInlineForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = document.getElementById('umeniInlineInput').value.trim();
      if (v) { Umeni.runQuery(v, document.getElementById('umeniMain')); document.getElementById('umeniInlineInput').value=''; }
    });
    Umeni.runQuery('Summarise this disclosure release in 5 bullet points.', document.getElementById('umeniMain'));
  }
};

/* ============== Umail view ============== */
Views.umail = { mount() { renderInbox(); } };

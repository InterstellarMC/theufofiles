/* views.js — UTube / UDrive / UPhotos / UEarth / UCalendar / Umeni mount points */

const Views = {};

/* ============== UTube ============== */
Views.utube = {
  filter: 'all',
  searchQ: '',
  release: 'all',
  sort: 'release',
  savedOnly: false,
  saved: new Set(JSON.parse(localStorage.getItem('utube_saved') || '[]')),
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
        <form class="utube-filters" id="utubeFilters">
          <input name="query" type="search" aria-label="Search UTube videos" placeholder="Search titles, places, or record IDs">
          <select name="release" aria-label="Filter by release"><option value="all">All releases</option>${Array.from({length:8}, (_, i) => `<option value="${i+1}">Release ${String(i+1).padStart(2,'0')}</option>`).join('')}</select>
          <select name="sort" aria-label="Sort videos"><option value="release">Release order</option><option value="latest">Latest release first</option><option value="shortest">Shortest first</option></select>
          <label><input type="checkbox" name="saved"> Saved only</label>
        </form>
        <div class="utube-chips" id="utubeChips"></div>
        <p class="utube-results" id="utubeResults" aria-live="polite"></p>
        <div class="utube-grid" id="utubeGrid"></div>
      </div>`;
    const form = document.getElementById('utubeFilters');
    form.elements.query.value = this.searchQ;
    form.elements.release.value = this.release;
    form.elements.sort.value = this.sort;
    form.elements.saved.checked = this.savedOnly;
    form.onsubmit = event => event.preventDefault();
    form.oninput = () => {
      this.searchQ = form.elements.query.value;
      this.release = form.elements.release.value;
      this.sort = form.elements.sort.value;
      this.savedOnly = form.elements.saved.checked;
      this.render();
    };
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
    const query = (this.searchQ || state.search || '').toLowerCase().trim();
    let items = state.enriched.filter(r => r.type === 'VID' &&
      (this.release === 'all' || Number(this.release) === (r.release || 1)) &&
      (!this.savedOnly || this.saved.has(r.id)) &&
      (!query || [r.id, r.title, fmtTitle(r.title), r.video_title, r.incident_location, r.agency].join(' ').toLowerCase().includes(query)));
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
    if (this.sort === 'latest') items.sort((a,b) => (b.release || 1) - (a.release || 1));
    if (this.sort === 'shortest') items.sort((a,b) => (a.duration || Infinity) - (b.duration || Infinity));
    document.getElementById('utubeResults').textContent = `${items.length} video${items.length === 1 ? '' : 's'}`;
    grid.innerHTML = items.length ? items.map(r => this.cardHtml(r)).join('') :
      `<div style="grid-column:1/-1;padding:60px;text-align:center;color:#aaa">No videos match this filter.</div>`;
    grid.querySelectorAll('.vid-card').forEach(card => {
      card.querySelector('img')?.addEventListener('error', event => { event.target.hidden = true; });
      card.onclick = () => this.openPlayer(card.dataset.id);
    });
  },
  cardHtml(r) {
    const ag = AGENCIES[r.agency];
    const title = r.video_title || fmtTitle(r.title);
    const dur = this.duration(r);
    const poster = r.poster_url || r.thumbnail_url || r.thumbnail_local || '';
    const dateLabel = (r.incident_date && r.incident_date !== 'N/A') ? r.incident_date : (r.incident_location || 'declassified');

    return `
      <button type="button" class="vid-card" data-id="${r.id}">
        <div class="vid-thumb">
          <i class="material-icons vid-placeholder" aria-hidden="true">play_circle_outline</i>
          ${poster ? `<img loading="lazy" decoding="async" src="${escapeHtml(poster)}" alt="" />` : '<div style="width:100%;height:100%;background:#272727"></div>'}
          <span class="vid-duration">${dur}</span>
        </div>
        <div class="vid-meta">
          <div class="vid-channel" style="background:${ag.color}">${ag.initials}</div>
          <div class="vid-text">
            <div class="vid-title">${escapeHtml(title)}</div>
            <div class="vid-channel-name">${escapeHtml(ag.short)} · Release ${String(r.release || 1).padStart(2, '0')}</div>
            <div class="vid-stats">${escapeHtml(dateLabel)} · Released ${escapeHtml(fmtRelDate(r.release_date))}</div>
          </div>
        </div>
      </button>`;
  },
  duration(record) {
    if (!record.duration) return '';
    const seconds = Math.round(record.duration);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;
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
    if (!this.current) this.trigger = document.activeElement;
    this.close(false);
    const overlay = document.createElement('div');
    overlay.className = 'yt-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ytTitle');
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
    const save = overlay.querySelector('#ytSave');
    const saved = Views.utube.saved;
    const refreshSave = () => {
      save.setAttribute('aria-pressed', saved.has(r.id));
      save.querySelector('span').textContent = saved.has(r.id) ? 'Saved' : 'Save';
    };
    refreshSave();
    save.onclick = () => {
      if (saved.has(r.id)) saved.delete(r.id); else saved.add(r.id);
      localStorage.setItem('utube_saved', JSON.stringify([...saved]));
      refreshSave();
      if (Views.utube.savedOnly) Views.utube.render();
    };
    overlay.querySelector('#ytShare').onclick = async event => {
      const button = event.currentTarget;
      const url = location.href.split('#')[0] + '#vid=' + r.id;
      try {
        await navigator.clipboard.writeText(url);
        button.querySelector('span').textContent = 'Link copied';
      } catch {
        const field = overlay.querySelector('#ytShareLink');
        field.hidden = false;
        field.value = url;
        field.select();
      }
    };
    overlay.querySelector('#ytSearchForm').onsubmit = event => {
      event.preventDefault();
      Views.utube.searchQ = overlay.querySelector('#ytSearch').value;
      Views.utube.release = 'all';
      Views.utube.filter = 'all';
      Views.utube.savedOnly = false;
      this.close();
      routeTo('utube');
    };
    const video = overlay.querySelector('video');
    if (video) video.addEventListener('error', () => {
      video.hidden = true;
      overlay.querySelector('#ytFallback').hidden = false;
    }, {once:true});
    overlay.querySelectorAll('[data-seek]').forEach(button => {
      button.onclick = () => {
        if (!video || !Number.isFinite(video.duration)) return;
        video.currentTime = Math.min(Number(button.dataset.seek), video.duration);
        video.play().catch(() => {});
      };
    });
    overlay.querySelectorAll('[data-evidence]').forEach(button => {
      button.onclick = () => {
        this.close();
        openRecord(state.byId[button.dataset.evidence]._idx);
      };
    });
    overlay.querySelector('#ytClose').focus();
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
    const desc = escapeHtml(r.description || '').replace(/\n+/g, '<br>')
      .replace(/(^|<br>)(\d{1,3}):([0-5]\d)(?=\s*[-\u2013\u2014])/g,
        (match, boundary, minutes, seconds) => r.video_url
          ? `${boundary}<button type="button" class="yt-timestamp" data-seek="${Number(minutes) * 60 + Number(seconds)}">${minutes}:${seconds}</button>`
          : match);
    const source = r.dvids_url || r.asset_url;
    const evidence = this.evidenceFor(r);
    const tagsLine = ['#UAP', '#PURSUE', '#'+r.agency.replace(/\s+/g,''), r.incident_location ? '#'+r.incident_location.replace(/\s+/g,'') : ''].filter(Boolean).map(t=>`<span class="yt-tag">${escapeHtml(t)}</span>`).join('');
    const player = r.video_url
      ? `<video controls autoplay playsinline preload="metadata" poster="${escapeHtml(r.poster_url || '')}" src="${escapeHtml(r.video_url)}"></video>`
      : sourceVideo(r);
    return `
      <div class="yt-shell">
        <div class="yt-topbar">
          <div class="yt-topbar-left">
            <button class="icon-btn" id="ytClose" title="Back to UTube"><i class="material-icons">arrow_back</i></button>
            <span class="utube-play-glyph"><i class="material-icons">play_arrow</i></span>
            <span class="yt-brand">UTube</span>
          </div>
          <form class="yt-search-wrap" id="ytSearchForm">
            <input id="ytSearch" placeholder="Search UTube" aria-label="Search UTube" />
            <button class="yt-search-btn" aria-label="Search"><i class="material-icons">search</i></button>
          </form>
          <div class="yt-topbar-right">
            <span class="material-icons" title="Notifications">notifications</span>
            <span class="avatar-circle small" style="background:#9334e9">DT</span>
          </div>
        </div>
        <div class="yt-body">
          <div class="yt-main">
            <div class="yt-player">${player}<div id="ytFallback" class="yt-fallback" hidden>
              <p>This video could not load.</p>${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noreferrer">Watch at the official source</a>` : ''}
            </div></div>
            <h1 class="yt-title" id="ytTitle">${escapeHtml(title)}</h1>
            <div class="yt-channel-row">
              <div class="yt-channel">
                <span class="yt-channel-avatar" style="background:${ag.color}">${ag.initials}</span>
                <div class="yt-channel-info">
                  <div class="yt-channel-name">${escapeHtml(ag.short)} <i class="material-icons" style="font-size:14px;color:#aaa;vertical-align:middle">verified</i></div>
                  <div class="yt-channel-subs">${r.id.toUpperCase()} &middot; Archive record</div>
                </div>

              </div>
              <div class="yt-actions">
                <button class="yt-action-btn" id="ytLike">
                  <i class="material-icons">thumb_up</i><span class="lk-cnt" data-base="${baseLikes}">${baseLikes.toLocaleString()}</span>
                </button>
                <button class="yt-action-btn" id="ytShare">
                  <i class="material-icons">share</i> <span>Share</span>
                </button>
                <button class="yt-action-btn" id="ytSave">
                  <i class="material-icons">bookmark_add</i> <span>Save</span>
                </button>
                ${r.video_url ? `<a class="yt-action-btn" href="${escapeHtml(r.video_url)}" target="_blank" rel="noreferrer"><i class="material-icons">open_in_new</i> MP4</a>` : ''}
              </div>
            </div>
            <input id="ytShareLink" aria-label="Shareable video link" readonly hidden>
            <div class="yt-desc">
              <div class="yt-desc-meta">
                <strong>${views} views</strong> · ${escapeHtml(dateLabel)} · Release ${String(r.release || 1).padStart(2, '0')} · ${escapeHtml(fmtRelDate(r.release_date))}
              </div>
              <div class="yt-tags">${tagsLine}</div>
              <div class="yt-desc-body">${desc}</div>
              ${source ? `<div class="yt-desc-link"><a href="${escapeHtml(source)}" target="_blank" rel="noreferrer">View official video record</a></div>` : ''}
              <button class="yt-show-more" id="ytShowDesc">Show more</button>
            </div>
            ${evidence.length ? `<section class="yt-evidence"><h2>Paired evidence</h2>${evidence.map(record =>
              `<button data-evidence="${record.id}" class="yt-action-btn">${escapeHtml(fmtTitle(record.title))}</button>`).join('')}</section>` : ''}
            <div class="yt-comments-section" id="ytComments"></div>
          </div>
          <aside class="yt-sidebar" id="ytSidebar"></aside>
        </div>
      </div>`;
  },
  evidenceFor(video) {
    const code = title => (title || '').split(',')[0].trim().toUpperCase();
    const pairs = (video.pdf_pairing || '').toUpperCase().split(/[,;\s]+/).filter(Boolean);
    return state.enriched.filter(record => record.type !== 'VID' &&
      (pairs.includes(code(record.title)) ||
        (record.video_pairing || '').toUpperCase().split(/[,;\s]+/).includes(code(video.title))));
  },
  bindRelated(overlay, r) {
    const others = state.enriched.filter(x => x.type === 'VID' && x.id !== r.id);
    // Prefer same-region / same-agency
    const score = x => (r.incident_location && r.incident_location !== 'N/A' && x.incident_location === r.incident_location ? 4 : 0) +
      ((x.release || 1) === (r.release || 1) ? 2 : 0) + (x.agency === r.agency ? 1 : 0);
    const list = others.sort((a,b) => score(b) - score(a)).slice(0, 12);
    const html = list.map(x => {
      const ag = AGENCIES[x.agency];
      const title = x.video_title || fmtTitle(x.title);
      const dur = Views.utube.duration(x);
      const poster = x.poster_url || x.thumbnail_url || x.thumbnail_local || '';
      return `
        <button class="yt-related" data-id="${x.id}">
          <div class="yt-related-thumb">
            ${poster ? `<img loading="lazy" decoding="async" src="${escapeHtml(poster)}" alt="">` : ''}
            <span class="yt-related-dur">${dur}</span>
          </div>
          <div class="yt-related-meta">
            <div class="yt-related-title">${escapeHtml(title)}</div>
            <div class="yt-related-chan">${escapeHtml(ag.short)}</div>
            <div class="yt-related-stats">Release ${String(x.release || 1).padStart(2,'0')} &middot; ${escapeHtml(fmtRelDate(x.release_date))}</div>
          </div>
        </button>`;
    }).join('');
    overlay.querySelector('#ytSidebar').innerHTML = '<h2 class="yt-related-heading">Related videos</h2>' + html;
    overlay.querySelectorAll('.yt-related').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.id;
      const next = state.byId[id];
      if (next) this.openYouTube(next);
    }));
  },
  close(restoreFocus = true) {
    if (!this.current) return;
    this.current.querySelector('video')?.pause();
    this.current.remove();
    this.current = null;
    document.removeEventListener('keydown', this._esc);
    if (restoreFocus) this.trigger?.focus();
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
    const thumb = r.thumbnail_local || r.thumbnail_url || '';
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
  pdfFilter: 'all',  // for documents source, optional pdf_id filter
  query: '',
  lightboxIdx: -1,
  lightboxList: [],
  mount() {
    const main = document.getElementById('appMain');
    main.classList.remove('bg-flush');
    const docCount = (state.pdfImages || []).length;
    const docPdfCount = new Set((state.pdfImages || []).map(p => p.pdf_id)).size;
    main.innerHTML = `
      <div class="uphotos">
        <div class="uphotos-head">
          <div class="uphotos-title">UPhotos · UAP photographs</div>
          <div class="uphotos-tabs" id="uphotosSource">
            <button class="ut-btn ${this.source==='official'?'active':''}" data-s="official">Official photo releases (${state.enriched.filter(r=>r.type==='IMG').length})</button>
            <button class="ut-btn ${this.source==='documents'?'active':''}" data-s="documents">Embedded in documents (${docCount.toLocaleString()} from ${docPdfCount} files)</button>
          </div>
          <div class="uphotos-search" style="flex:1;display:flex;justify-content:flex-end">
            <input id="uphotosQ" type="search" placeholder="Filter by document title or location\u2026" value="${escapeHtml(this.query)}" style="width:300px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:13px" />
          </div>
        </div>
        <div class="uphotos-tabs" id="uphotosChips" style="margin-top:10px"></div>
        <div id="uphotosPdfFilter" style="margin-top:6px"></div>
        <div class="uphotos-grid" id="uphotosGrid"></div>
      </div>`;
    document.querySelectorAll('#uphotosSource .ut-btn').forEach(b => b.addEventListener('click', () => {
      this.source = b.dataset.s;
      this.filter = 'all';
      this.pdfFilter = 'all';
      this.mount();
    }));
    const qi = document.getElementById('uphotosQ');
    if (qi) qi.addEventListener('input', (e) => { this.query = e.target.value; this.render(); });
    this.renderChips();
    this.renderPdfFilter();
    this.render();
  },
  renderPdfFilter() {
    const host = document.getElementById('uphotosPdfFilter');
    if (!host) return;
    if (this.source !== 'documents') { host.innerHTML = ''; return; }
    const counts = {};
    (state.pdfImages || []).forEach(p => {
      if (this.filter !== 'all' && p.agency !== this.filter) return;
      counts[p.pdf_id] = counts[p.pdf_id] || { count: 0, title: p.pdf_title, agency: p.agency };
      counts[p.pdf_id].count++;
    });
    const entries = Object.entries(counts).sort((a,b) => b[1].count - a[1].count).slice(0, 60);
    if (!entries.length) { host.innerHTML = ''; return; }
    host.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
      <span style="font-size:11px;color:#5f6368;text-transform:uppercase;letter-spacing:.5px;margin-right:6px">Source PDF:</span>
      <button class="chip ${this.pdfFilter==='all'?'active':''}" data-pid="all" style="background:var(--surface-2);border:1px solid var(--line);padding:4px 9px;border-radius:6px;font-size:11px;cursor:pointer">All</button>
      ${entries.map(([id,info]) => `<button class="chip ${this.pdfFilter===id?'active':''}" title="${escapeHtml(info.title)}" data-pid="${id}" style="background:var(--surface-2);border:1px solid var(--line);padding:4px 9px;border-radius:6px;font-size:11px;cursor:pointer">${escapeHtml(fmtTitle(info.title).slice(0, 40))}${info.title.length>40?'\u2026':''} <em style="opacity:.6;font-style:normal">${info.count}</em></button>`).join('')}
    </div>`;
    host.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      this.pdfFilter = b.dataset.pid;
      host.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.pid===this.pdfFilter));
      this.render();
    }));
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
      this.pdfFilter = 'all';
      chips.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.k===this.filter));
      this.renderPdfFilter();
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
      if (this.pdfFilter !== 'all') items = items.filter(p => p.pdf_id === this.pdfFilter);
      const localQ = (this.query || '').toLowerCase().trim();
      const globalQ = state.search ? state.search.toLowerCase() : '';
      if (localQ) items = items.filter(p => (p.pdf_title + ' ' + (p.incident_location||'') + ' ' + (p.agency||'')).toLowerCase().includes(localQ));
      if (globalQ) items = items.filter(p => (p.pdf_title + ' ' + (p.incident_location||'')).toLowerCase().includes(globalQ));
      this.lightboxList = items.map(p => ({ kind:'doc', r: state.byId[p.pdf_id],
        full: p.image, thumb: p.thumb || p.image,
        title: fmtTitle(p.pdf_title),
        sub: `${AGENCIES[p.agency].short} \u00b7 ${p.incident_location || 'Unknown'}${p.page ? ' \u00b7 page ' + p.page : ''} \u00b7 ${p.incident_date || 'Released ' + fmtRelDate(state.byId[p.pdf_id]?.release_date||'')}`,
        link: p.pdf_url, w: p.w, h: p.h, page: p.page
      }));
      grid.innerHTML = this.lightboxList.length ? this.lightboxList.map((p, i) => this.cardHtmlDoc(p, i)).join('') :
        `<div style="grid-column:1/-1;padding:60px;text-align:center;color:#5f6368">No embedded images match this filter.</div>`;
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
        ${p.page ? `<div class="photo-page-tag">p.${p.page}</div>` : ''}
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

/* ============== UEarth · UAP Atlas ============== */
Views.uearth = {
  globe: null,
  mode: 'pins',
  query: '',
  release: 0,
  agency: '',
  from: '',
  to: '',
  selected: null,
  mount() {
    const main = document.getElementById('appMain');
    main.classList.add('bg-flush');
    main.innerHTML = `
      <div class="uearth">
        <div class="map-wrap">
          <div class="uearth-globe" id="uearthGlobe"></div>
          <div class="uearth-overlay">
            <div class="uearth-overlay-row">
              <div class="uearth-pill"><i class="material-icons">public</i><strong>UEarth</strong> · UAP Atlas</div>
              <div class="uearth-mode" id="uearthMode">
                <button data-mode="pins">Pins</button>
                <button data-mode="density">Density</button>
                <button id="uearthRotate" aria-label="Auto-rotate" aria-pressed="false"><i class="material-icons">rotate_right</i></button>
                <button id="uearthHome" aria-label="Reset map view"><i class="material-icons">restart_alt</i></button>
              </div>
            </div>
          </div>
          <div class="uearth-globe-empty" id="uearthFallback" hidden>
            <i class="material-icons">public</i><p>3D globe unavailable. You can still explore the records below or in the sidebar.</p>
          </div>
        </div>
        <aside class="uearth-side">
          <header class="uearth-side-head">
            <h3>Explore the archive</h3>
            <p>Pins show approximate reported locations. Density counts archive records, and several records can describe the same incident.</p>
          </header>
          <form class="uearth-filters" id="uearthFilters">
            <input type="search" name="query" placeholder="Search places or records" aria-label="Search places or records">
            <div class="uearth-filter-row">
              <label>Release<select name="release"><option value="0">All releases</option>${Array.from({length:8}, (_, i) => `<option value="${i+1}">Release ${String(i+1).padStart(2,'0')}</option>`).join('')}</select></label>
              <label>Agency<select name="agency"><option value="">All agencies</option>${[...new Set(state.enriched.map(r => r.agency))].sort().map(a => `<option value="${escapeHtml(a)}">${escapeHtml(AGENCIES[a]?.short || a)}</option>`).join('')}</select></label>
            </div>
            <div class="uearth-filter-row">
              <label>From year<input type="number" name="from" placeholder="Any" min="1900" max="2100"></label>
              <label>To year<input type="number" name="to" placeholder="Any" min="1900" max="2100"></label>
              <button type="button" class="uearth-link" id="uearthClear">Clear filters</button>
            </div>
          </form>
          <div class="uearth-stats" id="uearthStats" aria-live="polite"></div>
          <div id="uearthResults"></div>
          <div class="uearth-credit">Globe rendered with <a href="https://globe.gl/" target="_blank" rel="noreferrer">globe.gl</a> · Release 01 map data includes the <a href="https://github.com/AlexZhangji/ufo-pursue-open-atlas" target="_blank" rel="noreferrer">PURSUE Open Atlas</a>.</div>
        </aside>
      </div>`;
    this.host = document.getElementById('uearthGlobe');
    const form = document.getElementById('uearthFilters');
    const fields = ['query', 'release', 'agency', 'from', 'to'];
    fields.forEach(key => { form.elements[key].value = this[key]; });
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', () => {
      fields.forEach(key => { this[key] = form.elements[key].value; });
      this.selected = null;
      this.render();
    });
    document.getElementById('uearthClear').onclick = () => {
      form.reset();
      form.dispatchEvent(new Event('input'));
    };
    document.querySelectorAll('#uearthMode [data-mode]').forEach(button => {
      button.onclick = () => { this.mode = button.dataset.mode; this.render(); };
    });
    const rotate = document.getElementById('uearthRotate');
    rotate.onclick = () => this.setRotation(!this.globe?.controls().autoRotate);
    document.getElementById('uearthHome').onclick = () => {
      this.selected = null;
      this.globe?.pointOfView({ lat: 22, lng: 12, altitude: 2.6 }, this.motion());
      this.setRotation(false);
      this.render();
    };
    this.initGlobe();
    this.render();
  },
  unmount() {
    this.resizeObserver?.disconnect();
    this.globe?._destructor?.();
    this.globe = null;
  },
  motion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
  },
  setRotation(active) {
    if (!this.globe) return;
    this.globe.controls().autoRotate = active;
    const button = document.getElementById('uearthRotate');
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  },
  initGlobe() {
    const host = this.host;
    try {
      this.globe = Globe()(host)
        .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg')
        .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/night-sky.png')
        .atmosphereColor('#528cff')
        .atmosphereAltitude(0.17)
        .pointOfView({ lat: 22, lng: 12, altitude: 2.6 }, 0);
      this.globe.controls().autoRotateSpeed = 0.45;
      this.resizeObserver = new ResizeObserver(() => {
        this.globe?.width(host.clientWidth).height(host.clientHeight);
      });
      this.resizeObserver.observe(host);
    } catch {
      this.unmount();
      host.replaceChildren();
      document.getElementById('uearthMode').hidden = true;
      document.getElementById('uearthFallback').hidden = false;
    }
  },
  isOffEarth(r) {
    return /^(?:low[- ]earth orbit|moon|cislunar space)$/i.test((r.incident_location || '').trim());
  },
  coords(r) {
    if (this.isOffEarth(r)) return null;
    return [[r.atlas_lat, r.atlas_lng], r.coords, [r.lat_base, r.lng_base]].find(pair =>
      pair && Number.isFinite(pair[0]) && Number.isFinite(pair[1]) &&
      Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180);
  },
  render() {
    const q = this.query.trim().toLowerCase();
    const items = state.enriched.filter(r => {
      const year = r.date_parsed?.year || r.year;
      return (!Number(this.release) || (r.release || 1) === Number(this.release)) &&
        (!this.agency || r.agency === this.agency) &&
        (!this.from || year >= Number(this.from)) &&
        (!this.to || year <= Number(this.to)) &&
        (!q || [r.title, fmtTitle(r.title), r.incident_location, r.id].join(' ').toLowerCase().includes(q));
    });

    const locations = new Map();
    const unmapped = [];
    const offEarth = [];
    for (const record of items) {
      const coords = this.coords(record);
      if (!coords) {
        (this.isOffEarth(record) ? offEarth : unmapped).push(record);
        continue;
      }
      const [lat, lng] = coords;
      const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      if (!locations.has(key)) locations.set(key, {key, lat, lng, records: []});
      locations.get(key).records.push(record);
    }
    const groups = [...locations.values()].sort((a, b) => b.records.length - a.records.length);
    const selection = this.selected;
    const records = selection ? selection.records : null;
    const resultHost = document.getElementById('uearthResults');
    document.getElementById('uearthStats').innerHTML = `
      <div><strong>${items.length}</strong> matching records</div>
      <div><strong>${items.length - unmapped.length - offEarth.length}</strong> mapped records</div>
      <div><strong>${groups.length}</strong> map locations</div>
      <div><strong>${unmapped.length + offEarth.length}</strong> outside the map</div>`;

    if (records) {
      resultHost.innerHTML = `<button class="uearth-link" id="uearthBack">← All matching locations</button>
        <h4>${escapeHtml(selection.label)}</h4>${this.recordList(records)}`;
      document.getElementById('uearthBack').onclick = () => {
        this.selected = null;
        this.render();
      };
    } else {
      resultHost.innerHTML = `<h4>Locations</h4><ul class="uearth-results">${groups.map((g, i) => `
        <li><button data-location="${i}"><span>${escapeHtml(this.locationLabel(g))}</span><b>${g.records.length}</b></button></li>`).join('')}</ul>
        ${groups.length ? '' : '<p>No mapped records match these filters.</p>'}
        ${offEarth.length ? `<details><summary>Off-Earth records (${offEarth.length})</summary>${this.recordList(offEarth)}</details>` : ''}
        ${unmapped.length ? `<details ${groups.length ? '' : 'open'}><summary>Records without map coordinates (${unmapped.length})</summary>${this.recordList(unmapped)}</details>` : ''}`;
      resultHost.querySelectorAll('[data-location]').forEach(button => {
        button.onclick = () => this.focus(groups[Number(button.dataset.location)]);
      });
    }

    resultHost.querySelectorAll('[data-record]').forEach(button => {
      button.onclick = () => openRecord(state.byId[button.dataset.record]._idx);
    });
    document.querySelectorAll('#uearthMode [data-mode]').forEach(button => {
      const active = button.dataset.mode === this.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    this.renderMap(groups);
  },
  locationLabel(group) {
    const labels = [...new Set(group.records.map(r => r.incident_location).filter(loc => loc && loc !== 'N/A'))];
    return labels.join(' / ') || `${group.lat.toFixed(2)}, ${group.lng.toFixed(2)}`;
  },
  recordList(records) {
    return `<ul class="uearth-results">${records.map(r => `<li><button data-record="${r.id}">
      <span>${escapeHtml(fmtTitle(r.title))}<small>${escapeHtml(r.agency)} · ${r.type} · Release ${String(r.release || 1).padStart(2,'0')}</small></span>
      <i class="material-icons">chevron_right</i></button></li>`).join('')}</ul>`;
  },
  focus(group) {
    this.selected = { label: this.locationLabel(group), records: group.records };
    this.setRotation(false);
    this.globe?.pointOfView({ lat: group.lat, lng: group.lng, altitude: 1.15 }, this.motion());
    this.render();
    document.getElementById('uearthBack').focus({preventScroll:true});
  },
  renderMap(groups) {
    const globe = this.globe;
    if (!globe) return;
    if (this.mode === 'density') {
      globe.htmlElementsData([])
        .hexBinPointLat('lat').hexBinPointLng('lng').hexBinPointWeight(g => g.records.length)
        .hexBinResolution(3).hexBinMerge(false)
        .hexAltitude(d => Math.min(.36, .035 + .02 * d.sumWeight))
        .hexTopColor(d => d.sumWeight > 5 ? '#ffbb69' : '#6aaaff')
        .hexSideColor(() => '#3e68aa')
        .hexLabel(d => `${d.sumWeight} archive records`)
        .onHexClick(d => this.focus({ ...d.points[0], records: d.points.flatMap(g => g.records) }))
        .hexBinPointsData(groups);
      return;
    }
    globe.hexBinPointsData([])
      .htmlElement(group => {
        const button = document.createElement('button');
        button.className = 'uearth-marker';
        const count = group.records.length;
        button.textContent = count > 1 ? count : '';
        button.title = `${this.locationLabel(group)} · ${count} record${count === 1 ? '' : 's'}`;
        button.setAttribute('aria-label', button.title);
        button.onclick = event => { event.stopPropagation(); this.focus(group); };
        return button;
      })
      .htmlElementsData(groups);
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
  axis: 'incident',
  view: 'timeline',
  release: 'all',
  year: 'all',
  query: '',
  month: null,
  mount() {
    const main = document.getElementById('appMain');
    main.classList.remove('bg-flush');
    main.innerHTML = `
      <div class="ucalendar">
        <div class="uc-head">
          <div class="uc-title"><span class="uc-cube"><i class="material-icons">event</i></span> UCalendar</div>
          <div class="uc-toggle" aria-label="Calendar layout">
            <button data-v="timeline">Timeline</button><button data-v="months">By month</button>
          </div>
        </div>
        <form class="uc-filters" id="ucFilters">
          <label>Date basis<select name="axis"><option value="incident">Reported incident dates</option><option value="release">Publication dates</option></select></label>
          <label>Release<select name="release"><option value="all">All releases</option>${Array.from({length:8}, (_, i) => `<option value="${i+1}">Release ${String(i+1).padStart(2,'0')}</option>`).join('')}</select></label>
          <label>Year<select name="year"></select></label>
          <label class="uc-search">Search<input type="search" name="query" placeholder="Title, place, agency, or record ID"></label>
        </form>
        <p id="ucStatus" class="uc-status" aria-live="polite"></p>
        <div id="ucBody"></div>
      </div>`;
    const form = document.getElementById('ucFilters');
    for (const key of ['axis', 'release', 'query']) form.elements[key].value = this[key];
    form.onsubmit = event => event.preventDefault();
    form.oninput = event => {
      this[event.target.name] = event.target.value;
      if (event.target.name === 'axis') this.year = 'all';
      this.month = null;
      this.render();
    };
    main.querySelectorAll('.uc-toggle button').forEach(button => {
      button.onclick = () => {
        this.view = button.dataset.v;
        this.month = null;
        this.render();
      };
    });
    this.render();
  },
  date(record) {
    if (this.axis === 'incident') return record.date_parsed;
    const [month, day, year] = record.release_date.split('/').map(Number);
    return {year: year < 100 ? year + 2000 : year, month, day, label: fmtRelDate(record.release_date)};
  },
  render() {
    const q = this.query.trim().toLowerCase();
    const entries = state.enriched
      .filter(r => (this.release === 'all' || (r.release || 1) === Number(this.release)) &&
        (!q || [r.id, fmtTitle(r.title), r.agency, r.incident_location].join(' ').toLowerCase().includes(q)))
      .map(r => ({r, date: this.date(r)}));
    const years = [...new Set(state.enriched.map(r => this.date(r)?.year).filter(Boolean))].sort((a,b) => b-a);
    const yearSelect = document.querySelector('#ucFilters [name=year]');
    const yearOptions = '<option value="all">All years</option>' + years.map(y => `<option>${y}</option>`).join('');
    if (yearSelect.options.length !== years.length + 1 || yearSelect.options[1]?.value !== String(years[0])) {
      yearSelect.innerHTML = yearOptions;
    }
    yearSelect.value = this.year;
    const undated = entries.filter(e => !e.date?.year);
    const dated = entries.filter(e => e.date?.year && (this.year === 'all' || e.date.year === Number(this.year)))
      .sort((a,b) => b.date.year-a.date.year || (b.date.month||0)-(a.date.month||0) || (b.date.day||0)-(a.date.day||0));
    const groups = new Map();
    for (const entry of dated) {
      const key = `${entry.date.year}-${entry.date.month || 0}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    const months = ['Month unspecified','January','February','March','April','May','June','July','August','September','October','November','December'];
    const heading = key => {
      const [year, month] = key.split('-');
      return month === '0' ? `${year} · Month unspecified` : `${months[Number(month)]} ${year}`;
    };
    document.querySelectorAll('.uc-toggle button').forEach(button => {
      const active = button.dataset.v === this.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    const visible = this.month ? groups.get(this.month) || [] : dated;
    document.getElementById('ucStatus').textContent = `${visible.length} dated records${this.axis === 'incident' && undated.length ? ` · ${undated.length} without a usable incident date` : ''}`;
    const body = document.getElementById('ucBody');
    const sections = this.month ? [[this.month, visible]] : [...groups];
    body.innerHTML = this.view === 'months'
      ? `<div class="uc-month-grid">${[...groups].map(([key, records]) => `
          <button class="uc-month-card" data-month="${key}"><span class="uc-mon">${heading(key)}</span><span class="uc-cnt">${records.length}</span></button>`).join('')}</div>`
      : `<div class="uc-timeline">${this.month ? '<button class="chip" id="ucBack">← All months</button>' : ''}${sections.map(([key, records]) => `
          <h3 class="uc-year">${heading(key)} · ${records.length} records</h3>${this.recordRows(records)}`).join('')}</div>`;
    if (!dated.length) body.innerHTML = '<p class="uc-status">No dated records match these filters.</p>';
    if (this.axis === 'incident' && this.year === 'all' && !this.month && undated.length) {
      body.insertAdjacentHTML('beforeend', `<details class="uc-timeline"><summary>Browse records without a usable incident date (${undated.length})</summary>${this.recordRows(undated)}</details>`);
    }
    body.querySelectorAll('[data-month]').forEach(button => {
      button.onclick = () => {
        this.month = button.dataset.month;
        this.view = 'timeline';
        this.render();
        document.getElementById('ucBack').focus();
      };
    });
    const back = document.getElementById('ucBack');
    if (back) back.onclick = () => { this.view = 'months'; this.month = null; this.render(); };
    body.querySelectorAll('[data-record]').forEach(button => {
      button.onclick = () => openRecord(state.byId[button.dataset.record]._idx);
    });
  },
  recordRows(entries) {
    return entries.map(({r, date}) => `<button class="uc-event" data-record="${r.id}">
      <span class="uc-date">${escapeHtml(date?.label || r.incident_date || 'Date unknown')}</span>
      <span class="uc-loc">${escapeHtml(r.incident_location === 'N/A' ? 'Location unspecified' : r.incident_location || 'Location unspecified')}</span>
      <span class="uc-detail"><span class="uc-tag">${r.type}</span>${escapeHtml(fmtTitle(r.title))}
      <small>${escapeHtml(r.agency)} · Release ${String(r.release || 1).padStart(2,'0')}</small></span>
      <i class="material-icons" aria-hidden="true">chevron_right</i>
    </button>`).join('');
  }
};

/* ============== Umeni view ============== */
Views.umeni = {
  mount() {
    const main = document.getElementById('appMain');
    main.classList.remove('bg-flush');
    main.innerHTML = `
      <div class="umeni-workspace">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px">
          <span class="dock-glyph umeni-glyph" style="width:44px;height:44px;font-size:24px">✦</span>
          <h1 style="font-family:'Google Sans';font-size:32px;font-weight:500;margin:0;background:linear-gradient(135deg,#9334e9,#1a73e8 60%,#34a853);-webkit-background-clip:text;background-clip:text;color:transparent">Hello, Mr. President</h1>
        </div>
        <p style="color:#5f6368;font-size:16px;margin:0 0 24px">Investigate ${state.enriched.length} archive records. Open a cited record or PDF page to check the evidence.</p>
        <div id="umeniSuggestRow" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px"></div>
        <div id="umeniMain" role="log" aria-label="Research conversation" style="background:#fff;border-radius:16px;border:1px solid #e8eaed;padding:18px 18px 8px"></div>
        <form id="umeniInlineForm" style="display:flex;gap:10px;margin-top:14px;align-items:center;background:#fff;border-radius:99px;border:1px solid #dadce0;padding:6px 6px 6px 16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
          <i class="material-icons" style="color:#5f6368">auto_awesome</i>
          <input aria-label="Ask Umeni" id="umeniInlineInput" placeholder="Ask Umeni — e.g. What did Frank Borman report on Gemini 7?" style="flex:1;border:none;outline:none;font-size:15px;padding:10px 0;background:transparent" />
          <button type="submit" class="primary-btn" style="border-radius:99px;padding:10px 22px">Ask</button>
        </form>
      </div>`;

    const suggestions = [
      'How many videos are in Release 08?',
      'Summarise Release 07.',
      'Find PDF passages about Project Blue Book.',
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
    if (this.conversation) document.getElementById('umeniMain').replaceWith(this.conversation);
    this.conversation = document.getElementById('umeniMain');
    if (!this.conversation.childElementCount) {
      this.conversation.innerHTML = '<p class="muted">Pick a question above or ask about a record, place, or release.</p>';
    }
  }
};

/* ============== Umail view ============== */
Views.umail = { mount() { renderInbox(); } };

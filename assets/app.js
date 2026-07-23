(function () {
  var INDEX = window.SEARCH_INDEX || [];
  var COURSES = window.COURSES || [];

  var input = document.getElementById('search-input');
  var box = document.getElementById('search-box');
  var panel = document.getElementById('results-panel');
  var grid = document.getElementById('modules-grid');
  var filterWrap = document.getElementById('modules-filter');
  var continueWrap = document.getElementById('continue-wrap');

  var flatResults = [];
  var activeIdx = -1;

  function urlFor(entry) {
    var params = [];
    if (entry.sec) params.push('sec=' + encodeURIComponent(entry.sec));
    if (entry.page) params.push('page=' + encodeURIComponent(entry.page));
    if (entry.nb) params.push('nb=' + encodeURIComponent(entry.nb));
    var qs = params.length ? '?' + params.join('&') : '';
    return 'notes/' + entry.file + qs;
  }

  function score(entry, q) {
    var t = entry.title.toLowerCase();
    var g = (entry.group || '').toLowerCase();
    var c = entry.courseTitle.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 90;
    if (t.includes(q)) return 70;
    if (g.includes(q)) return 40;
    if (c.includes(q)) return 30;
    return 0;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var scored = [];
    for (var i = 0; i < INDEX.length; i++) {
      var s = score(INDEX[i], q);
      if (s > 0) scored.push({ e: INDEX[i], s: s });
    }
    scored.sort(function (a, b) { return b.s - a.s || a.e.title.localeCompare(b.e.title); });
    return scored.slice(0, 40).map(function (x) { return x.e; });
  }

  function renderResults(q) {
    var results = search(q);
    flatResults = results;
    activeIdx = results.length ? 0 : -1;

    if (!q.trim()) {
      panel.classList.remove('open');
      panel.innerHTML = '';
      return;
    }

    if (!results.length) {
      panel.innerHTML = '<div class="results-empty">No topics match "' + escapeHtml(q) + '". Try a different term.</div>';
      panel.classList.add('open');
      return;
    }

    var byCourse = {};
    var order = [];
    results.forEach(function (r) {
      if (!byCourse[r.course]) { byCourse[r.course] = []; order.push(r.course); }
      byCourse[r.course].push(r);
    });

    var html = '';
    var flatIdx = 0;
    order.forEach(function (courseId) {
      var items = byCourse[courseId];
      html += '<div class="results-group-label">' + items[0].courseIcon + ' ' + escapeHtml(items[0].courseTitle) + '</div>';
      items.forEach(function (r) {
        html += '<div class="result-item' + (flatIdx === activeIdx ? ' active' : '') + '" data-idx="' + flatIdx + '" role="option">' +
          '<span class="r-icon">' + r.icon + '</span>' +
          '<span class="r-title">' + escapeHtml(r.title) + '</span>' +
          '<span class="r-meta">' + escapeHtml(r.group || '') + '</span>' +
          '</div>';
        flatIdx++;
      });
    });
    html += '<div class="results-footer"><span><kbd>&uarr;&darr;</kbd>navigate</span><span><kbd>&crarr;</kbd>open</span><span><kbd>esc</kbd>close</span></div>';

    panel.innerHTML = html;
    panel.classList.add('open');

    panel.querySelectorAll('.result-item').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        activeIdx = parseInt(el.getAttribute('data-idx'), 10);
        highlightActive();
      });
      el.addEventListener('click', function () {
        var idx = parseInt(el.getAttribute('data-idx'), 10);
        goToResult(flatResults[idx]);
      });
    });
  }

  function highlightActive() {
    panel.querySelectorAll('.result-item').forEach(function (el) {
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      el.classList.toggle('active', idx === activeIdx);
      if (idx === activeIdx) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function goToResult(entry) {
    if (!entry) return;
    try {
      localStorage.setItem('hub_last_course', entry.course);
    } catch (e) { /* ignore */ }
    window.location.href = urlFor(entry);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  input.addEventListener('input', function () { renderResults(input.value); });
  input.addEventListener('focus', function () { box.classList.add('focused'); if (input.value.trim()) panel.classList.add('open'); });
  input.addEventListener('blur', function () { box.classList.remove('focused'); setTimeout(function () { panel.classList.remove('open'); }, 150); });

  input.addEventListener('keydown', function (e) {
    if (!flatResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, flatResults.length - 1);
      highlightActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      highlightActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goToResult(flatResults[activeIdx]);
    } else if (e.key === 'Escape') {
      input.value = '';
      panel.classList.remove('open');
      input.blur();
    }
  });

  // Global "/" or Cmd/Ctrl+K to focus search
  document.addEventListener('keydown', function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if ((e.key === '/' && tag !== 'INPUT') || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      input.focus();
    }
  });

  // ── Modules grid ─────────────────────────────────────
  var courseTopicCount = {};
  INDEX.forEach(function (e) { courseTopicCount[e.course] = (courseTopicCount[e.course] || 0) + 1; });

  function renderCards(filterTag) {
    var html = '';
    COURSES.forEach(function (c) {
      if (filterTag && filterTag !== 'all' && c.tags.indexOf(filterTag) === -1) return;
      html += '<a class="module-card" style="--accent:' + c.color + '" href="notes/' + c.file + '">' +
        '<div class="m-top">' +
        '<div class="m-icon">' + c.icon + '</div>' +
        '<div class="m-count">' + (courseTopicCount[c.id] || 0) + ' topics</div>' +
        '</div>' +
        '<h3>' + escapeHtml(c.title) + '</h3>' +
        '<p>' + escapeHtml(c.subtitle) + '</p>' +
        '<div class="m-tags">' + c.tags.map(function (t) { return '<span class="m-tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' +
        '<div class="m-arrow">&rarr;</div>' +
        '</a>';
    });
    if (!filterTag || filterTag === 'all') {
      html += '<div class="module-card placeholder"><div class="placeholder-inner"><span class="p-plus">+</span>More modules coming soon</div></div>';
    }
    grid.innerHTML = html;
  }

  function renderFilters() {
    var tagSet = {};
    COURSES.forEach(function (c) { c.tags.forEach(function (t) { tagSet[t] = true; }); });
    var tags = Object.keys(tagSet).sort();
    var html = '<div class="filter-chip active" data-tag="all">All</div>';
    tags.forEach(function (t) {
      html += '<div class="filter-chip" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</div>';
    });
    filterWrap.innerHTML = html;
    filterWrap.querySelectorAll('.filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        filterWrap.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        renderCards(chip.getAttribute('data-tag'));
      });
    });
  }

  renderFilters();
  renderCards('all');

  // ── Continue learning chip ───────────────────────────
  try {
    var last = localStorage.getItem('hub_last_course');
    if (last) {
      var c = COURSES.filter(function (x) { return x.id === last; })[0];
      if (c) {
        continueWrap.innerHTML = '<a class="continue-chip" href="notes/' + c.file + '">&#9654; Continue: ' + c.icon + ' ' + escapeHtml(c.title) + '</a>';
      }
    }
  } catch (e) { /* ignore */ }

  // Track visits when leaving via module cards too
  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.module-card:not(.placeholder)');
    if (!card) return;
    var href = card.getAttribute('href');
    var course = COURSES.filter(function (c) { return href && href.indexOf(c.file) !== -1; })[0];
    if (course) {
      try { localStorage.setItem('hub_last_course', course.id); } catch (err) { /* ignore */ }
    }
  });
})();

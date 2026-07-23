#!/usr/bin/env node
/**
 * build-index.js
 * ----------------------------------------------------------------------
 * Scans every note file listed in assets/courses.json and extracts its
 * topic list (from tocData objects, static TOC anchors, or notebook
 * lists) into one flat search index: assets/search-index.js
 *
 * Run this again any time you add/edit a note file:
 *   node build-index.js
 * ----------------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const NOTES_DIR = path.join(ROOT, 'notes');
const courses = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/courses.json'), 'utf8'));

let uid = 0;
const index = [];

function extractBalancedObject(text, startIdx) {
  // startIdx points at the opening '{'
  let depth = 0;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

// Pattern A: `const tocData = { p1: { title:'...', sections:[{label, links:[{href,icon,text}]}] }, ... }`
function extractTocData(html) {
  const m = html.match(/const\s+tocData\s*=\s*\{/);
  if (!m) return null;
  const braceStart = m.index + m[0].length - 1;
  const objText = extractBalancedObject(html, braceStart);
  if (!objText) return null;
  try {
    // eslint-disable-next-line no-new-func
    const data = new Function('return ' + objText)();
    const entries = [];
    Object.keys(data).forEach(pageId => {
      const page = data[pageId];
      (page.sections || []).forEach(sec => {
        (sec.links || []).forEach(link => {
          entries.push({
            title: link.text,
            icon: link.icon || '📄',
            group: sec.label || page.title,
            page: pageId,
            sec: link.href
          });
        });
      });
    });
    return entries;
  } catch (e) {
    console.warn('  ! failed to eval tocData:', e.message);
    return null;
  }
}

// Pattern B: static sidebar anchors, e.g.
//   <div class="toc-section-label">Foundations</div>
//   <a class="toc-link" href="#intro" ...><span class="toc-icon">📖</span>Introduction</a>
// or
//   <div class="nav-section-label">Foundation</div>
//   <a class="nav-item" href="#spark-cluster"><span class="dot"></span>Spark Cluster</a>
function extractStaticAnchors(html) {
  const labelRe = /class="(?:toc-section-label|nav-section-label)"[^>]*>([^<]*)</;
  const linkRe = /<a\s+class="(?:toc-link|nav-item)"[^>]*href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  // Find sidebar-only region so we don't pick up unrelated anchors elsewhere in the page.
  const sideMatch = html.match(/<(nav|aside|div)\s+(?:id="sidebar"|class="sidebar")[^>]*>([\s\S]*?)<\/\1>/);
  const scope = sideMatch ? sideMatch[0] : html;

  // Walk line by line, tracking the most recent group label.
  const lines = scope.split(/\n/);
  let currentGroup = null;
  const entries = [];
  for (const line of lines) {
    const labelMatch = line.match(labelRe);
    if (labelMatch) {
      currentGroup = labelMatch[1].trim();
      continue;
    }
    linkRe.lastIndex = 0;
    let lm;
    while ((lm = linkRe.exec(line))) {
      const sec = lm[1];
      let inner = lm[2];
      const iconMatch = inner.match(/<span[^>]*(?:toc-icon|icon)[^>]*>([^<]*)<\/span>/);
      const icon = iconMatch ? iconMatch[1].trim() : '📄';
      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (text) entries.push({ title: text, icon, group: currentGroup, page: null, sec });
    }
  }
  return entries.length ? entries : null;
}

// Pattern C: notebook-style sidebar, e.g.
//   <div class="toc-group-label">Part 1 — Foundations</div>
//   <div class="toc-item ..." onclick="openNotebook('nb-intro')" data-name="Introduction to PySpark">
//     <span class="nb-icon">📘</span><span class="nb-name">Introduction to PySpark</span> ...
//   </div>
function extractNotebookItems(html) {
  const blockRe = /<div class="toc-item[^"]*"\s+onclick="openNotebook\('([^']+)'\)"[^>]*data-name="([^"]*)"[^>]*>([\s\S]*?)<\/div>/g;
  const groupLabelRe = /<div class="toc-group-label">([^<]*)<\/div>/g;

  // Build an array of {index, group} markers, then match nearest preceding marker for each item.
  const markers = [];
  let gm;
  while ((gm = groupLabelRe.exec(html))) markers.push({ index: gm.index, group: gm[1].trim() });

  const entries = [];
  let bm;
  while ((bm = blockRe.exec(html))) {
    const nb = bm[1];
    const name = bm[2];
    const inner = bm[3];
    const iconMatch = inner.match(/<span class="nb-icon">([^<]*)<\/span>/);
    const icon = iconMatch ? iconMatch[1].trim() : '📓';
    let group = null;
    for (const mk of markers) {
      if (mk.index < bm.index) group = mk.group; else break;
    }
    entries.push({ title: name, icon, group, page: null, sec: nb, nb });
  }
  return entries.length ? entries : null;
}

console.log('Building search index...\n');

courses.forEach(course => {
  const filePath = path.join(NOTES_DIR, course.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`! missing file for course "${course.id}": ${course.file} (skipped)`);
    return;
  }
  const html = fs.readFileSync(filePath, 'utf8');

  let entries = extractTocData(html);
  let mode = 'tocData';
  if (!entries) { entries = extractNotebookItems(html); mode = 'notebook'; }
  if (!entries) { entries = extractStaticAnchors(html); mode = 'anchors'; }
  if (!entries) { entries = []; mode = 'none'; }

  console.log(`  ${course.id.padEnd(28)} ${mode.padEnd(10)} ${entries.length} topics`);

  entries.forEach(e => {
    index.push({
      id: 'i' + (uid++),
      course: course.id,
      file: course.file,
      courseTitle: course.title,
      courseIcon: course.icon,
      courseColor: course.color,
      group: e.group || null,
      title: e.title,
      icon: e.icon || '📄',
      page: e.page || null,
      nb: e.nb || null,
      sec: e.sec || null
    });
  });
});

const out = `// AUTO-GENERATED by build-index.js — do not edit by hand.\n// Regenerate with: node build-index.js\nwindow.SEARCH_INDEX = ${JSON.stringify(index, null, 2)};\nwindow.COURSES = ${JSON.stringify(courses, null, 2)};\n`;

fs.writeFileSync(path.join(ROOT, 'assets/search-index.js'), out);
console.log(`\nWrote assets/search-index.js — ${index.length} total topics across ${courses.length} courses.`);

# Learning Hub

A single searchable home for all your study notes. Open `index.html` to browse.

## Structure

```
learning-hub/
├── index.html            ← the hub homepage (search + module grid)
├── build-index.js         ← regenerates the search index (run with Node)
├── inject.py               ← one-time script that added the "back to hub" +
│                              deep-link support to each note file (already run)
├── assets/
│   ├── courses.json        ← list of modules shown on the homepage
│   ├── search-index.js     ← AUTO-GENERATED — don't edit by hand
│   ├── style.css
│   └── app.js
└── notes/
    ├── docker-complete-notes.html
    ├── git-github-notes.html
    └── ... (one file per module)
```

## How search works

Each note file already has its own sidebar / table-of-contents (built from a
`tocData` object, static anchor links, or a notebook list, depending on the
file). `build-index.js` reads every file listed in `assets/courses.json`,
extracts that table of contents automatically, and writes one combined list
to `assets/search-index.js`. The homepage searches that combined list and
deep-links straight to the right section inside the right file (using
`?sec=`, and `?page=` / `?nb=` when the target file needs to switch tabs or
notebooks first).

## Adding a new note file later

1. Drop the new `your-topic-notes.html` file into `notes/`.
2. Add an entry for it in `assets/courses.json`:
   ```json
   {
     "id": "kubernetes",
     "file": "kubernetes-notes.html",
     "title": "Kubernetes",
     "subtitle": "Pods, deployments, services & Helm",
     "icon": "☸️",
     "color": "#58a6ff",
     "tags": ["kubernetes", "devops"]
   }
   ```
3. Regenerate the index:
   ```bash
   node build-index.js
   ```
4. (Optional but recommended) Give the new file a "back to hub" button and
   deep-link support like the others by re-running:
   ```bash
   python3 inject.py
   ```
   It skips files that already have the integration, so it's safe to run
   any time.

That's it — the new module shows up on the homepage and its topics become
searchable immediately.

### If a new note file uses a different sidebar layout

`build-index.js` currently understands three sidebar patterns (see the
comments in the file): a `tocData` JS object, static `.toc-link` /
`.nav-item` anchor lists, or a notebook-style `.toc-item` list with
`data-name` attributes. If a future file uses a different pattern, either:
- match one of those existing patterns when you build the new notes page, or
- add a new `extract...()` function to `build-index.js` following the same
  pattern as the existing ones.

## Hosting

This is a fully static site — no build step or server required to view it.
Just open `index.html` in a browser, or upload the whole `learning-hub`
folder to GitHub Pages / Netlify / any static host.

Search results and the "Continue" chip use `localStorage` to remember the
module you last opened — this only persists in the browser you're using and
is never sent anywhere.

import re, os

NOTES_DIR = os.path.join(os.path.dirname(__file__), "notes")

SNIPPET = """
<!-- ══════════ Learning Hub integration (injected) ══════════ -->
<style>
  #hub-back-btn {
    position: fixed; top: 10px; right: 16px; z-index: 999;
    display: flex; align-items: center; gap: 6px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 12px; font-weight: 600; letter-spacing: .03em;
    color: #0a0a0a; background: #00ff88;
    padding: 7px 13px; border-radius: 20px; text-decoration: none;
    box-shadow: 0 2px 14px rgba(0,255,136,.35);
    transition: transform .15s ease, box-shadow .15s ease;
  }
  #hub-back-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 18px rgba(0,255,136,.5); }
  .search-highlight-pulse {
    animation: hubPulse 1.4s ease-out 2;
    border-radius: 10px;
  }
  @keyframes hubPulse {
    0%   { box-shadow: 0 0 0 0 rgba(0,255,136,.55); }
    70%  { box-shadow: 0 0 0 14px rgba(0,255,136,0); }
    100% { box-shadow: 0 0 0 0 rgba(0,255,136,0); }
  }
  @media (max-width: 640px) { #hub-back-btn span.lbl { display: none; } }
</style>
<a id="hub-back-btn" href="../index.html" title="Back to Learning Hub">&#8592; <span class="lbl">Hub</span></a>
<script>
(function () {
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  function go() {
    var page = getParam('page');
    var nb = getParam('nb');
    var sec = getParam('sec');
    try {
      if (page && typeof switchPage === 'function') {
        var tab = document.querySelector('.page-tab[onclick*="\\'' + page + '\\'"]');
        if (tab) switchPage(page, tab);
      }
    } catch (e) { /* noop */ }
    try {
      if (nb && typeof openNotebook === 'function') {
        var item = document.querySelector('.toc-item[onclick*="\\'' + nb + '\\'"]');
        document.querySelectorAll('.notebook-page').forEach(function(p){ p.classList.remove('active'); });
        var target = document.getElementById(nb);
        if (target) target.classList.add('active');
        document.querySelectorAll('.toc-item').forEach(function(el){ el.classList.remove('active'); });
        if (item) item.classList.add('active');
      }
    } catch (e) { /* noop */ }
    if (sec) {
      setTimeout(function () {
        var el = document.getElementById(sec);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('search-highlight-pulse');
          setTimeout(function () { el.classList.remove('search-highlight-pulse'); }, 3000);
        }
      }, 200);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go);
  } else {
    go();
  }
})();
</script>
"""

count = 0
for fname in os.listdir(NOTES_DIR):
    if not fname.endswith(".html"):
        continue
    path = os.path.join(NOTES_DIR, fname)
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    if "Learning Hub integration" in html:
        print(f"  {fname}: already injected, skipping")
        continue
    new_html = re.sub(r"</body>\s*</html>\s*$", SNIPPET + "\n</body>\n</html>\n", html, flags=re.IGNORECASE)
    if new_html == html:
        print(f"  ! {fname}: could not find </body></html> to inject before")
        continue
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_html)
    count += 1
    print(f"  {fname}: injected")

print(f"\nDone. {count} files updated.")

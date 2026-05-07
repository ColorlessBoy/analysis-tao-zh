/**
 * search.js — Full-text search engine
 */
window.Search = {
  sectionsData: null,
  isOpen: false,

  /** Index all sections for searching */
  index(chaptersData) {
    this.sectionsData = [];
    for (const chapter of (chaptersData || [])) {
      for (const section of (chapter.sections || [])) {
        this.sectionsData.push({
          id: section.number,
          chapter: chapter.number,
          title_en: section.title_en || '',
          title_zh: section.title_zh || '',
          content_en: section.content_en || '',
          content_zh: section.content_zh || '',
        });
      }
    }
  },

  /** Open search overlay */
  open() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input');
    if (!overlay) return;
    overlay.classList.add('is-open');
    this.isOpen = true;
    input.value = '';
    input.focus();
    this.renderResults('');
  },

  /** Close search overlay */
  close() {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    this.isOpen = false;
  },

  /** Run search and render results */
  renderResults(query) {
    const resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;

    if (!query || query.trim().length === 0) {
      resultsEl.innerHTML = '<div class="search-empty">输入关键词搜索中英文内容…</div>';
      return;
    }

    const results = this.search(query.trim());
    if (results.length === 0) {
      resultsEl.innerHTML = `<div class="search-empty">未找到"${this._escHtml(query)}"相关结果</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    results.forEach((result, idx) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.dataset.chapter = result.chapter;
      item.dataset.section = result.id;

      const title = window.App.currentLang === 'zh' ? result.title_zh : result.title_en;
      const snippet = this._escHtml(result.snippet);

      item.innerHTML = `
        <div class="search-result-title">${result.id} ${this._escHtml(title)}</div>
        <div class="search-result-snippet">…${snippet}…</div>
      `;

      item.addEventListener('click', () => {
        window.App.navigate(result.chapter, result.id);
        this.close();
      });

      frag.appendChild(item);
    });

    resultsEl.innerHTML = '';
    resultsEl.appendChild(frag);
  },

  /** Search helper — returns matched results with snippets */
  search(query) {
    if (!this.sectionsData) return [];
    const q = query.toLowerCase();
    const results = [];

    for (const section of this.sectionsData) {
      const zhIdx = (section.content_zh + section.title_zh).indexOf(query);
      const enIdx = (section.content_en + section.title_en).toLowerCase().indexOf(q);

      let snippet = '';
      if (zhIdx >= 0) {
        snippet = this._getSnippet(section.content_zh, zhIdx, query.length);
      } else if (enIdx >= 0) {
        snippet = this._getSnippet(section.content_en, enIdx, query.length);
      } else {
        // fuzzy: check if query words appear
        const words = query.split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) continue;
        let found = false;
        for (const w of words) {
          if (section.content_en.toLowerCase().includes(w) || section.content_zh.includes(w)) {
            found = true;
            break;
          }
        }
        if (!found) continue;
        // Use first 80 chars as generic snippet
        const raw = (section.content_en || section.content_zh || '').trim();
        snippet = raw.slice(0, 80);
      }

      if (snippet) {
        results.push({
          chapter: section.chapter,
          id: section.id,
          title_en: section.title_en,
          title_zh: section.title_zh,
          snippet,
        });
      }
    }

    return results;
  },

  /** Extract ~80-char snippet around match position */
  _getSnippet(text, matchIdx, queryLen) {
    const CONTEXT = 50;
    const start = Math.max(0, matchIdx - CONTEXT);
    const end = Math.min(text.length, matchIdx + queryLen + CONTEXT);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    return snippet.replace(/\n/g, ' ').trim();
  },

  _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
};

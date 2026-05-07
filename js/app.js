/**
 * app.js — Main application entry point
 */
window.App = {
  sectionsData: null,
  currentLang: localStorage.getItem('lang') || 'zh',
  currentTheme: localStorage.getItem('theme') || 'light',
  currentSection: { chapter: 1, section: '1.1' },
  sidebarOpen: false,
  _initialized: false,
  _mathObserver: null,

  /* ── Init ── */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    await this._loadData();
    this._applyTheme();
    this._applyLang();

    // Render sidebar TOC
    window.TOC.render(this.sectionsData.chapters, {
      currentChapter: this.currentSection.chapter,
      currentSection: this.currentSection.section,
      lang: this.currentLang,
    });

    // Index sections for search
    window.Search.index(this.sectionsData.chapters);

    // Restore last-read position
    const saved = window.Bookmarks.getProgress();
    let initChapter = 1;
    let initSection = '1.1';
    const hash = window.location.hash.slice(1);
    if (hash) {
      const dot = hash.indexOf('.');
      if (dot > 0) {
        initChapter = parseInt(hash.slice(0, dot), 10);
        initSection = hash;
      }
    } else if (saved.chapter && saved.section) {
      initChapter = saved.chapter;
      initSection = saved.section;
    }

    this.navigate(initChapter, initSection, /* skipScroll */ true);

    this._wireEvents();

    // Creation timestamp
    const ts = document.getElementById('created-time');
    if (ts) ts.textContent = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  },

  /* ── Data ── */
  async _loadData() {
    try {
      const resp = await fetch('data/sections.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.sectionsData = await resp.json();
    } catch (err) {
      console.error('[App] Failed to load sections.json:', err);
    }
  },

  /* ── Theme ── */
  _applyTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
  },

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this._applyTheme();
    localStorage.setItem('theme', this.currentTheme);
  },

  /* ── Language ── */
  _applyLang() {
    document.body.classList.remove('lang-zh', 'lang-en');
    document.body.classList.add(`lang-${this.currentLang}`);
    const btn = document.getElementById('lang-toggle');
    if (btn) {
      btn.querySelector('.lang-label').textContent = this.currentLang === 'zh' ? '中文' : 'EN';
    }
    localStorage.setItem('lang', this.currentLang);
  },

  toggleLanguage() {
    this.currentLang = this.currentLang === 'zh' ? 'en' : 'zh';
    this._applyLang();
    this._reRender();
  },

  /* ── Navigation ── */
  navigate(chapterNum, sectionId, skipScroll) {
    this.currentSection = { chapter: chapterNum, section: sectionId };

    // Open target chapter in sidebar
    window.TOC.openChapters.add(chapterNum);

    // Update URL hash
    window.location.hash = `#${sectionId}`;

    // Render
    this._renderSection();

    // Update sidebar active state
    window.TOC.updateActive(this.sectionsData.chapters, chapterNum, sectionId);

    // Save reading progress
    window.Bookmarks.saveProgress(chapterNum, sectionId);

    // Update bookmark UI
    window.Bookmarks.updateUI(sectionId);

    // Scroll to top
    if (!skipScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Close sidebar on mobile
    this._closeSidebar();
  },

  /* ── Render section ── */
  _renderSection() {
    const contentEl = document.getElementById('section-content');
    if (!contentEl || !this.sectionsData) return;

    const chapter = this.sectionsData.chapters.find(c => c.number === this.currentSection.chapter);
    if (!chapter) return;
    const section = chapter.sections.find(s => s.number === this.currentSection.section);
    if (!section) return;

    const body = this.currentLang === 'zh' ? section.content_zh : section.content_en;

    // Clear previous MathJax state
    window.MathHelper.clear(contentEl);

    // Render HTML
    const html = window.Renderer.render(body, section, chapter, this.currentLang);
    contentEl.innerHTML = html;

    // Render breadcrumb
    const breadcrumbEl = document.getElementById('breadcrumb');
    if (breadcrumbEl) {
      breadcrumbEl.innerHTML = window.Renderer.breadcrumb(
        chapter.number,
        this.currentLang === 'zh' ? chapter.title_zh : chapter.title_en,
        section.number,
        this.currentLang === 'zh' ? section.title_zh : section.title_en,
        this.currentLang
      );
    }

    // Render reading progress
    const progressEl = document.getElementById('progress-text');
    if (progressEl) {
      const totalPages = this.sectionsData.metadata?.total_pages || 312;
      progressEl.textContent = window.Renderer.progressText(
        chapter.number,
        section.number,
        this.currentLang === 'zh' ? section.title_zh : section.title_en,
        section.pdf_page,
        totalPages,
        this.currentLang
      );
    }

    // Request MathJax typeset
    window.MathHelper.requestTypeset(contentEl);
  },

  _typesetContent() {
    const contentEl = document.getElementById('section-content');
    if (!contentEl) return;
    window.MathHelper.requestTypeset(contentEl);
  },

  /** Re-render everything that depends on language */
  _reRender() {
    if (!this.sectionsData) return;
    // Re-render sidebar
    window.TOC.render(this.sectionsData.chapters, {
      currentChapter: this.currentSection.chapter,
      currentSection: this.currentSection.section,
      lang: this.currentLang,
    });
    // Re-render current section
    this._renderSection();
  },

  /* ── Sidebar ── */
  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    document.body.classList.toggle('sidebar-open', this.sidebarOpen);
    const btn = document.getElementById('hamburger');
    if (btn) btn.setAttribute('aria-label', this.sidebarOpen ? '关闭导航' : '打开导航');
    if (this.sidebarOpen && window.Search.isOpen) window.Search.close();
  },

  _closeSidebar() {
    this.sidebarOpen = false;
    document.body.classList.remove('sidebar-open');
    const btn = document.getElementById('hamburger');
    if (btn) btn.setAttribute('aria-label', '打开导航');
  },

  /* ── Bookmark ── */
  toggleBookmark() {
    const { chapter, section } = this.currentSection;
    const added = window.Bookmarks.toggle(section);
    window.Bookmarks.updateUI(section);
    this._showToast(added ? '已添加书签' : '已移除书签');
  },

  /* ── Toast ── */
  _showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  },

  /* ── Event wiring ── */
  _wireEvents() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('lang-toggle')?.addEventListener('click', () => this.toggleLanguage());
    document.getElementById('hamburger')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => this._closeSidebar());
    document.getElementById('search-close-btn')?.addEventListener('click', () => window.Search.close());
    document.getElementById('search-btn')?.addEventListener('click', () => window.Search.open());
    document.getElementById('bookmark-btn')?.addEventListener('click', () => this.toggleBookmark());

    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => {
      window.Search.renderResults(e.target.value);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !window.Search.isOpen && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        window.Search.open();
      }
      if (e.key === 'Escape') {
        if (window.Search.isOpen) window.Search.close();
      }
      if ((e.key === 'j' || e.key === 'ArrowDown') && e.target.tagName !== 'INPUT') {
        this._navigateNext();
      }
      if ((e.key === 'k' || e.key === 'ArrowUp') && e.target.tagName !== 'INPUT') {
        this._navigatePrev();
      }
      if (e.key === 'b' && e.target.tagName !== 'INPUT') {
        this.toggleBookmark();
      }
      if (e.key === 't' && e.target.tagName !== 'INPUT') {
        this.toggleTheme();
      }
    });

    // Hash change
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const dot = hash.indexOf('.');
      if (dot > 0) {
        const ch = parseInt(hash.slice(0, dot), 10);
        const sec = hash;
        if (ch !== this.currentSection.chapter || sec !== this.currentSection.section) {
          this.navigate(ch, sec);
        }
      }
    });
  },

  /** Navigate to next section */
  _navigateNext() {
    if (!this.sectionsData) return;
    const allSections = [];
    for (const ch of this.sectionsData.chapters) {
      for (const sec of ch.sections) {
        allSections.push({ chapter: ch.number, section: sec.number });
      }
    }
    const idx = allSections.findIndex(
      s => s.chapter === this.currentSection.chapter && s.section === this.currentSection.section
    );
    if (idx >= 0 && idx < allSections.length - 1) {
      const next = allSections[idx + 1];
      this.navigate(next.chapter, next.section);
    }
  },

  /** Navigate to previous section */
  _navigatePrev() {
    if (!this.sectionsData) return;
    const allSections = [];
    for (const ch of this.sectionsData.chapters) {
      for (const sec of ch.sections) {
        allSections.push({ chapter: ch.number, section: sec.number });
      }
    }
    const idx = allSections.findIndex(
      s => s.chapter === this.currentSection.chapter && s.section === this.currentSection.section
    );
    if (idx > 0) {
      const prev = allSections[idx - 1];
      this.navigate(prev.chapter, prev.section);
    }
  },
};

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => window.App.init());

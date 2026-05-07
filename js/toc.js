/**
 * toc.js — Table of Contents manager
 * Handles collapsible chapter/section navigation.
 */
window.TOC = {
  openChapters: new Set([1]),

  /**
   * Render the full sidebar TOC.
   * @param {Object} chaptersData - array of chapter objects
   * @param {Object} state - { currentChapter, currentSection, lang }
   */
  render(chaptersData, state) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || !chaptersData) return;

    const inner = sidebar.querySelector('.sidebar-inner') || sidebar;
    inner.innerHTML = '';

    const frag = document.createDocumentFragment();

    for (const chapter of chaptersData) {
      const isOpen = this.openChapters.has(chapter.number);
      const chTitle = state.lang === 'zh' ? chapter.title_zh : chapter.title_en;

      const chBlock = document.createElement('div');
      chBlock.className = 'chapter-block' + (isOpen ? ' is-open' : '');
      chBlock.dataset.chapter = chapter.number;

      const chHeading = document.createElement('div');
      chHeading.className = 'chapter-heading';
      const prefix = state.lang === 'zh' ? `第${chapter.number}章` : `Chapter ${chapter.number}`;
      chHeading.textContent = `${prefix} ${chTitle}`;
      chHeading.addEventListener('click', () => this.toggleChapter(chapter.number));

      const chSections = document.createElement('div');
      chSections.className = 'chapter-sections';

      for (const sec of chapter.sections) {
        const secTitle = state.lang === 'zh' ? sec.title_zh : sec.title_en;
        const isActive = (
          state.currentChapter === chapter.number &&
          state.currentSection === sec.number
        );

        const link = document.createElement('div');
        link.className = 'section-link' + (isActive ? ' is-active' : '');
        link.dataset.section = sec.number;
        link.innerHTML = `<span class="sec-num">${sec.number}</span><span>${secTitle}</span>`;
        link.addEventListener('click', () => {
          window.App.navigate(chapter.number, sec.number);
        });
        chSections.appendChild(link);
      }

      chBlock.appendChild(chHeading);
      chBlock.appendChild(chSections);
      frag.appendChild(chBlock);
    }

    inner.appendChild(frag);
  },

  /** Toggle chapter expanded/collapsed */
  toggleChapter(chapterNum) {
    if (this.openChapters.has(chapterNum)) {
      this.openChapters.delete(chapterNum);
    } else {
      this.openChapters.add(chapterNum);
    }
    this._updateClasses();
  },

  /** Ensure the active section is visible in the sidebar (scroll into view) */
  scrollActiveIntoView() {
    const active = document.querySelector('.section-link.is-active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  },

  /** Re-render just the active class without full rebuild */
  updateActive(chaptersData, currentChapter, currentSection) {
    if (!chaptersData) return;
    const links = document.querySelectorAll('.section-link');
    links.forEach(link => {
      const isActive = link.dataset.section === currentSection;
      link.classList.toggle('is-active', isActive);
    });
    // Also ensure the chapter containing active section is open
    const chapter = chaptersData.find(c => c.number === currentChapter);
    if (chapter && !this.openChapters.has(chapter.number)) {
      this.openChapters.add(chapter.number);
      this._updateClasses();
    }
  },

  _updateClasses() {
    document.querySelectorAll('.chapter-block').forEach(blk => {
      const n = parseInt(blk.dataset.chapter, 10);
      blk.classList.toggle('is-open', this.openChapters.has(n));
    });
  }
};

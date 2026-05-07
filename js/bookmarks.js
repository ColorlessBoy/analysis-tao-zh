/**
 * bookmarks.js — Bookmark & highlight manager using localStorage
 */
window.Bookmarks = {
  STORAGE_KEY: 'analysis-tao-bookmarks',

  /** Get all bookmarked section IDs */
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  },

  /** Save bookmarks array */
  save(bookmarks) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks));
  },

  /** Check if a section is bookmarked */
  isBookmarked(sectionId) {
    return this.getAll().includes(sectionId);
  },

  /** Toggle bookmark for a section */
  toggle(sectionId) {
    const bookmarks = this.getAll();
    const idx = bookmarks.indexOf(sectionId);
    if (idx >= 0) {
      bookmarks.splice(idx, 1);
      this.save(bookmarks);
      return false;
    } else {
      bookmarks.push(sectionId);
      this.save(bookmarks);
      return true;
    }
  },

  /** Update the UI (bookmark button state) */
  updateUI(sectionId) {
    const btn = document.getElementById('bookmark-btn');
    if (!btn) return;
    const isActive = this.isBookmarked(sectionId);
    document.body.classList.toggle('is-bookmarked', isActive);
    btn.setAttribute('aria-label', isActive ? '移除书签' : '添加书签');
    btn.setAttribute('title', isActive ? '移除书签' : '添加书签');
  },

  /** Get reading progress state (last read section) */
  getProgress() {
    try {
      return JSON.parse(localStorage.getItem('analysis-tao-progress') || '{}');
    } catch (_) {
      return {};
    }
  },

  /** Save last-read section */
  saveProgress(chapterNum, sectionId) {
    const progress = this.getProgress();
    progress.chapter = chapterNum;
    progress.section = sectionId;
    progress.timestamp = Date.now();
    localStorage.setItem('analysis-tao-progress', JSON.stringify(progress));
  }
};

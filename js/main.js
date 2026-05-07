/**
 * main.js — Analysis I · Tao's Analysis (Chinese/English)
 * Pure vanilla JS, reads data/sections.json
 */

'use strict';

/* ------------------------------------------------------------
 * State
 * ------------------------------------------------------------ */
let sectionsData = null;
let currentLang   = localStorage.getItem('lang')   || 'zh';
let currentTheme  = localStorage.getItem('theme')  || 'light';
let currentSection = { chapter: 1, section: '1.1' };
let openChapters   = new Set([1]);  // chapters expanded by default
let sidebarOpen    = false;  // mobile sidebar state

/* ------------------------------------------------------------
 * Init
 * ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  applyTheme();
  applyLang();
  renderSidebar();

  // Restore section from URL hash (e.g. #1.2 → chapter 1, section 1.2)
  const hash = window.location.hash.slice(1); // drop leading '#'
  let initChapter = 1;
  let initSection = '1.1';
  if (hash) {
    const match = hash.match(/^(\d+)\.(\S+)$/);
    if (match) {
      initChapter = parseInt(match[1], 10);
      initSection = match[2];
    }
  }
  navigate(initChapter, initSection);

  // Wire up control buttons
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('lang-toggle')?.addEventListener('click', toggleLanguage);
  document.getElementById('hamburger')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
});

/* ------------------------------------------------------------
 * Data loading
 * ------------------------------------------------------------ */
async function loadData() {
  try {
    const resp = await fetch('data/sections.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    sectionsData = await resp.json();
  } catch (err) {
    console.error('[main] Failed to load sections.json:', err);
  }
}

/* ------------------------------------------------------------
 * Theme
 * ------------------------------------------------------------ */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  // Aria label for accessibility
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.setAttribute('aria-label',
      currentTheme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'
    );
  }
  localStorage.setItem('theme', currentTheme);
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme();
}

/* ------------------------------------------------------------
 * Language
 * ------------------------------------------------------------ */
function applyLang() {
  document.body.classList.remove('lang-zh', 'lang-en');
  document.body.classList.add(`lang-${currentLang}`);

  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.querySelector('.lang-label').textContent = currentLang === 'zh' ? '中文' : 'EN';
    btn.setAttribute('aria-label',
      currentLang === 'zh' ? '切换到英文' : '切换到中文'
    );
  }

  localStorage.setItem('lang', currentLang);
  if (sectionsData) renderSidebar();
  if (sectionsData) renderSection();
}

function toggleLanguage() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  applyLang();
}

/* ------------------------------------------------------------
 * Sidebar rendering
 * ------------------------------------------------------------ */
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || !sectionsData) return;

  const fragment = document.createDocumentFragment();

  for (const chapter of sectionsData.chapters) {
    const isOpen  = openChapters.has(chapter.number);
    const chTitle = currentLang === 'zh' ? chapter.title_zh : chapter.title_en;

    const chBlock = document.createElement('div');
    chBlock.className = 'chapter-block' + (isOpen ? ' is-open' : '');
    chBlock.dataset.chapter = chapter.number;

    const chHeading = document.createElement('div');
    chHeading.className = 'chapter-heading';
    const chapterPrefix = currentLang === 'zh' ? `第${chapter.number}章` : `Chapter ${chapter.number}`;
    chHeading.textContent = `${chapterPrefix} ${chTitle}`;
    chHeading.addEventListener('click', () => toggleChapter(chapter.number));

    const chSections = document.createElement('div');
    chSections.className = 'chapter-sections';

    for (const sec of chapter.sections) {
      const secTitle = currentLang === 'zh' ? sec.title_zh : sec.title_en;
      const isActive = (
        currentSection.chapter === chapter.number &&
        currentSection.section  === sec.number
      );

      const link = document.createElement('div');
      link.className   = 'section-link' + (isActive ? ' is-active' : '');
      link.dataset.section = sec.number;
      link.innerHTML   = `<span class="sec-num">${sec.number}</span><span>${secTitle}</span>`;
      link.addEventListener('click', () => navigate(chapter.number, sec.number));
      chSections.appendChild(link);
    }

    chBlock.appendChild(chHeading);
    chBlock.appendChild(chSections);
    fragment.appendChild(chBlock);
  }

  sidebar.innerHTML = '';
  sidebar.appendChild(fragment);
}

function toggleChapter(chapterNum) {
  if (openChapters.has(chapterNum)) {
    openChapters.delete(chapterNum);
  } else {
    openChapters.add(chapterNum);
  }
  // Re-render just the class to avoid full sidebar rebuild
  const blocks = document.querySelectorAll('.chapter-block');
  for (const blk of blocks) {
    const n = parseInt(blk.dataset.chapter, 10);
    blk.classList.toggle('is-open', openChapters.has(n));
  }
}

/* ------------------------------------------------------------
 * Navigation
 * ------------------------------------------------------------ */
function navigate(chapterNum, sectionNum) {
  currentSection = { chapter: chapterNum, section: sectionNum };

  // Always open the chapter we're navigating to
  openChapters.add(chapterNum);

  // Persist current section in URL hash (e.g. #1.2)
  window.location.hash = `#${chapterNum}.${sectionNum}`;

  renderSidebar();
  renderSection();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close sidebar on mobile after navigating
  closeSidebar();
}

/* ------------------------------------------------------------
 * Mobile sidebar
 * ------------------------------------------------------------ */
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.body.classList.toggle('sidebar-open', sidebarOpen);
  const btn = document.getElementById('hamburger');
  if (btn) {
    btn.setAttribute('aria-label', sidebarOpen ? '关闭导航' : '打开导航');
  }
}

function closeSidebar() {
  sidebarOpen = false;
  document.body.classList.remove('sidebar-open');
  const btn = document.getElementById('hamburger');
  if (btn) {
    btn.setAttribute('aria-label', '打开导航');
  }
}

/* ------------------------------------------------------------
 * Section rendering
 * ------------------------------------------------------------ */
function renderSection() {
  const content = document.getElementById('content');
  if (!content || !sectionsData) return;

  const chapter = sectionsData.chapters.find(c => c.number === currentSection.chapter);
  if (!chapter) return;

  const section = chapter.sections.find(s => s.number === currentSection.section);
  if (!section) return;

  const title      = currentLang === 'zh' ? section.title_zh : section.title_en;
  const chTitle    = currentLang === 'zh' ? chapter.title_zh : chapter.title_en;
  const body       = currentLang === 'zh' ? section.content_zh : section.content_en;
  const langLabel  = currentLang === 'zh' ? '中文' : 'EN';
  const emptyMsg   = currentLang === 'zh' ? '内容待填充…' : 'Content coming soon…';

  content.innerHTML = `
    <header class="sec-header">
      <div class="sec-chapter-label">第${chapter.number}章 ${chTitle}</div>
      <h1 class="sec-title">${title}</h1>
      <div class="sec-meta">
        <span class="badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          PDF p.${section.pdf_page}
        </span>
        <span class="badge badge-lang">${langLabel}</span>
      </div>
    </header>
    <div class="sec-body">
      ${body ? renderBody(body) : `<p class="empty-content">${emptyMsg}</p>`}
    </div>
  `;

  // Typeset math after DOM insertion
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([content]).catch(err =>
      console.warn('[main] MathJax typeset error:', err)
    );
  }
}

/**
 * Convert plain text paragraphs into HTML.
 * Handles:
 *   - blank-line separated paragraphs
 *   - lines starting with a number + period → ordered list
 *   - lines starting with (minibatch) → unordered list
 *   - lines starting with --- → <hr>
 *   - bold *text*
 *   - italic _text_
 *   - math $...$ and $$...$$
 */
function renderBody(text) {
  if (!text) return '';

  // Split into paragraphs on blank lines
  const paras = text.split(/\n\n+/);

  return paras.map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      return '<hr>';
    }

    // Ordered list (lines starting with "1. ")
    if (/^\d+\.\s/m.test(trimmed)) {
      const items = trimmed.split('\n').map(line =>
        line.replace(/^\d+\.\s+/, '')
      );
      return `<ol>${items.map(item => `<li>${inlineFormat(item)}</li>`).join('')}</ol>`;
    }

    // Unordered list (lines starting with (a), (b), etc. OR -, *)
    if (/^\([a-z]\)|\n\([a-z]\)|^[*-]\s/m.test(trimmed)) {
      const items = trimmed.split('\n').map(line =>
        line.replace(/^[*-]\s+/, '').replace(/^\([a-z]\)\s*/i, '')
      );
      return `<ul>${items.map(item => `<li>${inlineFormat(item)}</li>`).join('')}</ul>`;
    }

    return `<p>${inlineFormat(trimmed)}</p>`;
  }).join('\n');
}

/**
 * Inline formatting: bold, italic, math.
 */
function inlineFormat(text) {
  if (!text) return '';

  // Escape HTML first
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold *...*
  s = s.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');

  // Italic _..._
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Math display $$...$$ (use [\s\S] to handle newlines inside delimiters)
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="math-display">$$$1$$</div>');


  // Math inline $...$ (use [\s\S] to handle newlines)
  s = s.replace(/\$([^$\n]+)\$/g, '$$$1$');

  return s;
}

/* ------------------------------------------------------------
 * Expose to global scope for onclick handlers
 * ------------------------------------------------------------ */
window.toggleTheme    = toggleTheme;
window.toggleLanguage = toggleLanguage;
window.navigate       = navigate;
window.toggleSidebar  = toggleSidebar;
window.closeSidebar   = closeSidebar;

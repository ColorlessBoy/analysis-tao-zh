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
let _initialized = false;
document.addEventListener('DOMContentLoaded', async () => {
  // Guard against double initialization (can happen with some browser behaviors)
  if (_initialized) return;
  _initialized = true;

  await loadData();
  applyTheme();
  applyLang();
  renderSidebar();

  // Restore section from URL hash (e.g. #1.2 → chapter 1, section 1.2)
  // Wait for loadData() to complete before navigating, so sectionsData is available
  const hash = window.location.hash.slice(1); // drop leading '#'
  let initChapter = 1;
  let initSection = '1.1';
  if (hash) {
    // Parse hash: format is "chapter.section" (e.g. "1.2") or "chapter.section.subsection" (e.g. "1.1.1")
    // initSection should be the FULL section identifier (e.g. "1.2" or "1.1.1")
    // We determine chapter from the first number before the first dot, and the rest is the section
    const firstDot = hash.indexOf('.');
    if (firstDot > 0) {
      const chapterStr = hash.slice(0, firstDot);       // e.g. "1"
      const sectionStr = hash.slice(firstDot + 1);     // e.g. "2" for "1.2" or "1.1" for "1.1.1"
      initChapter = parseInt(chapterStr, 10);
      // section identifier is chapter.sectionStr (e.g. "1.2" or "1.1.1")
      initSection = chapterStr + '.' + sectionStr;
    }
  }
  navigate(initChapter, initSection);

  // Wire up control buttons
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('lang-toggle')?.addEventListener('click', toggleLanguage);
  document.getElementById('hamburger')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Set creation timestamp
  document.getElementById('created-time').textContent = new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
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
  // sectionNum already contains the chapter prefix (e.g. "1.2"), so use it directly
  window.location.hash = `#${sectionNum}`;

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

  // Clear any previous MathJax state BEFORE replacing content
  // Note: typesetClear() is a v4 feature; in v3 we simply skip this step
  // (prevents orphan MathItem references that cause rendering conflicts)
  // We only check that MathJax is loaded.

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
      ${body ? mergeConsecutiveLists(renderBody(body)) : `<p class="empty-content">${emptyMsg}</p>`}
    </div>
  `;

  // Typeset math after DOM insertion — wait for MathJax to be fully initialized
  // Chain through MathJax.startup.promise to ensure MathJax itself is ready
  // before calling typesetPromise; this handles the async script loading correctly
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.startup.promise
      .then(() => MathJax.typesetPromise([content]))
      .catch(err => console.warn('[main] MathJax typeset error:', err));
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
 *   - Definition / Axiom / Theorem / Proposition / Lemma / Corollary / Remark / Exercise / Example → styled boxes
 */
function renderBody(text) {
  if (!text) return '';

  const boxPatterns = [
    { label: 'Definition',  cls: 'definition', zh: '定义' },
    { label: 'Axiom',      cls: 'axiom',       zh: '公理' },
    { label: 'Theorem',    cls: 'theorem',     zh: '定理' },
    { label: 'Proposition',cls: 'proposition',  zh: '命题' },
    { label: 'Lemma',      cls: 'lemma',       zh: '引理' },
    { label: 'Corollary',  cls: 'corollary',   zh: '推论' },
    { label: 'Remark',     cls: 'remark',      zh: '注' },
    { label: 'Exercise',   cls: 'exercise',    zh: '练习' },
    { label: 'Example',    cls: 'example',     zh: '例' },
  ];

  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    let matched = false;

    for (const { label, cls, zh } of boxPatterns) {
      const pat = new RegExp(`^(${label}|${zh})\\s+(\\d+\\.\\d+)\\s*(.*)$`, 'i');
      const m = line.match(pat);
      if (m) {
        const bodyLines = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          bodyLines.push(lines[i]);
          i++;
        }

        const labelText = `${m[1]} ${m[2]}`;
        const titlePart = m[3]
          ? `<strong>${labelText} ${m[3]}</strong>`
          : `<strong>${labelText}</strong>`;
        const bodyHtml = bodyLines
          .map(p => `<p>${inlineFormat(p.trim())}</p>`)
          .join('\n');

        result.push(
          `<div class="math-box ${cls}">${titlePart}${bodyHtml ? '<div class="math-box-body">' + bodyHtml + '</div>' : ''}</div>`
        );
        matched = true;
        break;
      }
    }

    if (!matched) {
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== '') {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        result.push(...renderParagraphs(paraLines.join('\n')));
      }
      i++;
    }
  }

  return result.join('\n');
}

/**
 * Render normal paragraphs (non-box content).
 */
function renderParagraphs(text) {
  const paras = text.split(/\n\n+/);
  return paras.map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';

    if (/^---+$/.test(trimmed)) return '<hr>';

    if (/^\d+\.\s/m.test(trimmed)) {
      const items = trimmed.split('\n').map(line => line.replace(/^\d+\.\s+/, ''));
      return `<ol>${items.map(item => `<li>${inlineFormat(item)}</li>`).join('')}</ol>`;
    }

    if (/^\([a-z]\)|\n\([a-z]\)|^[*-]\s/m.test(trimmed)) {
      const items = trimmed.split('\n').map(line =>
        line.replace(/^[*-]\s+/, '').replace(/^\([a-z]\)\s*/i, '')
      );
      return `<ul>${items.map(item => `<li>${inlineFormat(item)}</li>`).join('')}</ul>`;
    }

    return `<p>${inlineFormat(trimmed)}</p>`;
  });
}

/**
 * Merge consecutive <ol> elements into one continuous numbered list.
 * This handles the case where markdown conversion produces separate <ol> tags
 * for what should be a single continuous list.
 */
function mergeConsecutiveLists(html) {
  return html.replace(/<\/ol>\s*<ol>/g, '');
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

  // DO NOT touch math delimiters — MathJax v3 scans text nodes directly
  // for $$...$$ (display) and $...$ (inline). Wrapping or replacing math
  // corrupts display formulas because the inline regex greedily eats content
  // inside display math blocks. Just leave the raw LaTeX delimiters in place.

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

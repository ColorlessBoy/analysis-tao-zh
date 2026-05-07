let currentLang = localStorage.getItem('lang') || 'zh';
let currentTheme = localStorage.getItem('theme') || 'light';
let sectionsData = null;
let currentSection = { chapter: 1, section: '1.1' };

async function loadData() {
  const resp = await fetch('data/sections.json');
  sectionsData = await resp.json();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('theme', currentTheme);
}

function applyLang() {
  document.body.classList.remove('lang-zh', 'lang-en');
  document.body.classList.add(`lang-${currentLang}`);
  document.getElementById('lang-toggle').textContent = currentLang === 'zh' ? '中/EN' : 'EN/中';
  localStorage.setItem('lang', currentLang);
  renderSidebar();
  renderSection();
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme();
}

function toggleLanguage() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  applyLang();
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sectionsData) return;
  let html = '';
  for (const ch of sectionsData.chapters) {
    const chTitle = currentLang === 'zh' ? ch.title_zh : ch.title_en;
    html += `<div class="chapter-nav">
      <div class="chapter-title">第${ch.number}章 ${chTitle}</div>`;
    for (const sec of ch.sections) {
      const secTitle = currentLang === 'zh' ? sec.title_zh : sec.title_en;
      const active = sec.number === currentSection.section ? 'active' : '';
      html += `<a class="section-link ${active}" onclick="navigate(${ch.number},'${sec.number}')">${sec.number} ${secTitle}</a>`;
    }
    html += '</div>';
  }
  sidebar.innerHTML = html;
}

function navigate(chapter, section) {
  currentSection = { chapter, section };
  renderSidebar();
  renderSection();
  window.scrollTo(0, 0);
}

function renderSection() {
  const content = document.getElementById('content');
  if (!sectionsData) return;

  const ch = sectionsData.chapters.find(c => c.number === currentSection.chapter);
  if (!ch) return;
  const sec = ch.sections.find(s => s.number === currentSection.section);
  if (!sec) return;

  const title = currentLang === 'zh' ? sec.title_zh : sec.title_en;
  const chTitle = currentLang === 'zh' ? ch.title_zh : ch.title_en;
  const body = currentLang === 'zh' ? sec.content_zh : sec.content_en;
  const langBadge = currentLang === 'zh' ? '中文' : 'English';

  content.innerHTML = `
    <div class="section-header">
      <span class="section-number">${ch.number}.${sec.number.replace(/^\\d+\\./,'')} ${chTitle}</span>
      <h2 class="section-title">${title}</h2>
      <span class="pdf-page-badge">PDF p.${sec.pdf_page}</span>
      <span class="lang-indicator">${langBadge}</span>
    </div>
    <div class="section-body">
      ${body || '<p style="color:var(--text);opacity:0.5">内容待填充...</p>'}
    </div>
  `;
  if (window.MathJax) MathJax.typesetPromise?.();
}

window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;
window.navigate = navigate;

window.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  applyTheme();
  applyLang();
  // default to first section
  navigate(1, '1.1');
});
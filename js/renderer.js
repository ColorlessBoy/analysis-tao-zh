/**
 * renderer.js — Content rendering with math protection and bilingual support
 *
 * IMPORTANT: Math blocks are protected BEFORE any text splitting/processing to prevent:
 *   - Paragraph splitting from breaking multi-line display math ($$...$$)
 *   - Italic regex (_..._) from matching underscores inside math expressions
 */
window.Renderer = {
  /**
   * Render a section's content to HTML.
   * @param {string} body  - plain text content
   * @param {Object} section - section metadata { number, title_en, title_zh, pdf_page }
   * @param {Object} chapter - chapter metadata { number, title_en, title_zh }
   * @param {string} lang  - 'zh' or 'en'
   * @returns {string} HTML
   */
  render(body, section, chapter, lang) {
    const title = lang === 'zh' ? section.title_zh : section.title_en;
    const chTitle = lang === 'zh' ? chapter.title_zh : chapter.title_en;
    const langLabel = lang === 'zh' ? '中文' : 'EN';
    const emptyMsg = lang === 'zh' ? '内容待填充…' : 'Content coming soon…';

    const processedBody = body ? this.renderBody(body) : '';
    const mergedBody = this.mergeConsecutiveLists(processedBody);

    const pageLabel = (section.page_start && section.page_end)
      ? `pp. ${section.page_start}–${section.page_end}`
      : `p.${section.pdf_page}`;

    return `
      <header class="sec-header">
        <div class="sec-chapter-label">第${chapter.number}章 ${chTitle}</div>
        <h1 class="sec-title">${title}</h1>
        <div class="sec-meta">
          <span class="badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            PDF ${pageLabel}
          </span>
          <span class="badge badge-lang">${langLabel}</span>
        </div>
      </header>
      <div class="sec-body">
        ${mergedBody || `<p class="empty-content">${emptyMsg}</p>`}
      </div>
      <footer class="sec-footer">
        <a href="https://github.com/ColorlessBoy/analysis-tao-zh/edit/main/data/sections.json" target="_blank" rel="noopener" class="edit-link">编辑此章节</a>
      </footer>
    `;
  },

  /**
   * Convert plain text into HTML.
   * Math placeholders use Unicode box characters (⧫) so they are NOT
   * corrupted by inlineFormat's underscore→<em> processing.
   */
  renderBody(text) {
    if (!text) return '';

    // Step 1: Protect display math ($$...$$) with placeholders
    const displayMathBlocks = [];
    let processed = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      displayMathBlocks.push(match);
      return `⧫DM${displayMathBlocks.length - 1}⧫`;
    });

    // Step 2: Protect inline math ($...$) with placeholders
    const inlineMathBlocks = [];
    processed = processed.replace(/\$[^\$\n]+\$/g, (match) => {
      inlineMathBlocks.push(match);
      return `⧫IM${inlineMathBlocks.length - 1}⧫`;
    });

    // Step 3: Parse content blocks (math-boxes + paragraphs)
    const result = this._parseBlocks(processed);

    // Step 4: Restore math blocks
    let html = result.join('\n');
    displayMathBlocks.forEach((block, idx) => {
      html = html.replace(new RegExp(`⧫DM${idx}⧫`, 'g'), block);
    });
    inlineMathBlocks.forEach((block, idx) => {
      html = html.replace(new RegExp(`⧫IM${idx}⧫`, 'g'), block);
    });

    return html;
  },

  /**
   * Parse blocks: math-box patterns + normal paragraphs.
   */
  _parseBlocks(text) {
    const boxPatterns = [
      { label: 'Definition',  cls: 'definition prop-card',  zh: '定义' },
      { label: 'Axiom',        cls: 'axiom prop-card',       zh: '公理' },
      { label: 'Theorem',      cls: 'theorem prop-card',     zh: '定理' },
      { label: 'Proposition',  cls: 'proposition prop-card',zh: '命题' },
      { label: 'Lemma',       cls: 'lemma prop-card',       zh: '引理' },
      { label: 'Corollary',    cls: 'corollary prop-card',   zh: '推论' },
      { label: 'Remark',       cls: 'remark prop-card',      zh: '注' },
      { label: 'Exercise',     cls: 'exercise prop-card',   zh: '练习' },
      { label: 'Example',      cls: 'example prop-card',     zh: '例' },
    ];

    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      let matched = false;

      for (const { label, cls, zh } of boxPatterns) {
        const pat = new RegExp(`^(${label}|${zh})\\s*\\d+(?:\\.\\d+)*\\s*(.*)$`, 'i');
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
            .map(p => `<p>${this.inlineFormat(p.trim())}</p>`)
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
          result.push(...this._renderParagraphs(paraLines.join('\n')));
        }
        i++;
      }
    }

    return result;
  },

  /**
   * Render normal paragraphs (non-box content).
   */
  _renderParagraphs(text) {
    const paras = text.split(/\n\n+/);
    return paras.map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';

      if (/^---+$/.test(trimmed)) return '<hr>';

      // Ordered list: lines starting with number.
      if (/\n\d+\.\s/.test(trimmed) || /^\d+\.\s/m.test(trimmed)) {
        const listItems = trimmed.split('\n').map(line => {
          const m = line.match(/^(\d+)\.\s+(.*)$/);
          return m ? m[2] : line;
        });
        return `<ol>${listItems.map(item => `<li>${this.inlineFormat(item)}</li>`).join('')}</ol>`;
      }

      // Unordered list: lines starting with -, *, or (a), (b), etc.
      if (/^\([a-z]\)|\n\([a-z]\)|^[*-]\s/m.test(trimmed)) {
        const listItems = trimmed.split('\n').map(line =>
          line.replace(/^[*-]\s+/, '').replace(/^\([a-z]\)\s*/i, '')
        );
        return `<ul>${listItems.map(item => `<li>${this.inlineFormat(item)}</li>`).join('')}</ul>`;
      }

      return `<p>${this.inlineFormat(trimmed)}</p>`;
    }).filter(Boolean);
  },

  /**
   * Merge consecutive </ol> followed by <ol> into one continuous numbered list.
   * This fixes the "1,1,1" numbering bug.
   */
  mergeConsecutiveLists(html) {
    return html.replace(/<\/ol>\s*<ol>/g, '');
  },

  /**
   * Inline formatting: bold, italic.
   * Math delimiters ($...$, $$...$$) are intentionally left untouched
   * so MathJax can process them directly.
   */
  inlineFormat(text) {
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

    return s;
  },

  /**
   * Render breadcrumb HTML.
   */
  breadcrumb(chapterNum, chapterTitle, sectionNum, sectionTitle, lang) {
    const chLabel = lang === 'zh' ? `第${chapterNum}章` : `Chapter ${chapterNum}`;
    const secLabel = lang === 'zh' ? `${sectionNum}节` : `Section ${sectionNum}`;
    return `
      <a href="#${sectionNum}">${chLabel}</a>
      <span class="sep">›</span>
      <span>${secLabel}</span>
      <span class="sep">›</span>
      <span>${sectionTitle}</span>
    `;
  },

  /**
   * Render reading progress text.
   */
  progressText(chapterNum, sectionNum, sectionTitle, pdfPage, totalPages, lang) {
    const chLabel = lang === 'zh' ? `第${chapterNum}章` : `Ch ${chapterNum}`;
    return `${chLabel} · ${sectionNum} · ${lang === 'zh' ? '第' : 'p.'}${pdfPage} / ${totalPages}页`;
  }
};

// Fix 1.2 EN formulas by copying from ZH
const data = JSON.parse(require('fs').readFileSync('data/sections.json', 'utf8'));
const ch = data.chapters.find(c => c.number === 1);
const s = ch.sections.find(s => s.number === '1.2');
const zh = s.content_zh;
const en = s.content_en;

// Extract all $$...$$ from ZH with their surrounding text context
const zhFormulas = [];
const zhRegex = /\$\$([\s\S]*?)\$\$/g;
let m;
while ((m = zhRegex.exec(zh)) !== null) {
  zhFormulas.push({
    full: m[0],        // $$...$$
    inner: m[1],       // content without $$
    offset: m.index    // position in ZH
  });
}
console.log('ZH display formulas:', zhFormulas.length);

// For each ZH formula, find matching context in EN and replace
let enContent = en;
let replaced = 0;
let failed = [];

// Use surrounding text to locate each formula in EN
for (const formula of zhFormulas) {
  const zhInner = formula.inner;

  // Get text before and after the $$ in ZH
  const zhBefore = zh.substring(Math.max(0, formula.offset - 80), formula.offset).trim();
  const zhAfter = zh.substring(formula.offset + formula.full.length, formula.offset + formula.full.length + 80).trim();

  // Find this context in EN
  const enBeforeIdx = enContent.indexOf(zhBefore);
  if (enBeforeIdx === -1) {
    // Try a shorter prefix
    const shortBefore = zhBefore.substring(Math.max(0, zhBefore.length - 40));
    const enBeforeIdx2 = enContent.indexOf(shortBefore);
    if (enBeforeIdx2 === -1) {
      failed.push({ reason: 'before not found', zhInner: zhInner.substring(0, 40) });
      continue;
    }
  }

  const startSearchFrom = enBeforeIdx !== -1 ? enBeforeIdx : enContent.indexOf(shortBefore);
  const enAfterIdx = enContent.indexOf(zhAfter, startSearchFrom);

  if (enAfterIdx === -1) {
    failed.push({ reason: 'after not found', zhInner: zhInner.substring(0, 40) });
    continue;
  }

  // The EN formula region is between startSearchFrom+zhBefore.length and enAfterIdx
  const enFormulaStart = startSearchFrom + zhBefore.length;
  const enFormulaEnd = enAfterIdx;

  // Get the current EN formula text (without $$ delimiters)
  const enOld = enContent.substring(enFormulaStart, enFormulaEnd);

  // The new formula is $$ + zhInner + $$
  const enNew = '$$' + zhInner + '$$';

  if (enOld !== enNew) {
    enContent = enContent.substring(0, enFormulaStart) + enNew + enContent.substring(enFormulaEnd);
    replaced++;
    console.log('Replaced:', zhInner.substring(0, 50));
  }
}

console.log('\nTotal replaced:', replaced, 'Failed:', failed.length);
if (failed.length > 0) {
  console.log('Failed items:');
  failed.forEach(f => console.log(' -', f.reason, ':', f.zhInner));
}

// Verify
const newEnBlocks = [];
let idx = 0;
while (true) {
  const s2 = enContent.indexOf('$$', idx);
  if (s2 === -1) break;
  const e2 = enContent.indexOf('$$', s2+2);
  if (e2 === -1) break;
  newEnBlocks.push(enContent.substring(s2+2, e2));
  idx = e2+2;
}
console.log('New EN $$ blocks:', newEnBlocks.length);
newEnBlocks.slice(0, 5).forEach((b, i) => console.log(' ', i, b.substring(0, 80)));

// Save
s.content_en = enContent;
require('fs').writeFileSync('data/sections.json', JSON.stringify(data, null, 2));
console.log('\nWritten to sections.json');
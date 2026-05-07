#!/usr/bin/env node
/**
 * wrap-math-v9.js
 *
 * Key fixes:
 * 1. findMathCmd uses explicit while loops — when a command is rejected (letter
 *    follows), continues checking other commands at the SAME backslash position
 *    rather than advancing past the backslash.
 * 2. After exhausting all commands at one backslash, advances by one character.
 */
const fs = require('fs');

const MATH_COMMANDS = [
  'longrightarrow', 'Rightarrow', 'leftarrow', 'rightarrow',
  'ldots', 'cdots', 'vdots', 'ddots',
  'timesc', 'timesn',
  'lim', 'sum', 'int', 'partial', 'times', 'to', 'gets', 'mapsto', 'neq',
  'pi', 'epsilon', 'sqrt', 'cdot', 'circ', 'bullet', 'ltimes', 'rtimes',
  'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'sigma', 'omega',
  'Delta', 'Gamma', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega',
  'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'arctan', 'arcsin', 'arccos',
  'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh',
  'frac', 'dfrac', 'binom', 'choose',
  'cup', 'cap', 'land', 'lor', 'neg', 'implies', 'iff',
  'forall', 'exists', 'in', 'notin', 'subset', 'subseteq', 'supseteq', 'supset',
  'emptyset', 'mathbb', 'mathcal', 'mathbf', 'mathrm', 'text', 'textbf', 'textit',
  'hat', 'tilde', 'bar', 'vec', 'dot', 'ddot', 'dotplus', 'dddot',
  'gcd', 'lcm', 'max', 'min', 'sup', 'inf', 'det', 'tr', 'rank',
  'bigl', 'bigr', 'Bigl', 'Bigr', 'left', 'right', 'mid',
  'setminus', 'pm', 'mp', 'div', 'mod',
  'cong', 'equiv', 'approx', 'propto', 'perp', 'parallel', 'sim',
  'le', 'ge', 'll', 'gg',
  'quad', 'qquad', 'hline', 'newline',
];
const SORTED = [...MATH_COMMANDS].sort((a, b) => b.length - a.length);

function findMathCmd(text, startAt) {
  let i = startAt;
  while (i < text.length) {
    if (text[i] !== '\\') { i++; continue; }
    const rest = text.slice(i + 1);
    let cmdIdx = 0;
    while (cmdIdx < SORTED.length) {
      const c = SORTED[cmdIdx];
      if (rest.startsWith(c)) {
        const nextPos = i + 1 + c.length;
        const nextChar = text[nextPos];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          return { cmd: c, start: i, end: nextPos };
        }
        // Command found but letter follows. Try next command at SAME backslash.
        cmdIdx++;
      } else {
        cmdIdx++;
      }
    }
    // No valid command at this backslash. Advance past it.
    i++;
  }
  return null;
}

function extractBraceArg(text, startIdx) {
  let i = startIdx + 1, depth = 1, content = '';
  while (i < text.length && depth > 0) {
    if (text[i] === '{') { depth++; content += text[i++]; }
    else if (text[i] === '}') { depth--; if (depth > 0) content += text[i++]; else i++; }
    else { content += text[i++]; }
  }
  return { content, nextIdx: i };
}

function looksLikeDisplayMath(line) {
  const t = line.trim();
  if (!t || t.length < 4) return false;
  if (t.startsWith('$$') || t.startsWith('$')) return false;
  const mathRatio = (t.match(/[\\\$\d\+\-\*\/\=\(\)\[\]\{\}\.]/g) || []).length / t.length;
  const hasCmd = /\\[a-zA-Z]+/.test(t);
  if (mathRatio > 0.65 && hasCmd) return true;
  const hasEq = t.includes('=');
  if (hasEq && hasCmd && mathRatio > 0.5 && t.split(/\s+/).length <= 22) return true;
  if (/\\frac/.test(t) && mathRatio > 0.5) return true;
  return false;
}

function processMathContent(content) {
  let result = '', i = 0;
  while (i < content.length) {
    const bs = content.indexOf('\\', i);
    if (bs === -1) { result += content.slice(i); break; }
    if (bs > i) { result += content.slice(i, bs); i = bs; continue; }
    const found = findMathCmd(content, i);
    if (!found) { result += content[i]; i++; continue; }
    let expr = '\\' + found.cmd;
    let pos = found.end;
    if (pos < content.length && content[pos] === '_') {
      pos++;
      if (pos < content.length && content[pos] === '{') {
        const { content: sub, nextIdx } = extractBraceArg(content, pos);
        expr += '_{' + processMathContent(sub) + '}';
        pos = nextIdx;
      }
    }
    if (pos < content.length && content[pos] === '^') {
      pos++;
      if (pos < content.length && content[pos] === '{') {
        const { content: sup, nextIdx } = extractBraceArg(content, pos);
        expr += '^{' + processMathContent(sup) + '}';
        pos = nextIdx;
      }
    }
    result += expr;
    i = pos;
  }
  return result;
}

function wrapProseLine(line) {
  let result = '', i = 0;
  while (i < line.length) {
    const bs = line.indexOf('\\', i);
    if (bs === -1) { result += line.slice(i); break; }
    if (bs > i) { result += line.slice(i, bs); i = bs; continue; }
    const found = findMathCmd(line, i);
    if (!found) { result += line[i]; i++; continue; }
    let expr = '\\' + found.cmd;
    let pos = found.end;
    if (pos < line.length && line[pos] === '_') {
      pos++;
      if (pos < line.length && line[pos] === '{') {
        const { content: sub, nextIdx } = extractBraceArg(line, pos);
        expr += '_{' + processMathContent(sub) + '}';
        pos = nextIdx;
      }
    }
    if (pos < line.length && line[pos] === '^') {
      pos++;
      if (pos < line.length && line[pos] === '{') {
        const { content: sup, nextIdx } = extractBraceArg(line, pos);
        expr += '^{' + processMathContent(sup) + '}';
        pos = nextIdx;
      }
    }
    result += '$' + expr + '$';
    i = pos;
  }
  return result;
}

function wrapMathExpressions(content_en) {
  const lines = content_en.split('\n');
  let displayCount = 0, inlineCount = 0;
  const processed = lines.map(line => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith('$$') || t.startsWith('$')) return line;
    if (looksLikeDisplayMath(t)) { displayCount++; return '$$ ' + t + ' $$'; }
    const w = wrapProseLine(line);
    if (w !== line) inlineCount++;
    return w;
  });
  return { content: processed.join('\n'), displayCount, inlineCount, totalWrapped: displayCount + inlineCount };
}

// TESTS
const tests = [
  ['a\\timesc = b\\timesc \\Rightarrow a = b does not work', 'timesc+arrow'],
  ['S = 1 + 1/2 + 1/4 + 1/8 + 1/16 + \\cdots .', 'display series'],
  ['L = lim_{n\\to\\infty} x^n.', 'lim subscript'],
  ['lim_{y\\to0} x^2/(x^2+y^2) = x^2/(x^2+0) = 1', 'limit+frac'],
  ['Thus we seem to have shown that \\lim_{n\\to\\infty} x^n = 0 for all x \\neq 1.', 'text+limit'],
  ['xL = L.', 'short'],
  ['2S = 2 + 1 + 1/2 + 1/4 + 1/8 + \\cdots = 2 + S', 'series'],
  ['\\sqrt2', 'sqrt'],
  ['\\timesc', 'timesc alone'],
  ['\\times', 'times alone'],
  ['lim_{x\\to\\infty} sin(x) = lim_{y+\\pi\\to\\infty} sin(y+\\pi) = lim_{y\\to\\infty} (-sin(y)) = - lim_{y\\to\\infty} sin(y).', 'COMPLEX'],
  ['\\int_0^\\infty e^{-x} dx', 'integral'],
  ['\\sum_{i=1}^\\infty a_i', 'sum'],
  ['d/dx (x^3/(\\epsilon^2+x^2)) = (3x^2(\\epsilon^2+x^2) - 2x^4)/(\\epsilon^2+x^2)^2', 'derivative frac'],
  ['\\partialf/\\partialy (x,y) = (3xy^2(x^2+y^2) - 2xy^4)/(x^2+y^2)^2', 'partial'],
  ['\\bigl( 1 2 3 \\bigr)', 'bigl'],
];

console.log('=== TESTS ===');
tests.forEach(([input, desc]) => {
  const isD = looksLikeDisplayMath(input);
  const out = isD ? '$$ ' + input.trim() + ' $$' : wrapProseLine(input);
  console.log(desc + ':', JSON.stringify(out.substring(0, 100)));
});

// RUN
const data = JSON.parse(fs.readFileSync('./data/sections.json', 'utf8'));
const sec = data.chapters[0].sections['1'];
const before = sec.content_en;
const result = wrapMathExpressions(before);

console.log('\n=== SECTION 1.2 ===');
console.log('Display:', result.displayCount, '| Inline:', result.inlineCount, '| Total:', result.totalWrapped);

// Corruption checks
const lines = result.content.split('\n');
let corrupt = 0;
lines.forEach((l, i) => {
  const trimmed = l.trim();
  const dd = l.match(/\$\$/g);
  if (dd && dd.length >= 2 && !trimmed.startsWith('$$')) {
    console.log('DOUBLE $$ at line', i+1, ':', JSON.stringify(l.substring(0,80)));
    corrupt++;
  }
});
console.log('Corrupted lines:', corrupt);

console.log('\n=== SAMPLE (first 3000 chars) ===');
console.log(result.content.substring(0, 3000));

// Verify specific lines
const verifyLines = [
  'L = lim_{n\\to\\infty} x^n.',
  'lim_{x\\to\\infty} sin(x) = lim_{y+\\pi\\to\\infty} sin(y+\\pi)',
  'a\\timesc = b\\timesc \\Rightarrow a = b does not work',
  '2S = 2 + 1 + 1/2 + 1/4 + 1/8 + \\cdots = 2 + S',
  'lim_{y+\\pi\\to\\infty}',
  'L = lim_{m+1\\to\\infty} x^{m+1}',
];
console.log('\n=== VERIFY SPECIFIC ===');
const resultLines = result.content.split('\n');
const beforeLines = before.split('\n');
verifyLines.forEach(search => {
  const idx = beforeLines.findIndex(l => l.includes(search));
  if (idx >= 0) {
    console.log('BEFORE:', JSON.stringify(beforeLines[idx].substring(0,100)));
    console.log('AFTER: ', JSON.stringify(resultLines[idx].substring(0,100)));
  }
});

const beforeRaw = (before.match(/\\[a-zA-Z]+/g) || []).length;
const afterWrapped = (result.content.match(/\$\\[a-zA-Z]+/g) || []).length;
console.log('\nBefore raw commands:', beforeRaw);
console.log('After $-wrapped:', afterWrapped);

data.chapters[0].sections['1'].content_en = result.content;
fs.writeFileSync('./data/sections.json', JSON.stringify(data, null, 2), 'utf8');
console.log('\n=== Written to data/sections.json ===');
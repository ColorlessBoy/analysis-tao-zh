#!/usr/bin/env node
const fs = require('fs');

const MATH_COMMANDS = [
  'longrightarrow', 'Rightarrow', 'leftarrow', 'rightarrow', 'longrightarrow',
  'ldots', 'cdots', 'vdots', 'ddots', 'ldots',
  'lim', 'sum', 'int', 'partial', 'times', 'to', 'gets', 'neq', 'mapsto',
  'pi', 'epsilon', 'sqrt', 'cdot', 'circ', 'bullet',
  'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'sigma', 'omega',
  'Delta', 'Gamma', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega',
  'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'arctan', 'arcsin', 'arccos',
  'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh',
  'frac', 'dfrac', 'binom', 'choose', 'sqrt',
  'cup', 'cap', 'land', 'lor', 'neg', 'implies', 'iff',
  'forall', 'exists', 'in', 'notin', 'subset', 'subseteq', 'supseteq', 'supset',
  'emptyset', 'mathbb', 'mathcal', 'mathbf', 'mathrm', 'text', 'textbf', 'textit',
  'hat', 'tilde', 'bar', 'vec', 'dot', 'ddot', 'dotplus', 'dddot',
  'gcd', 'lcm', 'max', 'min', 'sup', 'inf', 'det', 'tr', 'rank',
  'timesc', 'timesn',
  'bigl', 'bigr', 'Bigl', 'Bigr', 'left', 'right', 'mid',
  'setminus', 'pm', 'mp', 'div', 'mod', 'setminus',
  'cong', 'equiv', 'approx', 'propto', 'perp', 'parallel', 'sim',
  'le', 'ge', 'll', 'gg', 'ne', 'le', 'ge',
  'quad', 'qquad', 'hline', 'newline',
  'bar', 'breve', 'check', 'acute', 'grave',
];

function parseMathSequence(text) {
  if (!text || text[0] !== '\\') {
    return { seq: '', rest: text, isMath: false };
  }

  let pos = 1, cmd = null;
  for (const c of MATH_COMMANDS) {
    const slice = text.slice(1, 1 + c.length);
    if (slice === c) {
      const nextPos = 1 + c.length;
      if (nextPos >= text.length || !/[a-zA-Z]/.test(text[nextPos])) {
        cmd = c; pos += c.length; break;
      }
    }
  }

  if (!cmd) {
    return { seq: '', rest: text, isMath: false, skipped: true };
  }

  let math = '\\' + cmd;
  let rest = text.slice(pos);

  // Subscript
  if (rest.length > 0 && rest[0] === '_') {
    rest = rest.slice(1);
    if (rest.length > 0 && rest[0] === '{') {
      // Find matching }
      let i = 1, depth = 1, sub = '';
      while (i < rest.length && depth > 0) {
        if (rest[i] === '{') depth++;
        else if (rest[i] === '}') depth--;
        if (depth > 0) sub += rest[i++];
      }
      math += '_{' + sub + '}';
      if (i < rest.length && rest[i] === '}') i++;
      rest = rest.slice(i);
    } else {
      let sub = '';
      while (rest.length > 0 && /[a-zA-Z0-9]/.test(rest[0])) {
        sub += rest[0];
        rest = rest.slice(1);
      }
      if (sub) math += '_{' + sub + '}';
    }
  }

  // Superscript
  if (rest.length > 0 && rest[0] === '^') {
    rest = rest.slice(1);
    if (rest.length > 0 && rest[0] === '{') {
      let i = 1, depth = 1, sup = '';
      while (i < rest.length && depth > 0) {
        if (rest[i] === '{') depth++;
        else if (rest[i] === '}') depth--;
        if (depth > 0) sup += rest[i++];
      }
      math += '^{' + sup + '}';
      if (i < rest.length && rest[i] === '}') i++;
      rest = rest.slice(i);
    } else {
      let sup = '';
      while (rest.length > 0 && /[a-zA-Z0-9]/.test(rest[0])) {
        sup += rest[0];
        rest = rest.slice(1);
      }
      if (sup) math += '^{' + sup + '}';
    }
  }

  return { seq: math, rest, isMath: true, cmd };
}

// Wrap inline commands inside subscript/superscript content WITHOUT adding $...$
// (they're part of a larger expression that will be wrapped as a whole)
function wrapContentWithoutDelimiters(content) {
  let result = '', rest = content;
  while (rest.length > 0) {
    const idx = rest.indexOf('\\');
    if (idx === -1) { result += rest; break; }
    if (idx > 0) { result += rest.slice(0, idx); rest = rest.slice(idx); }
    const parsed = parseMathSequence(rest);
    if (parsed.isMath && parsed.seq) {
      result += parsed.seq;
      rest = parsed.rest;
    } else {
      result += rest[0];
      rest = rest.slice(1);
    }
  }
  return result;
}

function looksLikeDisplayMathLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return false;
  const mathChars = (trimmed.match(/[\\\$\d\+\-\*\/\=\(\)\[\]\{\}\.]/g) || []).length;
  const ratio = mathChars / trimmed.length;
  const hasCmd = /\\[a-zA-Z]+/.test(trimmed);
  const hasEq = trimmed.includes('=');
  const hasFrac = /\\\d+\//.test(trimmed) || /\\frac/.test(trimmed);
  if (ratio > 0.7 && hasCmd) return true;
  if (hasEq && hasCmd && ratio > 0.5 && trimmed.split(/\s+/).length <= 20) return true;
  if (hasFrac && ratio > 0.5) return true;
  return false;
}

function processProseLine(line) {
  let result = '';
  let rest = line;

  while (rest.length > 0) {
    const idx = rest.indexOf('\\');
    if (idx === -1) { result += rest; break; }
    if (idx > 0) {
      result += rest.slice(0, idx);
      rest = rest.slice(idx);
    }

    const parsed = parseMathSequence(rest);
    if (parsed.isMath && parsed.seq) {
      // Found a math command. The parsed.seq is WITHOUT $ wrappers.
      // Check if there's a subscript/superscript that follows
      
      // We already consumed subscript/superscript inside parseMathSequence.
      // Now just wrap the whole thing in $...$
      result += '$' + parsed.seq + '$';
      rest = parsed.rest;
    } else {
      result += rest[0];
      rest = rest.slice(1);
    }
  }

  return result;
}

function wrapMathExpressions(content_en) {
  const lines = content_en.split('\n');
  let displayCount = 0;
  let inlineCount = 0;

  const processed = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Already wrapped?
    if (trimmed.startsWith('$$') || trimmed.startsWith('$')) {
      return line;
    }

    if (looksLikeDisplayMathLine(trimmed)) {
      displayCount++;
      return '$$ ' + trimmed + ' $$';
    }

    const wrapped = processProseLine(line);
    if (wrapped !== line) inlineCount++;
    return wrapped;
  });

  return {
    content: processed.join('\n'),
    displayCount,
    inlineCount,
    totalWrapped: displayCount + inlineCount,
  };
}

// Tests
const tests = [
  ['the cancellation law a\\timesc = b\\timesc \\Rightarrow a = b does not work', false],
  ['S = 1 + 1/2 + 1/4 + 1/8 + 1/16 + \\cdots .', true],
  ['L = lim_{n\\to\\infty} x^n.', false],
  ['lim_{y\\to0} x^2/(x^2+y^2) = x^2/(x^2+0) = 1', false],
  ['Thus we seem to have shown that \\lim_{n\\to\\infty} x^n = 0 for all x \\neq 1.', false],
  ['xL = L.', false],
  ['2S = 2 + 1 + 1/2 + 1/4 + 1/8 + \\cdots = 2 + S', false],
  ['$$ S = 1 + 1/2 + \\cdots $$', false],
  ['S = 1 + 2 + 4 + 8 + 16 + \\cdots', false],
  ['\\bigl( 1 2 3 \\bigr)', false],
  ['\\partialf/\\partialx (0,0)', false],
  ['\\sum_{i=1}^\\infty', false],
  ['\\int_0^\\infty', false],
  ['d/dx (x^3/(\\epsilon^2+x^2)) = (3x^2(\\epsilon^2+x^2) - 2x^4)/(\\epsilon^2+x^2)^2', false],
];

console.log('=== TEST RESULTS ===');
tests.forEach(([t, expectedDisplay]) => {
  const isDisplay = looksLikeDisplayMathLine(t);
  const processed = isDisplay ? '$$ ' + t.trim() + ' $$' : processProseLine(t);
  const status = (isDisplay === expectedDisplay) ? 'OK' : 'FAIL';
  const mark = isDisplay ? 'DISPLAY' : 'PROSE  ';
  const out = processed.length > 90 ? processed.substring(0, 87) + '...' : processed;
  console.log('[' + status + '] [' + mark + '] ' + out);
});

const data = JSON.parse(fs.readFileSync('./data/sections.json', 'utf8'));
const section1_2 = data.chapters[0].sections['1'];
const result = wrapMathExpressions(section1_2.content_en);

console.log('\n=== SECTION 1.2 WRAPPING RESULTS ===');
console.log('Display math lines wrapped:', result.displayCount);
console.log('Inline math expressions wrapped:', result.inlineCount);
console.log('Total wrapped:', result.totalWrapped);

console.log('\n=== SAMPLE OUTPUT (first 5000 chars) ===');
console.log(result.content.substring(0, 5000));

// Write back
data.chapters[0].sections['1'].content_en = result.content;
fs.writeFileSync('./data/sections.json', JSON.stringify(data, null, 2), 'utf8');
console.log('\n=== Written to data/sections.json ===');

// Before/after stats
const before = section1_2.content_en;
const after = result.content;
const beforeDollars = (before.match(/\$\$/g) || []).length;
const afterDollars = (after.match(/\$\$/g) || []).length;
const beforeSlash = (before.match(/\\[a-zA-Z]+/g) || []).length;
const afterSlash = (after.match(/\$\\[a-zA-Z]+/g) || []).length;
console.log('Before: ' + beforeDollars + ' $$ pairs, ' + beforeSlash + ' raw math commands');
console.log('After: ' + afterDollars + ' $$ pairs, ' + afterSlash + ' $$-wrapped commands');
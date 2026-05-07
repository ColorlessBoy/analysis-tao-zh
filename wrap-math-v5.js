#!/usr/bin/env node
const fs = require('fs');

const MATH_COMMANDS = [
  'longrightarrow', 'Rightarrow', 'leftarrow', 'rightarrow', 'longrightarrow',
  'ldots', 'cdots', 'vdots', 'ddots',
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
  'timesc', 'timesn',
  'bigl', 'bigr', 'Bigl', 'Bigr', 'left', 'right', 'mid',
  'setminus', 'pm', 'mp', 'div', 'mod',
  'cong', 'equiv', 'approx', 'propto', 'perp', 'parallel', 'sim',
  'le', 'ge', 'll', 'gg',
  'quad', 'qquad', 'hline', 'newline',
];

// Sort by length descending to match longest first
const SORTED_CMDS = [...MATH_COMMANDS].sort((a, b) => b.length - a.length);

function findFirstMathCommand(text) {
  // Find the first math command in text
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\') continue;
    const rest = text.slice(i + 1);
    for (const c of SORTED_CMDS) {
      if (rest.startsWith(c)) {
        const nextPos = i + 1 + c.length;
        const nextChar = text[nextPos];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          return { cmd: c, start: i, end: nextPos };
        }
      }
    }
  }
  return null;
}

function parseMathContent(text) {
  // Parse subscript/superscript/brace content, but DON'T add delimiters
  let rest = text;
  let result = '';
  
  while (rest.length > 0) {
    const idx = rest.indexOf('\\');
    if (idx === -1) { result += rest; break; }
    if (idx > 0) { result += rest.slice(0, idx); rest = rest.slice(idx); }
    
    const found = findFirstMathCommand(rest);
    if (found) {
      result += '\\' + found.cmd;
      rest = rest.slice(1 + found.cmd.length); // skip '\' and cmd
      
      // Parse subscript
      if (rest.length > 0 && rest[0] === '_') {
        rest = rest.slice(1);
        if (rest.length > 0 && rest[0] === '{') {
          let i = 1, depth = 1, content = '';
          while (i < rest.length && depth > 0) {
            if (rest[i] === '{') depth++;
            else if (rest[i] === '}') depth--;
            if (depth > 0) content += rest[i++];
          }
          result += '_{' + parseMathContent(content) + '}';
          if (i < rest.length && rest[i] === '}') i++;
          rest = rest.slice(i);
        } else {
          let sub = '';
          while (rest.length > 0 && /[a-zA-Z0-9]/.test(rest[0])) {
            sub += rest[0];
            rest = rest.slice(1);
          }
          if (sub) result += '_' + sub;
        }
      }
      
      // Parse superscript
      if (rest.length > 0 && rest[0] === '^') {
        rest = rest.slice(1);
        if (rest.length > 0 && rest[0] === '{') {
          let i = 1, depth = 1, content = '';
          while (i < rest.length && depth > 0) {
            if (rest[i] === '{') depth++;
            else if (rest[i] === '}') depth--;
            if (depth > 0) content += rest[i++];
          }
          result += '^{' + parseMathContent(content) + '}';
          if (i < rest.length && rest[i] === '}') i++;
          rest = rest.slice(i);
        } else {
          let sup = '';
          while (rest.length > 0 && /[a-zA-Z0-9]/.test(rest[0])) {
            sup += rest[0];
            rest = rest.slice(1);
          }
          if (sup) result += '^' + sup;
        }
      }
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

    // At a backslash - find if it's a math command
    const found = findFirstMathCommand(rest);
    if (!found) {
      result += rest[0];
      rest = rest.slice(1);
      continue;
    }

    // It's a math command. Collect the full expression
    let mathExpr = '\\' + found.cmd;
    let remaining = rest.slice(1 + found.cmd.length);

    // Check for subscript
    if (remaining.length > 0 && remaining[0] === '_') {
      remaining = remaining.slice(1);
      if (remaining.length > 0 && remaining[0] === '{') {
        let i = 1, depth = 1, subContent = '';
        while (i < remaining.length && depth > 0) {
          if (remaining[i] === '{') depth++;
          else if (remaining[i] === '}') depth--;
          if (depth > 0) subContent += remaining[i++];
        }
        // Recursively parse subscript content without adding delimiters
        const parsedSub = parseMathContent(subContent);
        mathExpr += '_{' + parsedSub + '}';
        if (i < remaining.length && remaining[i] === '}') i++;
        remaining = remaining.slice(i);
      } else {
        let sub = '';
        while (remaining.length > 0 && /[a-zA-Z0-9]/.test(remaining[0])) {
          sub += remaining[0];
          remaining = remaining.slice(1);
        }
        if (sub) mathExpr += '_' + sub;
      }
    }

    // Check for superscript
    if (remaining.length > 0 && remaining[0] === '^') {
      remaining = remaining.slice(1);
      if (remaining.length > 0 && remaining[0] === '{') {
        let i = 1, depth = 1, supContent = '';
        while (i < remaining.length && depth > 0) {
          if (remaining[i] === '{') depth++;
          else if (remaining[i] === '}') depth--;
          if (depth > 0) supContent += remaining[i++];
        }
        const parsedSup = parseMathContent(supContent);
        mathExpr += '^{' + parsedSup + '}';
        if (i < remaining.length && remaining[i] === '}') i++;
        remaining = remaining.slice(i);
      } else {
        let sup = '';
        while (remaining.length > 0 && /[a-zA-Z0-9]/.test(remaining[0])) {
          sup += remaining[0];
          remaining = remaining.slice(1);
        }
        if (sup) mathExpr += '^' + sup;
      }
    }

    // Wrap in $...$
    result += '$' + mathExpr + '$';
    rest = remaining;
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
    if (trimmed.startsWith('$$') || trimmed.startsWith('$')) return line;

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
  ['But if m+1 \\to \\infty, then m \\to \\infty, thus', false],
  ['\\bigl( 1  0  0  0  ... \\bigr)', false],
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

data.chapters[0].sections['1'].content_en = result.content;
fs.writeFileSync('./data/sections.json', JSON.stringify(data, null, 2), 'utf8');
console.log('\n=== Written to data/sections.json ===');

const before = section1_2.content_en;
const after = result.content;
const beforeDollars = (before.match(/\$\$/g) || []).length;
const afterDollars = (after.match(/\$\$/g) || []).length;
const beforeCmd = (before.match(/\\[a-zA-Z]+/g) || []).length;
const afterWrapped = (after.match(/\$\\[a-zA-Z]+/g) || []).length;
console.log('Before: ' + beforeDollars + ' $$ pairs, ' + beforeCmd + ' raw commands');
console.log('After: ' + afterDollars + ' $$ pairs, ' + afterWrapped + ' $$-wrapped commands');
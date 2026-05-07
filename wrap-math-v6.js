#!/usr/bin/env node
/**
 * wrap-math-v6.js
 * Wraps bare math LaTeX commands in $...$ (inline) or $$...$$ (display) delimiters.
 * Handles nested subscript/superscript by finding commands WITHIN subscript/superscript
 * content and wrapping the ENTIRE expression as one $...$ block.
 */
const fs = require('fs');

// Sort commands longest-first for greedy matching
const MATH_COMMANDS = [
  'longrightarrow', 'Rightarrow', 'leftarrow', 'rightarrow',
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
  'bigl', 'bigr', 'Bigl', 'Bigr', 'left', 'right', 'mid',
  'setminus', 'pm', 'mp', 'div', 'mod',
  'cong', 'equiv', 'approx', 'propto', 'perp', 'parallel', 'sim',
  'le', 'ge', 'll', 'gg',
  'quad', 'qquad', 'hline', 'newline',
];
const CMD_SET = new Set(MATH_COMMANDS);
const SORTED_CMDS = [...MATH_COMMANDS].sort((a, b) => b.length - a.length);

function findMathCommand(text, startAt) {
  // Find first math command at or after startAt position
  for (let i = startAt; i < text.length; i++) {
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

/**
 * Find all math command positions in a string.
 */
function findAllMathCommands(text) {
  const positions = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\') continue;
    const rest = text.slice(i + 1);
    for (const c of SORTED_CMDS) {
      if (rest.startsWith(c)) {
        const nextPos = i + 1 + c.length;
        const nextChar = text[nextPos];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          positions.push({ cmd: c, start: i, end: nextPos });
          break;
        }
      }
    }
  }
  return positions;
}

/**
 * Extract the full subscript or superscript argument after _ or ^.
 * Returns { content, nextIndex } where content is the text inside {} (without braces).
 */
function extractBraceArg(text, startIdx) {
  // text[startIdx] should be '{'
  let i = startIdx + 1, depth = 1, content = '';
  while (i < text.length && depth > 0) {
    if (text[i] === '{') { depth++; content += text[i++]; }
    else if (text[i] === '}') { depth--; if (depth > 0) content += text[i++]; else i++; }
    else { content += text[i++]; }
  }
  return { content, nextIdx: i };
}

/**
 * Check if a line looks like display math (a standalone equation line).
 */
function looksLikeDisplayMathLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 4) return false;
  // Already delimited
  if (trimmed.startsWith('$$') || trimmed.startsWith('$')) return false;
  // Has a lot of math symbols
  const mathChars = (trimmed.match(/[\\\$\d\+\-\*\/\=\(\)\[\]\{\}\.]/g) || []).length;
  const ratio = mathChars / trimmed.length;
  // Has at least one command
  const hasCmd = /\\[a-zA-Z]+/.test(trimmed);
  // Mostly math symbols with a command → likely display
  if (ratio > 0.65 && hasCmd) return true;
  // Has = and a command, relatively short, heavy math ratio
  const hasEq = trimmed.includes('=');
  if (hasEq && hasCmd && ratio > 0.5 && trimmed.split(/\s+/).length <= 22) return true;
  // Contains \frac
  if (/\\frac/.test(trimmed) && ratio > 0.5) return true;
  return false;
}

/**
 * Check if a line appears to be prose (narrative text, starts with lowercase or is short).
 */
function isProseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length < 3) return false;
  // If it starts with an uppercase word-like token, might be a definition/equation
  // If it starts with a lowercase letter, definitely prose
  if (/^[a-z]/.test(trimmed)) return true;
  // Count common prose words
  const proseWords = (trimmed.match(/\b(the|is|and|or|to|of|in|that|which|for|with|as|by|we|you|if|then|so|can|have|has|this|it|from|at|on|an|not|when|where|how|what|who|are|but|will|would|be|because|thus|hence|also|one|such|any|all|each|some|no|more|less|than|just|only|even|ever|never|always|never|often|usually|then|there|here|now|again|still|already|always|again)\b/gi) || []).length;
  const tokenCount = trimmed.split(/\s+/).length;
  if (proseWords >= 2 && proseWords / tokenCount > 0.15) return true;
  // Short lines that aren't clearly equations
  if (tokenCount <= 8 && !/^[A-Z][a-z]+\s+[A-Z]/.test(trimmed) && !/^\$[A-Z]/.test(trimmed)) return true;
  return false;
}

/**
 * Wrap math commands in a line of prose text.
 * Strategy: find ALL math commands in the line, then for each one collect
 * its subscript/superscript (if any) and wrap the ENTIRE thing as $...$.
 * We process left-to-right, skipping already-wrapped regions.
 */
function wrapProseLine(line) {
  let result = '';
  let i = 0;
  const len = line.length;

  while (i < len) {
    // Find next backslash
    const bsIdx = line.indexOf('\\', i);
    if (bsIdx === -1) { result += line.slice(i); break; }
    if (bsIdx > i) { result += line.slice(i, bsIdx); i = bsIdx; }

    // At a backslash at position i
    const found = findMathCommand(line, i);
    if (!found) { result += line[i]; i++; continue; }

    // Found a command at found.start (=i)
    // Build the full expression: \cmd_{sub}^{sup}
    let expr = '\\' + found.cmd;
    let pos = found.end; // position after the command name

    // Check for subscript
    if (pos < len && line[pos] === '_') {
      pos++; // skip _
      if (pos < len && line[pos] === '{') {
        const { content, nextIdx } = extractBraceArg(line, pos);
        // IMPORTANT: recursively wrap commands inside the subscript content
        const wrappedSub = wrapContentMath(content);
        expr += '_{' + wrappedSub + '}';
        pos = nextIdx;
      } else {
        // Bare subscript (single token)
        let sub = '';
        while (pos < len && /[a-zA-Z0-9]/.test(line[pos])) { sub += line[pos++]; }
        if (sub) expr += '_' + sub;
      }
    }

    // Check for superscript
    if (pos < len && line[pos] === '^') {
      pos++; // skip ^
      if (pos < len && line[pos] === '{') {
        const { content, nextIdx } = extractBraceArg(line, pos);
        const wrappedSup = wrapContentMath(content);
        expr += '^{' + wrappedSup + '}';
        pos = nextIdx;
      } else {
        let sup = '';
        while (pos < len && /[a-zA-Z0-9]/.test(line[pos])) { sup += line[pos++]; }
        if (sup) expr += '^' + sup;
      }
    }

    result += '$' + expr + '$';
    i = pos;
  }

  return result;
}

/**
 * Wrap math commands INSIDE content (used for subscript/superscript content).
 * Does NOT add $...$ delimiters — just finds commands and wraps them as \cmd.
 * But since MathJax needs the entire expression in $...$, and the subscript/superscript
 * is ALREADY part of the outer $...$ block, we just return the content with commands
 * marked (no extra $ inside).
 *
 * Actually: when we have \lim_{n\to\infty}, the subscript content is "n\to\infty".
 * We need to find \to and \infty inside it. The outer wrapProseLine will add $ around
 * the whole \lim_{n\to\infty}. Inside the subscript, \to and \infty should NOT get
 * their own $ wrappers — they're part of the larger expression.
 *
 * So wrapContentMath just finds commands and ensures they're not double-wrapped.
 */
function wrapContentMath(content) {
  let result = '';
  let i = 0;
  const len = content.length;

  while (i < len) {
    const bsIdx = content.indexOf('\\', i);
    if (bsIdx === -1) { result += content.slice(i); break; }
    if (bsIdx > i) { result += content.slice(i, bsIdx); i = bsIdx; }

    const found = findMathCommand(content, i);
    if (!found) { result += content[i]; i++; continue; }

    // Found a command. Collect its subscript/superscript if any.
    let expr = '\\' + found.cmd;
    let pos = found.end;

    if (pos < len && content[pos] === '_') {
      pos++;
      if (pos < len && content[pos] === '{') {
        const { content: sub, nextIdx } = extractBraceArg(content, pos);
        expr += '_{' + wrapContentMath(sub) + '}';
        pos = nextIdx;
      } else {
        let sub = '';
        while (pos < len && /[a-zA-Z0-9]/.test(content[pos])) { sub += content[pos++]; }
        if (sub) expr += '_' + sub;
      }
    }

    if (pos < len && content[pos] === '^') {
      pos++;
      if (pos < len && content[pos] === '{') {
        const { content: sup, nextIdx } = extractBraceArg(content, pos);
        expr += '^{' + wrapContentMath(sup) + '}';
        pos = nextIdx;
      } else {
        let sup = '';
        while (pos < len && /[a-zA-Z0-9]/.test(content[pos])) { sup += content[pos++]; }
        if (sup) expr += '^' + sup;
      }
    }

    result += expr;
    i = pos;
  }

  return result;
}

/**
 * Main wrapping function for the entire content.
 */
function wrapMathExpressions(content_en) {
  const lines = content_en.split('\n');
  let displayCount = 0;
  let inlineCount = 0;

  const processed = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Already wrapped?
    if (trimmed.startsWith('$$') || trimmed.startsWith('$')) return line;

    // Display math detection
    if (looksLikeDisplayMathLine(trimmed)) {
      displayCount++;
      return '$$ ' + trimmed + ' $$';
    }

    const wrapped = wrapProseLine(line);
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

// === TESTS ===
const tests = [
  ['the cancellation law a\\timesc = b\\timesc \\Rightarrow a = b does not work', 'PROSE'],
  ['S = 1 + 1/2 + 1/4 + 1/8 + 1/16 + \\cdots .', 'DISPLAY'],
  ['L = lim_{n\\to\\infty} x^n.', 'PROSE'],
  ['lim_{y\\to0} x^2/(x^2+y^2) = x^2/(x^2+0) = 1', 'PROSE'],
  ['Thus we seem to have shown that \\lim_{n\\to\\infty} x^n = 0 for all x \\neq 1.', 'PROSE'],
  ['xL = L.', 'PROSE'],
  ['2S = 2 + 1 + 1/2 + 1/4 + 1/8 + \\cdots = 2 + S', 'PROSE'],
  ['$$ S = 1 + 1/2 + \\cdots $$', 'ALREADY'],
  ['S = 1 + 2 + 4 + 8 + 16 + \\cdots', 'PROSE'],
  ['\\bigl( 1 2 3 \\bigr)', 'PROSE'],
  ['d/dx (x^3/(\\epsilon^2+x^2)) = (3x^2(\\epsilon^2+x^2) - 2x^4)/(\\epsilon^2+x^2)^2', 'PROSE'],
  ['But if m+1 \\to \\infty, then m \\to \\infty, thus', 'PROSE'],
  ['\\bigl( 1  0  0  0  ... \\bigr)', 'PROSE'],
  ['\\int_0^\\infty e^{-x} dx', 'PROSE'],
  ['\\sum_{i=1}^\\infty a_i', 'PROSE'],
  ['\\partialf/\\partialx (0,0)', 'PROSE'],
  ['the left-hand side of (1.1) is \\int_0^\\infty e^{-x} dx = [-e^{-x}]_0^\\infty = 1.', 'PROSE'],
  ['lim_{y\\to\\infty} \\int_{-\\infty}^\\infty 1/(1+(x-y)^2) dx', 'PROSE'],
  ['lim_{n\\to\\infty} x^n = 0 for all x \\neq 1.', 'PROSE'],
  ['\\sqrt2', 'PROSE'],
];

console.log('=== TESTS ===');
tests.forEach(([t, expected]) => {
  if (expected === 'ALREADY') { console.log('[SKIP] ' + t); return; }
  const isDisplay = looksLikeDisplayMathLine(t);
  const type = isDisplay ? 'DISPLAY' : 'PROSE  ';
  const processed = isDisplay ? '$$ ' + t.trim() + ' $$' : wrapProseLine(t);
  const ok = (isDisplay && expected === 'DISPLAY') || (!isDisplay && expected === 'PROSE');
  const status = ok ? 'OK' : 'FAIL';
  const out = processed.length > 100 ? processed.substring(0, 97) + '...' : processed;
  console.log('[' + status + '] [' + type + '] ' + out);
});

// === RUN ON FILE ===
const data = JSON.parse(fs.readFileSync('./data/sections.json', 'utf8'));
const section1_2 = data.chapters[0].sections['1'];
const beforeContent = section1_2.content_en;
const result = wrapMathExpressions(beforeContent);

console.log('\n=== SECTION 1.2 RESULTS ===');
console.log('Display lines wrapped:', result.displayCount);
console.log('Inline expressions wrapped:', result.inlineCount);
console.log('Total wrapped:', result.totalWrapped);

// Check for corruption patterns
const afterContent = result.content;
const doubleDollar = (afterContent.match(/\$\$/g) || []).length;
const badPatterns = [
  '\$\$[^$]*\$\$',  // double dollar wrapping
  '\\$[^$]*\\$[^$]*\\$',  // nested $ inside $
];
console.log('\n=== CORRUPTION CHECK ===');
console.log('Total $$ count:', doubleDollar);

// Check specific known issues
const issues = [];
// Issue 1: $\cmd$ (command wrapped individually inside a subscript line)
const lines = afterContent.split('\n');
lines.forEach((l, i) => {
  if (l.includes('\$') && l.includes('\\') && l.includes('fty')) {
    issues.push({ line: i+1, text: l.substring(0, 120), type: 'fty' });
  }
  if (l.includes('\$\$') && !l.trim().startsWith('\$\$')) {
    issues.push({ line: i+1, text: l.substring(0, 120), type: 'doubleDollar' });
  }
});
console.log('Issues found:', issues.length);
issues.slice(0,5).forEach(({line, text, type}) => {
  console.log('Line', line, '(' + type + '):', JSON.stringify(text));
});

console.log('\n=== SAMPLE (first 3000 chars) ===');
console.log(afterContent.substring(0, 3000));

data.chapters[0].sections['1'].content_en = afterContent;
fs.writeFileSync('./data/sections.json', JSON.stringify(data, null, 2), 'utf8');
console.log('\n=== Written to data/sections.json ===');

// Stats
const beforeRaw = (beforeContent.match(/\\[a-zA-Z]+/g) || []).length;
const afterWrapped = (afterContent.match(/\$\\[a-zA-Z]+/g) || []).length;
console.log('Before: raw commands:', beforeRaw);
console.log('After: $-wrapped commands:', afterWrapped);
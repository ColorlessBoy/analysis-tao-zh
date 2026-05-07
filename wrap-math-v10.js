// wrap-math-v10.js - Fixed: skip past prefix-matching commands, fix subscript/superscript consumption
const fs = require('fs');

const MATH_COMMANDS = [
  'longrightarrow','Rightarrow','leftarrow','rightarrow',
  'ldots','cdots','vdots','ddots',
  'timesc','timesn','lim','sum','int','partial','times',
  'to','gets','mapsto','neq','pi','epsilon','sqrt','cdot','circ','bullet',
  'ltimes','rtimes',
  'sin','cos','tan','log','ln','exp','arctan','arcsin','arccos',
  'sec','csc','cot','sinh','cosh','tanh',
  'frac','dfrac','binom','choose',
  'cup','cap','land','lor','neg','implies','iff',
  'forall','exists','in','notin','subset','subseteq','supseteq','supset','emptyset',
  'mathbb','mathcal','mathbf','mathrm','text','textbf','textit',
  'hat','tilde','bar','vec','dot','ddot','dotplus','dddot',
  'gcd','lcm','max','min','sup','inf','det','tr','rank',
  'bigl','bigr','Bigl','Bigr','left','right','mid','setminus',
  'pm','mp','div','mod','cong','equiv','approx','propto',
  'perp','parallel','sim','le','ge','ll','gg','quad','qquad','hline','newline'
];

const SORTED = [...MATH_COMMANDS].sort((a, b) => b.length - a.length);

// ── findMathCmd: scan for a command at a backslash position ──────────────────
// Rules: match longest command first (greedy). If a command is found but
// rejected because a letter follows, skip past that entire word and retry.
function findMathCmd(text, startAt) {
  let i = startAt;
  while (i < text.length) {
    if (text[i] !== '\\') { i++; continue; }
    const rest = text.slice(i + 1);
    let rejectedCmd = null;
    for (const c of SORTED) {
      if (rest.startsWith(c)) {
        const nextPos = i + 1 + c.length;
        const nextChar = text[nextPos];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          return { cmd: c, start: i, end: nextPos };
        }
        // Letter follows → prefix-match. Skip past this word and retry.
        if (rejectedCmd === null) rejectedCmd = c;
      }
    }
    if (rejectedCmd) {
      i += rejectedCmd.length + 1; // skip past the word we just checked
    } else {
      // No command at this backslash at all; jump to next backslash
      const nextBs = text.indexOf('\\', i + 1);
      if (nextBs === -1) return null;
      i = nextBs;
    }
  }
  return null;
}

// ── Extract braced argument, tracking nested braces ──────────────────────────
function extractBraceArg(text, startIdx) {
  let i = startIdx + 1, depth = 1, content = '';
  while (i < text.length && depth > 0) {
    if (text[i] === '{') { depth++; content += text[i++]; }
    else if (text[i] === '}') { depth--; if (depth > 0) content += text[i++]; else i++; }
    else { content += text[i++]; }
  }
  return { content, nextIdx: i };
}

// ── Recursively process math content (subscript/superscript inner text) ───────
// Does NOT add $ delimiters; returns raw processed text with commands preserved.
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

// ── Wrap a single line of prose (inline math) ────────────────────────────────
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

// ── Detect display math lines (standalone math, wrap in $$...$$) ────────────
function looksLikeDisplayMathLine(line) {
  const stripped = line.replace(/\$\$?/g, '').trim();
  if (!stripped) return false;
  const tokens = stripped.split(/\s+/);
  if (tokens.length < 3) return false;
  const hasEquals = tokens.includes('=');
  const hasCmd = /\bx\b|[=<>]|[\\(){}]|\b\d+\b/.test(stripped);
  const startsUpper = /^[A-Z0-9]/.test(stripped);
  const startsLower = /^[a-z\\]/.test(stripped);
  const mathRatio = (stripped.match(/[\\^_(){}]/g) || []).length / stripped.length;
  return hasEquals && hasCmd && (startsUpper || (startsLower && mathRatio > 0.2));
}

// ── Main ─────────────────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync('data/sections.json', 'utf8'));
const sec = data.chapters[0].sections['1'];
const lines = sec.content_en.split('\n');
const out = lines.map(line => {
  if (/^\$\$/.test(line)) return line; // already $$ wrapped
  if (looksLikeDisplayMathLine(line)) return '$$ ' + wrapProseLine(line.trim()) + ' $$';
  return wrapProseLine(line);
});
sec.content_en = out.join('\n');

fs.writeFileSync('data/sections.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Done. Wrote data/sections.json');

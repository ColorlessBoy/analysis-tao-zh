/**
 * wrap-math-v12.js
 * Strategy: find ALL backslash commands, wrap with $...$, handle sub/sup scripts recursively.
 * Key fix: after rejecting a prefix-match at a backslash, skip to the NEXT BACKSLASH
 * (not bs+1, not bs+rejectedLen+1). This prevents getting stuck inside a longer word.
 * Also: longest-match wins at each backslash position.
 */
const fs = require('fs');

// ── MATH COMMANDS (sorted by length desc, longest first) ──────────────────
const SORTED = [
  'longrightarrow','Rightarrow','leftarrow','rightarrow','ldots','cdots',
  'vdots','ddots','lim','sum','int','partial','times','to','gets','mapsto',
  'neq','pi','epsilon','sqrt','cdot','circ','bullet','ltimes','rtimes',
  'sin','cos','tan','log','ln','exp','arctan','arcsin','arccos',
  'sec','csc','cot','sinh','cosh','tanh','frac','dfrac','binom','choose',
  'cup','cap','land','lor','neg','implies','iff','forall','exists',
  'in','notin','subset','subseteq','supseteq','supset','emptyset',
  'mathbb','mathcal','mathbf','mathrm','text','textbf','textit',
  'hat','tilde','bar','vec','dot','ddot','dotplus','dddot',
  'gcd','lcm','max','min','sup','inf','det','tr','rank',
  'bigl','bigr','Bigl','Bigr','left','right','mid','setminus',
  'pm','mp','div','mod','cong','equiv','approx','propto','perp','parallel',
  'sim','le','ge','ll','gg','quad','qquad','hline','newline'
];

// ── FIND NEXT MATH COMMAND at or after startAt ────────────────────────────
function findMathCmd(text, startAt) {
  let i = startAt;
  while (i < text.length) {
    const bs = text.indexOf('\\', i);
    if (bs === -1) return null;
    const rest = text.slice(bs + 1);

    // Collect ALL commands at this backslash, filter to valid (not followed by letter)
    const validCmds = [];
    for (const c of SORTED) {
      if (rest.startsWith(c)) {
        const nextPos = bs + 1 + c.length;
        const nextChar = text[nextPos];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          validCmds.push(c);
        }
      }
    }

    if (validCmds.length > 0) {
      // LONGEST valid command wins
      validCmds.sort((a, b) => b.length - a.length);
      const cmd = validCmds[0];
      return { cmd, start: bs, end: bs + 1 + cmd.length };
    }

    // No valid command at this backslash (all were prefix-matches).
    // CRITICAL FIX: skip to NEXT backslash, not bs+1.
    // This prevents getting stuck inside a longer word like "\rightarrow"
    // where "to" is a prefix-match at the start.
    const nextBs = text.indexOf('\\', bs + 1);
    if (nextBs === -1) return null;
    i = nextBs;
  }
  return null;
}

// ── Extract brace argument: {...} recursively ──────────────────────────────
function extractBraceArg(text, startIdx) {
  let i = startIdx + 1, depth = 1, content = '';
  while (i < text.length && depth > 0) {
    if (text[i] === '{') { depth++; content += text[i++]; }
    else if (text[i] === '}') { depth--; if (depth > 0) content += text[i++]; else i++; }
    else { content += text[i++]; }
  }
  return { content, nextIdx: i };
}

// ── RECURSIVE: process math content (subscripts, etc.) NO wrapping ───────────
function processMathContent(content) {
  let result = '', i = 0;
  while (i < content.length) {
    if (content[i] !== '\\') {
      result += content[i++];
      continue;
    }
    const found = findMathCmd(content, i);
    if (!found) { result += content[i++]; continue; }
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

// ── WRAP a single prose line (with $...$) ───────────────────────────────────
function wrapProseLine(line) {
  let result = '', i = 0;
  while (i < line.length) {
    if (line[i] !== '\\') {
      result += line[i++];
      continue;
    }
    const found = findMathCmd(line, i);
    if (!found) { result += line[i++]; continue; }
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

// ── WRAP a display math line (with $$...$$) ─────────────────────────────────
function wrapDisplayLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('$$')) return line; // don't double-wrap
  return '$$ ' + trimmed + ' $$';
}

// ── MAIN ────────────────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync('data/sections.json', 'utf8'));

for (const ch of data.chapters) {
  for (const sec of ch.sections) {
    const lines = sec.content_en.split('\n');
    const wrapped = lines.map(line => {
      const t = line.trim();
      if (t.startsWith('$$') || t.startsWith('[') || t.startsWith('*') || t === '') {
        return line;
      }
      return wrapProseLine(line);
    });
    sec.content_en = wrapped.join('\n');
  }
}

fs.writeFileSync('data/sections.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Done.');

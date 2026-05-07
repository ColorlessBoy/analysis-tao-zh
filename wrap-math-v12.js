/**
 * wrap-math-v12.js
 * 
 * Strategy: wrap math commands in prose with $...$ for MathJax.
 * Key fix: track brace depth. Inside {...} (subscript/superscript content),
 * do NOT add $ wrappers - just process recursively. This prevents
 * corruption like lim_{n$\to$\infty}.
 */
const fs = require('fs');

// ── MATH COMMANDS ─────────────────────────────────────────────────────────
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

// ── Find first math command at or after startAt ────────────────────────────
function findMathCmd(text, startAt) {
  let i = startAt;
  while (i < text.length) {
    const bs = text.indexOf('\\', i);
    if (bs === -1) return null;
    const rest = text.slice(bs + 1);
    const valid = [];
    for (const c of SORTED) {
      if (rest.startsWith(c)) {
        const nextPos = bs + 1 + c.length;
        const nextChar = text[nextPos];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          valid.push(c);
        }
      }
    }
    if (valid.length > 0) {
      valid.sort((a, b) => b.length - a.length);
      return { cmd: valid[0], start: bs, end: bs + 1 + valid[0].length };
    }
    // All matches were prefix-matches. Skip to next backslash to avoid
    // getting stuck inside a longer word (e.g., "to" inside "\rightarrow").
    const nextBs = text.indexOf('\\', bs + 1);
    if (nextBs === -1) return null;
    i = nextBs;
  }
  return null;
}

// ── Extract {...} argument (depth-aware) ─────────────────────────────────────
function extractBraceArg(text, startIdx) {
  let i = startIdx + 1, depth = 1, content = '';
  while (i < text.length && depth > 0) {
    if (text[i] === '{') { depth++; content += text[i++]; }
    else if (text[i] === '}') { depth--; if (depth > 0) content += text[i++]; else i++; }
    else { content += text[i++]; }
  }
  return { content, nextIdx: i };
}

// ── Process math content recursively (NO $ wrapping) ──────────────────────
// Used inside subscript/superscript braces where we don't want to add $
function processMathContent(content) {
  let result = '', i = 0;
  while (i < content.length) {
    if (content[i] !== '\\') { result += content[i++]; continue; }
    const found = findMathCmd(content, i);
    if (!found) { result += content[i++]; continue; }
    let expr = '\\' + found.cmd;
    let pos = found.end;
    // Handle subscript
    if (pos < content.length && content[pos] === '_') {
      pos++;
      if (pos < content.length && content[pos] === '{') {
        const { content: sub, nextIdx } = extractBraceArg(content, pos);
        expr += '_{' + processMathContent(sub) + '}';
        pos = nextIdx;
      }
    }
    // Handle superscript
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

// ── Wrap prose line with $...$ for math commands ────────────────────────────
// Key difference from v11: track brace depth. Inside braces, use
// processMathContent (no $ wrapping) instead of wrapProseLine.
function wrapProseLine(line) {
  let result = '', i = 0, braceDepth = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '{') {
      result += ch;
      braceDepth++;
      i++;
    } else if (ch === '}') {
      result += ch;
      braceDepth = Math.max(0, braceDepth - 1);
      i++;
    } else if (ch !== '\\') {
      result += ch;
      i++;
    } else {
      // Found backslash
      const found = findMathCmd(line, i);
      if (!found || braceDepth > 0) {
        // No command found, or inside braces: output literally
        result += line[i++];
        continue;
      }
      // Found a valid command at top level
      let expr = '\\' + found.cmd;
      let pos = found.end;
      // Handle subscript
      if (pos < line.length && line[pos] === '_') {
        pos++;
        if (pos < line.length && line[pos] === '{') {
          const { content: sub, nextIdx } = extractBraceArg(line, pos);
          expr += '_{' + processMathContent(sub) + '}';
          pos = nextIdx;
        }
      }
      // Handle superscript
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
  }
  return result;
}

// ── Display math line ───────────────────────────────────────────────────────
function wrapDisplayLine(line) {
  const t = line.trim();
  if (t.startsWith('$$')) return line;
  // Check if it's a pure math line (starts with $$ or just math content)
  // Wrap the whole line in $$...$$
  return '$$ ' + t + ' $$';
}

// ── Detect if a non-display line is pure math (starts with math content) ─────
function isPureMathLine(line) {
  const t = line.trim();
  if (t === '' || t.startsWith('$$') || t.startsWith('[') || t.startsWith('*')) return false;
  // If line is mostly math commands, treat as display
  // Heuristic: if contains \lim or starts with \ or contains multiple \commands
  const mathCmdCount = (t.match(/\\[a-zA-Z]+/g) || []).length;
  if (mathCmdCount >= 2 && t.includes('=')) return true;
  if (/^\\[a-zA-Z]+/.test(t)) return true;
  return false;
}

// ── MAIN ────────────────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync('data/sections.json', 'utf8'));

for (const ch of data.chapters) {
  for (const sec of ch.sections) {
    const lines = sec.content_en.split('\n');
    const wrapped = lines.map(line => {
      const t = line.trim();
      if (t === '') return line;
      if (t.startsWith('$$')) return line; // already display math
      if (t.startsWith('[') || t.startsWith('*')) return line; // skip special
      // Detect display math lines
      if (isPureMathLine(line)) {
        return wrapDisplayLine(line);
      }
      return wrapProseLine(line);
    });
    sec.content_en = wrapped.join('\n');
  }
}

fs.writeFileSync('data/sections.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Done.');

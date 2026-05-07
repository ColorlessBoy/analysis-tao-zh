// wrap-math-v11.js
// Fixed algorithm: after prefix-match rejection, advance past the entire word
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

function findMathCmd(text, startAt) {
  let i = startAt;
  while (i < text.length) {
    if (text[i] !== '\\') { i++; continue; }
    const rest = text.slice(i + 1);
    let rejectedCmd = null;
    let rejectedLen = 0;
    for (const c of SORTED) {
      if (rest.startsWith(c)) {
        const nextPos = i + 1 + c.length;
        const nextChar = text[nextPos];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          return { cmd: c, start: i, end: nextPos };
        }
        // Letter follows → prefix-match. Track shortest such word.
        if (rejectedCmd === null) { rejectedCmd = c; rejectedLen = c.length; }
      }
    }
    if (rejectedCmd) {
      // Advance past this entire word (not just 1 char)
      i += rejectedLen + 1;
    } else {
      // No command at this backslash → jump to next backslash
      const nextBs = text.indexOf('\\', i + 1);
      if (nextBs === -1) return null;
      i = nextBs;
    }
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

function looksLikeDisplayMathLine(line) {
  const stripped = line.replace(/\$\$?/g, '').trim();
  if (!stripped) return false;
  const tokens = stripped.split(/\s+/);
  if (tokens.length < 3) return false;
  const hasEquals = tokens.includes('=');
  const hasMath = /[\\^_(){}]/.test(stripped);
  const startsUpper = /^[A-Z0-9]/.test(stripped);
  const startsLower = /^[a-z\\]/.test(stripped);
  const mathRatio = (stripped.match(/[\\^_(){}]/g) || []).length / stripped.length;
  return hasEquals && hasMath && (startsUpper || (startsLower && mathRatio > 0.35));
}

const data = JSON.parse(fs.readFileSync('data/sections.json', 'utf8'));
const sec = data.chapters[0].sections['1'];
const lines = sec.content_en.split('\n');
const out = lines.map(line => {
  if (/^\$\$/.test(line)) return line;
  if (looksLikeDisplayMathLine(line)) return '$$ ' + wrapProseLine(line.trim()) + ' $$';
  return wrapProseLine(line);
});
sec.content_en = out.join('\n');

fs.writeFileSync('data/sections.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Done.');

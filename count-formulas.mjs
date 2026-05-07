import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('data/sections.json', 'utf8'));
const ch = data.chapters.find(c => c.number === 1);
const s = ch.sections.find(s => s.number === '1.2');

function countDisplayFormulas(str) {
  let count = 0;
  for (let i = 0; i < str.length - 1; i++) {
    if (str[i] === '$' && str[i+1] === '$') {
      let j = i + 2;
      let found = false;
      while (j < str.length - 1) {
        if (str[j] === '$' && str[j+1] === '$') {
          count++;
          found = true;
          break;
        }
        j++;
      }
      if (found) i = j;
      else i++;
    }
  }
  return count;
}

const enCount = countDisplayFormulas(s.content_en);
const zhCount = countDisplayFormulas(s.content_zh);

console.log('EN display formulas:', enCount);
console.log('ZH display formulas:', zhCount);
console.log('Missing in EN:', zhCount - enCount);
console.log('Status:', enCount >= zhCount ? 'PASS' : 'FAIL');

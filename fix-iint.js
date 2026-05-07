const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/sections.json', 'utf8'));
const ch = data.chapters.find(c => c.number === 1);
const s = ch.sections.find(s => s.number === '1.2');
let en = s.content_en;

let fixed = 0;

// Fix iint 1: $\iint f(x,y)\,dx\,dy$\n -> $$\iint f(x,y)\,dx\,dy$$
let iint1 = '$\\iint f(x,y)\\,dx\\,dy$\n';
if (en.includes(iint1)) {
  en = en.replace(iint1, '$$\\iint f(x,y)\\,dx\\,dy$$\n');
  fixed++;
  console.log('Fixed iint 1');
}

// Fix iint 2: $\iint f(x,y)\,dy\,dx$\n
let iint2 = '$\\iint f(x,y)\\,dy\\,dx$\n';
if (en.includes(iint2)) {
  en = en.replace(iint2, '$$\\iint f(x,y)\\,dy\\,dx$$\n');
  fixed++;
  console.log('Fixed iint 2');
}

// Fix iint 3: $\iint f(x,y)\,dx\,dy = \iint f(x,y)\,dy\,dx$.\n (may have period)
let iint3 = '$\\iint f(x,y)\\,dx\\,dy = \\iint f(x,y)\\,dy\\,dx$.';
if (en.includes(iint3)) {
  en = en.replace(iint3, '$$\\iint f(x,y)\\,dx\\,dy = \\iint f(x,y)\\,dy\\,dx$$');
  fixed++;
  console.log('Fixed iint 3');
}

// Also check without period
let iint3b = '$\\iint f(x,y)\\,dx\\,dy = \\iint f(x,y)\\,dy\\,dx$';
if (en.includes(iint3b) && !en.includes(iint3)) {
  en = en.replace(iint3b, '$$\\iint f(x,y)\\,dx\\,dy = \\iint f(x,y)\\,dy\\,dx$$');
  fixed++;
  console.log('Fixed iint 3b');
}

console.log('Fixed:', fixed);
console.log('EN length:', en.length);

// Save
s.content_en = en;
fs.writeFileSync('data/sections.json', JSON.stringify(data, null, 2));
console.log('Saved!');
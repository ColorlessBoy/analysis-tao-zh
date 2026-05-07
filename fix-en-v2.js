const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/sections.json', 'utf8'));
const ch = data.chapters.find(c => c.number === 1);
const s = ch.sections.find(s => s.number === '1.2');
let en = s.content_en;

let fixed = 0;

// Find and fix iint formulas - they are $\iint (single $)
// Pattern: $\iint f(x,y)\,dx\,dy$.
let iint1 = '$\\iint f(x,y)\\,dx\\,dy$.';
if (en.includes(iint1)) {
  en = en.replace(iint1, '$$\\iint f(x,y)\\,dx\\,dy$$');
  fixed++;
  console.log('Fixed iint 1 ($\\\\iint -> $$\\\\iint$$)');
}

// Pattern 2
let iint2 = '$\\iint f(x,y)\\,dy\\,dx$.';
if (en.includes(iint2)) {
  en = en.replace(iint2, '$$\\iint f(x,y)\\,dy\\,dx$$');
  fixed++;
  console.log('Fixed iint 2');
}

// Pattern 3 - the swap equation
let iint3 = '$\\iint f(x,y)\\,dx\\,dy = \\iint f(x,y)\\,dy\\,dx$.';
if (en.includes(iint3)) {
  en = en.replace(iint3, '$$\\iint f(x,y)\\,dx\\,dy = \\iint f(x,y)\\,dy\\,dx$$');
  fixed++;
  console.log('Fixed iint 3');
}

// Fix the d/dx formulas - they have newlines inside $$
// Pattern 1
let ddx1 = '$$\n[d/dx (x^3/(\\epsilon^2+x^2))]_{x=0} = 0.\n$$';
if (en.includes(ddx1)) {
  en = en.replace(ddx1, '$$\\left[\\frac{d}{dx}\\left(\\frac{x^3}{\\varepsilon^2 + x^2}\\right)\\right]_{x=0} = 0$$');
  fixed++;
  console.log('Fixed d/dx 1');
}

// Pattern 2
let ddx2 = '$$\n[d/dx (x^3/(0+x^2))]_{x=0} = 0.\n$$';
if (en.includes(ddx2)) {
  en = en.replace(ddx2, '$$\\left[\\frac{d}{dx}\\left(\\frac{x^3}{0 + x^2}\\right)\\right]_{x=0} = 0$$');
  fixed++;
  console.log('Fixed d/dx 2');
}

// Also check for variations with different newlines
// Find [d/dx in $$
let pos = en.indexOf('[d/dx');
let ddxFixed = 0;
while (pos >= 0) {
  const before = en.substring(Math.max(0, pos - 10), pos);
  if (before.includes('$$')) {
    console.log('Found [d/dx in $$ at', pos);
    // Find the closing $$
    let end = en.indexOf('$$', pos + 10);
    if (end > pos && end - pos < 200) {
      console.log('  Would replace from', pos, 'to', end + 2);
      ddxFixed++;
    }
  }
  pos = en.indexOf('[d/dx', pos + 1);
}

console.log('\nTotal d/dx fixes needed:', ddxFixed);

console.log('\nTotal fixed:', fixed);
console.log('EN length:', en.length);

// Save
s.content_en = en;
fs.writeFileSync('data/sections.json', JSON.stringify(data, null, 2));
console.log('Saved!');
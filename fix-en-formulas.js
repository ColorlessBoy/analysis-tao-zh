const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/sections.json', 'utf8'));
const ch = data.chapters.find(c => c.number === 1);
const s = ch.sections.find(s => s.number === '1.2');
let en = s.content_en;

let fixed = 0;

// Fix 1: \iint formulas should be in $$...$$
// Current EN has \iint in inline form - need to find and wrap
const iintDxDy = en.indexOf('\\iint f(x,y)\\,dx\\,dy');
if (iintDxDy >= 0) {
  const before = en.substring(Math.max(0, iintDxDy - 5), iintDxDy);
  if (before !== '$$') {
    en = en.substring(0, iintDxDy) + '$$\n' + en.substring(iintDxDy);
    en = en.substring(0, iintDxDy + 50 + 3) + '\n$$' + en.substring(iintDxDy + 50 + 3);
    fixed++;
    console.log('Fixed iint dx dy');
  }
}

const iintDyDx = en.indexOf('\\iint f(x,y)\\,dy\\,dx');
if (iintDyDx >= 0) {
  const before = en.substring(Math.max(0, iintDyDx - 5), iintDyDx);
  if (before !== '$$') {
    en = en.substring(0, iintDyDx) + '$$\n' + en.substring(iintDyDx);
    en = en.substring(0, iintDyDx + 50 + 3) + '\n$$' + en.substring(iintDyDx + 50 + 3);
    fixed++;
    console.log('Fixed iint dy dx');
  }
}

// Fix 2: The infinite sum formula
const sumInfPlain = en.indexOf('\\sum_{i=1}^\\infty \\sum_{j=1}^\\infty a_{ij} = \\sum_{j=1}^\\infty \\sum_{i=1}^\\infty a_{ij}');
console.log('Sum infinite plain at:', sumInfPlain);

if (sumInfPlain >= 0) {
  const before = en.substring(Math.max(0, sumInfPlain - 5), sumInfPlain);
  console.log('Before sum:', JSON.stringify(before));
  if (before !== '$$') {
    en = en.substring(0, sumInfPlain) + '$$\n' + en.substring(sumInfPlain);
    const newEnd = sumInfPlain + '\\sum_{i=1}^\\infty \\sum_{j=1}^\\infty a_{ij} = \\sum_{j=1}^\\infty \\sum_{i=1}^\\infty a_{ij}'.length + 3;
    en = en.substring(0, newEnd) + '\n$$' + en.substring(newEnd);
    fixed++;
    console.log('Fixed sum infinite display');
  }
}

// Fix 3: The lim_y integral formula - check its current state
const limYFormula = '\\lim_{y \\to \\infty} \\int_{-\\infty}^\\infty \\frac{1}{1 + (x - y)^2}\\,dx';
const limYPos = en.indexOf(limYFormula);
console.log('lim_y formula at:', limYPos);

if (limYPos >= 0) {
  const before = en.substring(Math.max(0, limYPos - 5), limYPos);
  console.log('Before lim_y:', JSON.stringify(before));
  if (before !== '$$') {
    en = en.substring(0, limYPos) + '$$\n' + en.substring(limYPos);
    en = en.substring(0, limYPos + limYFormula.length + 3) + '\n$$' + en.substring(limYPos + limYFormula.length + 3);
    fixed++;
    console.log('Fixed lim_y integral');
  }
}

// Fix 4: The inner integrals with e^{-xy}
// Find \int_0^1 (e^{-xy} - xye^{-xy}) dy = [-e^{-xy}]_{y=0}^{y=1} = e^{-x}
const innerInt1 = '\\int_0^1 (e^{-xy} - xye^{-xy})\\,dy = [-e^{-xy}]_{y=0}^{y=1} = e^{-x}';
const inner1Pos = en.indexOf(innerInt1);
console.log('\nInner integral 1 at:', inner1Pos);

if (inner1Pos >= 0) {
  const before = en.substring(Math.max(0, inner1Pos - 5), inner1Pos);
  if (before !== '$$') {
    en = en.substring(0, inner1Pos) + '$$\n' + en.substring(inner1Pos);
    en = en.substring(0, inner1Pos + innerInt1.length + 3) + '\n$$' + en.substring(inner1Pos + innerInt1.length + 3);
    fixed++;
    console.log('Fixed inner integral 1');
  }
}

// Fix 5: The second inner integral
const innerInt2 = '\\int_0^\\infty (e^{-xy} - xye^{-xy})\\,dx = [-e^{-xy}]_{x=0}^{x=\\infty} = 0';
const inner2Pos = en.indexOf(innerInt2);
console.log('Inner integral 2 at:', inner2Pos);

if (inner2Pos >= 0) {
  const before = en.substring(Math.max(0, inner2Pos - 5), inner2Pos);
  if (before !== '$$') {
    en = en.substring(0, inner2Pos) + '$$\n' + en.substring(inner2Pos);
    en = en.substring(0, inner2Pos + innerInt2.length + 3) + '\n$$' + en.substring(inner2Pos + innerInt2.length + 3);
    fixed++;
    console.log('Fixed inner integral 2');
  }
}

// Fix 6: The arctan formula
const arctanFormula = en.indexOf('\\int_{-\\infty}^\\infty \\frac{1}{1 + (x - y)^2}\\,dx = [\\arctan(x - y)]');
console.log('\nArctan formula at:', arctanFormula);

if (arctanFormula >= 0) {
  const before = en.substring(Math.max(0, arctanFormula - 5), arctanFormula);
  if (before !== '$$') {
    en = en.substring(0, arctanFormula) + '$$\n' + en.substring(arctanFormula);
    en = en.substring(0, arctanFormula + 200 + 3) + '\n$$' + en.substring(arctanFormula + 200 + 3);
    fixed++;
    console.log('Fixed arctan formula');
  }
}

console.log('\nTotal fixed:', fixed);
console.log('EN length:', en.length);

// Save
s.content_en = en;
fs.writeFileSync('data/sections.json', JSON.stringify(data, null, 2));
console.log('Saved!');
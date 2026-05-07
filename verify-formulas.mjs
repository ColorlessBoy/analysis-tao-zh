import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.goto('https://colorlessboy.github.io/analysis-tao-zh/#1.2', { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(8000);

  const result = await page.evaluate(() => {
    const allMjx = document.querySelectorAll('mjx-container');
    
    // Split by language - check for zh/en text in parent containers
    let enCount = 0;
    let zhCount = 0;
    
    allMjx.forEach(mjx => {
      const parent = mjx.parentElement;
      const text = parent ? parent.textContent : '';
      // Simple heuristic: Chinese chars indicate zh section
      if (/[\u4e00-\u9fa5]/.test(text)) {
        zhCount++;
      } else {
        enCount++;
      }
    });
    
    return {
      enMjxCount: enCount,
      zhMjxCount: zhCount,
      totalMjxCount: allMjx.length,
      missingInEN: zhCount > enCount ? zhCount - enCount : 0,
      status: enCount >= zhCount ? 'PASS' : 'FAIL - EN missing formulas'
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  // Test section 1.2 which we know works
  await page.goto('https://colorlessboy.github.io/analysis-tao-zh/#1.2');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(6000);
  const r1 = await page.evaluate(() => {
    const body = document.querySelector('.sec-body');
    return { text: body?.textContent?.substring(0, 200), hash: window.location.hash };
  });
  
  // Now test 2.1
  await page.goto('https://colorlessboy.github.io/analysis-tao-zh/#2.1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(6000);
  const r2 = await page.evaluate(() => {
    const body = document.querySelector('.sec-body');
    return { text: body?.textContent?.substring(0, 200), hash: window.location.hash };
  });
  
  console.log('1.2:', JSON.stringify(r1));
  console.log('2.1:', JSON.stringify(r2));
  await browser.close();
})();

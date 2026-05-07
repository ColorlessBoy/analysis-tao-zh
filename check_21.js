const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('https://colorlessboy.github.io/analysis-tao-zh/#2.1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
  const debug = await page.evaluate(() => {
    return {
      hash: window.location.hash,
      bodyHTML: document.body.innerHTML.substring(0, 500),
      appContent: document.querySelector('#app')?.innerHTML?.substring(0, 300) || 'no #app',
      secContent: document.querySelector('.sec-content')?.innerHTML?.substring(0, 300) || 'no .sec-content',
      sectionsInJSON: typeof sectionsData !== 'undefined' ? 'loaded' : 'not loaded',
    };
  });
  console.log(JSON.stringify(debug, null, 2));
  await browser.close();
})();

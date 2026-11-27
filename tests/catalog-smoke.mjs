import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8123/';
const browser=await chromium.launch();
try {
  for (const viewport of [{width:1280,height:720},{width:390,height:844}]) {
    const page=await browser.newPage({viewport,reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    const count=await page.locator('article.game').count();
    assert.equal(await page.locator('#count').textContent(),String(count).padStart(2,'0')+(count===1?' PROJECT':' PROJECTS'));
    assert.equal(await page.locator('a[href="./library/"]').count(),0);
    assert.equal(await page.locator('.mark').evaluate(i=>i.complete&&i.naturalWidth>0),true);
    for(const icon of ['el.svg','el-16.png','el-32.png','el-48.png','el-192.png']){
      const response=await page.request.get(base+'assets/brand/'+icon);assert.equal(response.status(),200);
    }
    assert.equal((await page.request.get(base+'favicon.ico')).status(),200);
    await page.locator('#search').fill('zzzz-smoke-no-match');
    assert.equal(await page.locator('.game:visible').count(),0);
    assert.equal(await page.locator('#empty').isVisible(),true);
    await page.locator('#search').fill('');
    await page.locator('[data-filter="Physics"]').click();
    assert.equal(await page.locator('[data-filter="Physics"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-filter="All"]').click();
    await page.locator('#motion-mode').selectOption('off');
    assert.equal(await page.locator('body').getAttribute('data-motion'),'off');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'horizontal overflow');
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('PASS: catalog search, filters, motion, icons, no mechanical link, desktop/mobile layout');
} finally {await browser.close();}

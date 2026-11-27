import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8123/';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  for (const viewport of [{width:1280,height:720},{width:390,height:844}]) {
    const page=await browser.newPage({viewport,reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    const count=await page.locator('article.game').count();
    assert.equal(await page.locator('#count').textContent(),String(count).padStart(2,'0')+(count===1?' PROJECT':' PROJECTS'));
    await page.locator('#search').fill('zzzz-smoke-no-match');
    assert.equal(await page.locator('.game:visible').count(),0);
    assert.equal(await page.locator('#empty').isVisible(),true);
    await page.locator('#motion-mode').selectOption('off');
    assert.equal(await page.locator('body').getAttribute('data-motion'),'off');
    await page.goto(base+'library/');
    await page.waitForFunction(()=>['true','error'].includes(document.body.dataset.ready),{timeout:60000},{timeout:60000});
    assert.equal(await page.locator('body').getAttribute('data-ready'),'true','WebGL startup');
    assert.equal(await page.locator('body').getAttribute('data-inventory'),String(count));
    if(!count)assert.equal(await page.locator('#retrieve').isDisabled(),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),'mechanical viewport overflow');
    await page.locator('#settings-open').click();
    assert.equal(await page.locator('#settings-dialog').isVisible(),true);
    await page.locator('[data-close="settings-dialog"]').click();
    assert.deepEqual(errors,[]);
    await page.close();
  }
  // A test-only catalog fixture exercises nonempty inventory without publishing fake projects.
  const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  const fixture='<article class="game" data-category="Physics" style="--cover:#26332d;--ink:#dce6c8"><a class="cover"><span class="cover-top"><span>EL / 001</span></span></a><div class="info"><h2>Fixture</h2><p>Test inventory only</p><div class="meta"><span>Physics</span><span>v1</span></div><a class="play" href="./fixture/">Open</a></div></article>';
  await page.route('**/?view=classic',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await page.goto(base+'library/');
  await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
  assert.equal(await page.locator('body').getAttribute('data-inventory'),'1');
  await page.locator('#retrieve').click();
  await page.locator('#play').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('#play').getAttribute('href'),base+'fixture/');
  await page.locator('#return').click();
  await page.locator('#retrieve').waitFor({state:'visible',timeout:30000});
  await page.close();
  console.log('PASS: classic search, motion, mechanical empty/populated startup, desktop/mobile viewport, settings and retrieval fixture');
} finally {await browser.close();}

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const script=await readFile('assets/shared/bug-report.js','utf8'),css=await readFile('assets/shared/bug-report.css','utf8');
const browser=await chromium.launch();
try {
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  await page.route('http://report.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('.js'))return route.fulfill({body:script,contentType:'text/javascript'});
   if(url.pathname.endsWith('.css'))return route.fulfill({body:css,contentType:'text/css'});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/report.css"><script src="/report.js" data-repo="euclidi/euclidi-games" data-project="test-project"></script></head><body><a data-euclidi-bug-report href="https://github.com/euclidi/euclidi-games/issues/new" target="_blank" rel="noopener noreferrer">Report bug</a></body></html>'});
  });
  await page.goto('http://report.test/?v=1.2');
  await page.evaluate(()=>console.error('Example failure token=privatevalue'));
  await page.locator('[data-euclidi-bug-report]').click();
  const d=page.locator('#euclidi-report-dialog');assert(await d.isVisible());
  await d.locator('#er-summary').fill('Jump fails');
  await d.locator('#er-details').fill('Press jump. Nothing happens.');
  let preview=await d.locator('#er-preview').inputValue();
  assert(preview.includes('Press jump. Nothing happens.')&&!preview.includes('Example failure'));
  await d.locator('#er-include').check();
  preview=await d.locator('#er-preview').inputValue();
  assert(preview.includes('Example failure')&&!preview.includes('privatevalue'));
  const url=new URL(await d.locator('#er-open').getAttribute('href'));
  assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/euclidi/euclidi-games/issues/new');
  assert.equal(url.searchParams.get('title'),'[Player bug] [test-project] Jump fails');
  assert(url.searchParams.get('body').includes('Press jump. Nothing happens.'));
  assert(await d.evaluate(e=>e.getBoundingClientRect().right<=innerWidth&&e.getBoundingClientRect().bottom<=innerHeight+1));
  await d.locator('#er-save').click();assert((await d.locator('#er-status').textContent()).includes('Not submitted'));
  await d.locator('#er-close').click();assert(!(await d.isVisible()));
  await page.reload();await page.locator('[data-euclidi-bug-report]').click();
  assert.equal(await d.locator('#er-summary').inputValue(),'Jump fails');assert(!(await d.locator('#er-include').isChecked()));
  await page.keyboard.press('Escape');assert(!(await d.isVisible()));
  await page.close();
 }
 console.log('PASS reporter desktop/mobile, opt-in redaction, issue URL, draft and dismiss');
}finally{await browser.close();}

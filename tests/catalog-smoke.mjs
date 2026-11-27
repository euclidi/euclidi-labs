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
   assert.equal(await page.locator('header a[href="https://euclidi.github.io/euclidi-games/"]').count(),1);
   assert.equal(await page.locator('header a[href="https://github.com/euclidi/euclidi-labs"]').count(),1);
   assert.equal(await page.locator('footer a[href="https://github.com/euclidi/euclidi-games"]').count(),1);
    assert.equal(await page.locator('.mark').evaluate(i=>i.tagName.toLowerCase()==='svg'&&i.getBBox().width>0),true);
    for(const icon of ['el.svg','favicon.svg','favicon-off.svg','el-16.png','el-32.png','el-16-off.png','el-32-off.png','el-180.png','el-192.png']){
      const response=await page.request.get(base+'assets/brand/'+icon);assert.equal(response.status(),200);
    }
    assert.equal(await page.locator('body').getAttribute('data-terminal-cursor'),'on');
    assert.equal(await page.locator('body').getAttribute('data-motion'),'off');
    for(const [size,path] of [[16,'el-16.png'],[32,'el-32.png'],[16,'el-16-off.png'],[32,'el-32-off.png'],[180,'el-180.png'],[192,'el-192.png']]){
      const actual=await page.evaluate(async p=>{const img=new Image();img.src='assets/brand/'+p;await img.decode();return [img.naturalWidth,img.naturalHeight]},path);
      assert.deepEqual(actual,[size,size]);
    }
    await page.locator('#search').fill('zzzz-smoke-no-match');
    assert.equal(await page.locator('.game:visible').count(),0);
    assert.equal(await page.locator('#empty').isVisible(),true);
    await page.locator('#search').fill('');
    await page.locator('[data-filter="Physics"]').click();
    assert.equal(await page.locator('[data-filter="Physics"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-filter="All"]').click();
    const iconLinks=await page.locator('link[rel="icon"],link[rel="shortcut icon"]').evaluateAll(els=>els.map(e=>e.getAttribute('href')));
    assert.ok(iconLinks.some(p=>p.includes('favicon.ico?v=el6')));
    const ico=await page.request.get(base+'favicon.ico?v=el6');
    assert.equal(ico.status(),200);
    const bytes=await ico.body();
    assert.equal(bytes.readUInt16LE(2),1);
    assert.equal(bytes.readUInt16LE(4),2);
    assert.equal(bytes[6],16);
    assert.equal(bytes[22],32);
    for(const off of [6,22]){
      const start=bytes.readUInt32LE(off+12),length=bytes.readUInt32LE(off+8);
      assert.equal(bytes.subarray(start,start+8).toString('hex'),'89504e470d0a1a0a');
      assert.ok(start+length<=bytes.length);
    }
    assert.equal(await page.locator('#os-boot').isVisible(),false);
    assert.equal(await page.locator('.eg-crt').count(),0);
    await page.locator('#motion-mode').selectOption('on');
    await page.locator('#os-boot').waitFor({state:'visible'});
    assert.equal(await page.locator('#os-boot-title').textContent(),'Euclidi OS');
    assert.equal(await page.locator('header').isVisible(),true);
    assert.equal(await page.locator('#search').isVisible(),true);
    assert.equal(await page.locator('dialog').count(),0);
    assert.ok(await page.locator('#os-boot').evaluate(e=>e.clientWidth<=innerWidth&&e.scrollWidth<=e.clientWidth));
    const toolbar=await page.locator('.toolbar').boundingBox();
    await page.locator('#boot-replay').click();
    assert.equal(await page.locator('#os-boot').isVisible(),false);
    await page.locator('#boot-replay').click();
    await page.locator('#os-boot').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#os-boot').isVisible(),false);
    await page.locator('#boot-replay').click();
    await page.locator('#os-boot').waitFor({state:'hidden',timeout:5000});
    assert.deepEqual(await page.locator('.toolbar').boundingBox(),toolbar,'boot must not shift catalog');
    await page.waitForFunction(()=>document.body.dataset.terminalCursor==='off',null,{timeout:5000});
    assert.deepEqual(await page.locator('link[rel="icon"],link[rel="shortcut icon"]').evaluateAll(els=>els.map(e=>e.getAttribute('href'))),iconLinks);
    await page.waitForFunction(()=>document.body.dataset.terminalCursor==='on',null,{timeout:5000});
    await page.locator('#motion-mode').selectOption('off');
    await page.waitForTimeout(750);
    assert.equal(await page.locator('body').getAttribute('data-terminal-cursor'),'on');
    assert.deepEqual(await page.locator('link[rel="icon"],link[rel="shortcut icon"]').evaluateAll(els=>els.map(e=>e.getAttribute('href'))),iconLinks);
    assert.equal(await page.locator('body').getAttribute('data-motion'),'off');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'horizontal overflow');
    assert.equal(await page.locator('#boot-replay').isDisabled(),true);
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>localStorage.removeItem('euclidi.labs.catalog.motion.v1'));
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#os-boot').waitFor({state:'visible'});
    await page.locator('#os-boot').waitFor({state:'hidden',timeout:5000});
    assert.equal(await page.locator('#os-boot').isVisible(),false);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('PASS: catalog search, filters, motion, icons, no mechanical link, desktop/mobile layout');
} finally {await browser.close();}

from playwright.sync_api import sync_playwright
import json, time, pathlib
url='https://acoustica.test/'
root=pathlib.Path(__file__).parent
def route(r):
 from urllib.parse import urlparse
 path=urlparse(r.request.url).path.lstrip('/') or 'index.html'
 file=root/path
 if file.is_file():
  mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'}.get(file.suffix,'application/octet-stream')
  r.fulfill(status=200,content_type=mime,body=file.read_bytes())
 else:r.fulfill(status=404,body='not found')
results=[]
def check(name,condition,detail=''):
 results.append(dict(name=name,pass_=bool(condition),detail=detail));print(name, bool(condition),detail,flush=True);assert condition,name
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'])
 ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True,permissions=['microphone']);ctx.route('https://acoustica.test/**',route);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url);page.get_by_role('button',name='Start input').click();page.wait_for_function('window.__acoustica?.latest?.f0 > 400',timeout=15000)
 m=page.evaluate('({pitch:__acoustica.latest.f0, rms:__acoustica.latest.dbfs,dom:__acoustica.latest.dom,drops:__acoustica.latest.drops})');check('Browser reference 440 Hz',abs(m['pitch']-440)<2.2,str(m));check('Reference RMS',abs(m['rms']+9.03)<.2,str(m));check('Dominant frequency',abs(m['dom']-440)<1,str(m));page.screenshot(path='/mnt/data/acoustica-desktop.png',full_page=True)
 page.locator('#freq').fill('880');page.locator('#freq').dispatch_event('input');page.wait_for_function('Math.abs(__acoustica.latest?.f0-880)<5',timeout=15000);check('Frequency control',True)
 page.locator('#freeze').click();pitch=page.locator('#pitch').inner_text();page.locator('#freq').fill('220');page.locator('#freq').dispatch_event('input');page.wait_for_timeout(400);check('Freeze',page.locator('#pitch').inner_text()==pitch);page.locator('#freeze').click();page.wait_for_function('Math.abs(__acoustica.latest?.f0-220)<2',timeout=15000)
 page.locator('#record').click();page.wait_for_timeout(500);page.locator('#record').click();with_dl=page.expect_download();
 with with_dl:page.locator('#saveWav').click()
 wav=with_dl.value.path();b=pathlib.Path(wav).read_bytes();check('WAV export',b[:4]==b'RIFF' and b[8:12]==b'WAVE' and len(b)>1000,str(len(b)))
 for mode in ['plate','tube','field','voice','ripple','synth']:
  page.locator('[data-mode="'+mode+'"]').click()
  if mode!='synth':
   page.wait_for_function('(m)=>__acoustica.sim?.mode===m && Number.isFinite(__acoustica.sim.max)',arg=mode,timeout=15000)
   detail=page.locator('#labStats').inner_text();check('Model '+mode,True,detail)
  else:check('Synthesis workspace',page.locator('#measurement').is_visible())
 page.locator('[data-mode="plate"]').click();page.wait_for_function('__acoustica.sim?.mode==="plate"');page.screenshot(path='/mnt/data/acoustica-plate.png',full_page=True)
 page.locator('#stop').click();check('Stop clears input',page.evaluate('__acoustica.source===""'))
 page.locator('#source').select_option('mic');page.locator('#start').click();page.wait_for_function('__acoustica.source==="mic"&&__acoustica.latest!==null',timeout=15000);check('Fake local microphone acquisition',True);page.locator('#stop').click()
 # phone link: two browser contexts; use fake capture; direct local ICE, no relay
 page.locator('#source').select_option('phone');page.locator('#offer').click();page.wait_for_function('document.querySelector("#outgoing").value.includes("offer")',timeout=15000);offer=page.locator('#outgoing').input_value();phone=ctx.new_page();phone.goto(url);phone.locator('#source').select_option('phone');phone.locator('#incoming').fill(offer);phone.locator('#send').click();phone.wait_for_function('document.querySelector("#outgoing").value.includes("answer")',timeout=15000);answer=phone.locator('#outgoing').input_value();page.locator('#incoming').fill(answer);page.locator('#answer').click();
 try:
  page.wait_for_function('__acoustica.source==="phone"&&__acoustica.latest!==null',timeout=12000);check('Two browser WebRTC phone path',True)
 except Exception as e:results.append(dict(name='Two browser WebRTC phone path',pass_=False,detail=page.locator('#state').inner_text()));print('WebRTC connection not verified',page.locator('#state').inner_text())
 page.locator('#stop').click();phone.locator('#stop').click();check('No browser page errors',not errors,str(errors));mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2);mobile.route('https://acoustica.test/**',route);p=mobile.new_page();p.goto(url);p.locator('#start').click();p.wait_for_function('__acoustica.latest!==null',timeout=15000);check('Mobile viewport no horizontal overflow',p.evaluate('document.documentElement.scrollWidth <= innerWidth'),str(p.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})')));p.screenshot(path='/mnt/data/acoustica-mobile.png',full_page=True);browser.close()
pathlib.Path('/mnt/data/acoustica/test-browser-results.json').write_text(json.dumps(results,indent=2))

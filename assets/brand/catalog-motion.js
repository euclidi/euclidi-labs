/* Catalog motion — OS-aware Auto by default, optional manual mode, mouse events independent of media capability. */
(()=>{
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const replay=document.getElementById('boot-replay'), mode=document.getElementById('motion-mode'), choice=document.getElementById('motion-choice'), status=document.getElementById('motion-status');
 const boot=document.getElementById('os-boot'), log=boot.querySelector('.os-log'), command=document.getElementById('os-command'), skip=document.getElementById('boot-skip');
 let bootTimers=[], previousFocus=null;
 const key='euclidi.labs.catalog.motion.v1';
 mode.value='auto'; // Default respects the OS reduced-motion setting.
 let hasSavedPreference=false;
 try{const saved=localStorage.getItem(key);if(['auto','on','off'].includes(saved)){mode.value=saved;hasSavedPreference=true;}}catch{}
 const enabled=()=>mode.value==='on'||(mode.value==='auto'&&!preference.matches);
 // Keep favicon URLs static so bookmarks can cache the approved mark.
 let cursorTimer=null;
 function cursor(on){
   document.body.dataset.terminalCursor=on?'on':'off';
 }
 function syncCursor(){
   if(cursorTimer!==null){clearInterval(cursorTimer);cursorTimer=null;}
   cursor(true);
   if(enabled()&&!document.hidden)cursorTimer=setInterval(()=>cursor(document.body.dataset.terminalCursor!=='on'),650);
 }
 document.addEventListener('visibilitychange',()=>{syncCursor();if(document.hidden)stop();});
 function stop(){
   bootTimers.forEach(clearTimeout);bootTimers=[];
   if(!boot.open)return;
   boot.close();
   if(previousFocus instanceof HTMLElement&&previousFocus!==document.body&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});
   previousFocus=null;
 }
 function startup(){
   if(!enabled()||document.hidden||typeof boot.showModal!=='function')return;
   stop();
   previousFocus=document.activeElement;
   log.replaceChildren();command.textContent='';
   // These are presentation-only boot messages, not hardware diagnostics.
   const rows=[
     ['Initialize laboratory shell','OK'],
     ['Load interface modules','OK'],
     ['Mount experiment library','OK'],
     ['Read project index',String(document.querySelectorAll('article.game').length).padStart(2,'0')+' ENTRIES'],
     ['Environment ready','OK']
   ].map(([label,value])=>{
     const row=document.createElement('div');row.className='os-line';
     const a=document.createElement('span'),b=document.createElement('span');a.textContent=label;b.textContent='['+value+']';row.append(a,b);log.append(row);return row;
   });
   boot.showModal();
   const later=(fn,ms)=>bootTimers.push(setTimeout(fn,ms));
   rows.forEach((row,i)=>later(()=>row.classList.add('is-ready'),180+i*230));
   const text='labs> open library';
   for(let i=1;i<=text.length;i++)later(()=>{command.textContent=text.slice(0,i);},1370+i*34);
   later(stop,2350);
 }
 skip.addEventListener('click',stop);
 boot.addEventListener('cancel',event=>{event.preventDefault();stop();});
 function sync(){
   const on=enabled();
   document.body.dataset.motion=on?'on':'off';
   document.body.dataset.motionPreference=mode.value;
   replay.hidden=false;choice.hidden=false;status.hidden=false;
   replay.disabled=!on;replay.textContent='Replay boot';
   status.textContent=on?(mode.value==='on'?(hasSavedPreference?'On (manual)':'On (default)'):'On (system)'):(mode.value==='off'?'Off (manual)':'Off (system)');
   syncCursor();
   if(!on){stop();document.querySelectorAll('.is-tilted,.eg-hover,.eg-tap').forEach(e=>e.classList.remove('is-tilted','eg-hover','eg-tap'));}
 }
 mode.addEventListener('change',()=>{hasSavedPreference=true;try{localStorage.setItem(key,mode.value);}catch{}sync();if(enabled())startup();});
 replay.addEventListener('click',startup);
 if(preference.addEventListener)preference.addEventListener('change',sync);else preference.addListener(sync);
 sync();
 for(const el of document.querySelectorAll('.brand,.play,.filters button')){
   el.addEventListener('mouseenter',()=>{if(enabled())el.classList.add('eg-hover');});
   el.addEventListener('mouseleave',()=>el.classList.remove('eg-hover'));
   el.addEventListener('pointerdown',e=>{if(enabled()&&e.pointerType==='touch'&&!el.classList.contains('brand')){el.classList.remove('eg-tap');void el.offsetWidth;el.classList.add('eg-tap');setTimeout(()=>el.classList.remove('eg-tap'),700);}});
 }
 for(const card of document.querySelectorAll('.game,.brand')){
   const move=event=>{
     if(!enabled()||event.pointerType==='touch')return;
     const box=card.getBoundingClientRect(),w=card.offsetWidth,h=card.offsetHeight;
     const x=Math.max(-1,Math.min(1,(event.clientX-(box.left+box.width/2))/(w/2)));
     const y=Math.max(-1,Math.min(1,(event.clientY-(box.top+box.height/2))/(h/2)));
     card.style.setProperty('--tilt-x',(-y*(card.classList.contains('brand')?18:10)).toFixed(2)+'deg');
     card.style.setProperty('--tilt-y',(x*(card.classList.contains('brand')?20:12)).toFixed(2)+'deg');
     card.classList.add('is-tilted');
   };
   card.addEventListener('mousemove',move,{passive:true});
   card.addEventListener('pointermove',move,{passive:true});
   const clear=()=>card.classList.remove('is-tilted');
   card.addEventListener('mouseleave',clear);card.addEventListener('pointerleave',clear);card.addEventListener('pointercancel',clear);
 }
 startup();
})();

/* Catalog motion — OS-aware Auto by default, optional manual mode, mouse events independent of media capability. */
(()=>{
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 const replay=document.getElementById('crt-replay'), mode=document.getElementById('motion-mode'), choice=document.getElementById('motion-choice'), status=document.getElementById('motion-status');
 const overlay=document.createElement('div');overlay.className='eg-crt';overlay.setAttribute('aria-hidden','true');
 const line=document.createElement('div');line.className='eg-crt-line';overlay.append(line);document.body.append(overlay);
 let generation=0;
 const key='euclidi.labs.catalog.motion.v1';
 mode.value='auto'; // Default respects the OS reduced-motion setting.
 let hasSavedPreference=false;
 try{const saved=localStorage.getItem(key);if(['auto','on','off'].includes(saved)){mode.value=saved;hasSavedPreference=true;}}catch{}
 const enabled=()=>mode.value==='on'||(mode.value==='auto'&&!preference.matches);
 // Keep the approved mark static except for its underscore. Use pre-rendered
 // favicon frames rather than depending on browser SVG animation support.
 const icons=[['favicon-16','el-16.png','el-16-off.png'],['favicon-32','el-32.png','el-32-off.png'],['favicon-svg','favicon.svg','favicon-off.svg']].map(([id,on,off])=>({link:document.getElementById(id),on:'./assets/brand/'+on+'?v=el5',off:'./assets/brand/'+off+'?v=el5'}));
 let cursorTimer=null;
 function cursor(on){
   document.body.dataset.terminalCursor=on?'on':'off';
   for(const icon of icons)if(icon.link)icon.link.setAttribute('href',on?icon.on:icon.off);
 }
 function syncCursor(){
   if(cursorTimer!==null){clearInterval(cursorTimer);cursorTimer=null;}
   cursor(true);
   if(enabled()&&!document.hidden)cursorTimer=setInterval(()=>cursor(document.body.dataset.terminalCursor!=='on'),650);
 }
 document.addEventListener('visibilitychange',syncCursor);
 function stop(){generation++;overlay.classList.remove('is-playing');}
 function startup(){
   if(!enabled())return;
   const current=++generation;
   overlay.classList.remove('is-playing');void overlay.offsetWidth;overlay.classList.add('is-playing');
   setTimeout(()=>{if(current===generation)stop();},1250);
 }
 function sync(){
   const on=enabled();
   document.body.dataset.motion=on?'on':'off';
   document.body.dataset.motionPreference=mode.value;
   replay.hidden=false;choice.hidden=false;status.hidden=false;
   replay.disabled=!on;replay.textContent='Replay CRT';
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
 Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,650))]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(startup)));
})();

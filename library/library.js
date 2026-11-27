import * as T from './vendor/three.module.min.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
const $=id=>document.getElementById(id);
const root=new URL('../',location.href),classic=new URL('../?view=classic',location.href);
const status=(s,p=0)=>{$('lcd-status').textContent=s;$('system').textContent=s;$('progress').style.width=p+'%';const el=$('scene-phase');if(el)el.textContent=p===100?'READY':p>=78?'03 / LIFT':p>=52?'02 / TRANSFER':p>=10?'01 / STORAGE':'READY';};
const safeStore=(k,v)=>{try{if(v!==undefined)localStorage.setItem(k,v);else return localStorage.getItem(k)}catch{}};
const media=matchMedia('(prefers-reduced-motion: reduce)');
const layoutQuery=matchMedia('(max-width:1024px) and (orientation:portrait)');
const machine=document.querySelector('.machine');
let query='',inspectOpen=false;
function viewport(){const v=window.visualViewport;document.documentElement.style.setProperty('--viewport-height',Math.floor(v?.height||innerHeight)+'px');}
viewport();addEventListener('resize',viewport);window.visualViewport?.addEventListener('resize',viewport);
function inspectMode(open){
 if(holdTask)return holdTask.then(()=>inspectMode(open));
 if(open===inspectOpen||!activeBox||!scene||busy)return Promise.resolve();
 holdTask=changeHold(open).finally(()=>{holdTask=null;refreshButtons();});refreshButtons();return holdTask;
}
function modal(id){const d=$(id);if(!d.open)d.showModal();}
$('settings-open').onclick=()=>modal('settings-dialog');$('details-open').onclick=()=>modal('details-dialog');$('search-open').onclick=()=>{$('search').value=query;modal('search-dialog');$('search').focus();};$('inspect-open').onclick=()=>inspectMode(!inspectOpen);$('inspect-close').onclick=()=>{inspectMode(false);$('inspect-open').focus({preventScroll:true});};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());layoutQuery.addEventListener('change',()=>{if(inspectOpen)inspectMode(false);});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&inspectOpen&&!document.querySelector('dialog[open]'))inspectMode(false);});
let motion=safeStore('euclidi.labs.catalog.motion.v1')||'auto';if(!['on','off','auto'].includes(motion))motion='auto';
$('motion').value=motion;const moving=()=>motion==='on'||motion==='auto'&&!media.matches;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),lerp=(a,b,t)=>a+(b-a)*t,TAU=Math.PI*2;
const ease=t=>t*t*(3-2*t);
let audio,master,hum,humGain,noise,enabled=false;
async function soundToggle(){
 if(enabled){enabled=false;master.gain.setTargetAtTime(0,audio.currentTime,.08);}
 else{try{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=0;master.connect(audio.destination);hum=audio.createOscillator();hum.type='triangle';hum.frequency.value=59.5;humGain=audio.createGain();humGain.gain.value=.013;hum.connect(humGain).connect(master);hum.start();noise=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);let a=noise.getChannelData(0),last=0;for(let i=0;i<a.length;i++){last=.65*last+.35*(Math.random()*2-1);a[i]=last;}}await audio.resume();enabled=true;master.gain.setTargetAtTime(.65,audio.currentTime,.08);}catch(e){status('AUDIO UNAVAILABLE');}}
 $('sound').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(enabled));
}
function fx(kind,pan=0,dur=.16){if(!enabled||!audio)return;const t=audio.currentTime,g=audio.createGain(),p=audio.createStereoPanner();p.pan.value=clamp(pan,-1,1);p.connect(master);g.connect(p);const tone=audio.createOscillator(),n=audio.createBufferSource(),f=audio.createBiquadFilter();n.buffer=noise;n.loop=dur>1;f.type='lowpass';f.frequency.value=kind==='motor'?420:kind==='rattle'?1800:2400;n.connect(f).connect(g);tone.type=kind==='motor'?'triangle':'sine';tone.frequency.setValueAtTime(kind==='motor'?95:kind==='clack'?190:kind==='rattle'?90:440,t);tone.frequency.exponentialRampToValueAtTime(kind==='motor'?54:65,t+dur);tone.connect(g);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(kind==='motor'?.035:.065,t+.016);g.gain.exponentialRampToValueAtTime(.001,t+dur);n.start(t);tone.start(t);n.stop(t+dur+.01);tone.stop(t+dur+.01);}
$('sound').onclick=soundToggle;
$('motion').onchange=()=>{motion=$('motion').value;safeStore('euclidi.labs.catalog.motion.v1',motion);};
document.addEventListener('visibilitychange',()=>{if(audio&&master)master.gain.setTargetAtTime(document.hidden||!enabled?0:.65,audio.currentTime,.12)});
function mat(color,metal=.0,rough=.6,extra={}){return new T.MeshStandardMaterial({color,metalness:metal,roughness:rough,...extra});}
function rounded(w,h,d,r=.035){const s=new T.Shape(),x=-w/2,y=-h/2,rr=Math.min(r,w/3,h/3,d/2);s.moveTo(x+rr,y);s.lineTo(x+w-rr,y);s.quadraticCurveTo(x+w,y,x+w,y+rr);s.lineTo(x+w,y+h-rr);s.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);s.lineTo(x+rr,y+h);s.quadraticCurveTo(x,y+h,x,y+h-rr);s.lineTo(x,y+rr);s.quadraticCurveTo(x,y,x+rr,y);const g=new T.ExtrudeGeometry(s,{depth:Math.max(.001,d-rr*2),bevelEnabled:true,bevelThickness:rr,bevelSize:rr*.65,bevelSegments:2,steps:1,curveSegments:4});g.translate(0,0,-(d-rr*2)/2);return g;}
function mesh(parent,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function block(p,w,h,d,m,x=0,y=0,z=0,bevel=.025){return mesh(p,bevel?rounded(w,h,d,bevel):new T.BoxGeometry(w,h,d),m,x,y,z);}
function cylinder(p,r,h,m,x=0,y=0,z=0,r2=r,n=48){return mesh(p,new T.CylinderGeometry(r,r2,h,n),m,x,y,z);}
function ring(p,r,t,m,x,y,z){const q=mesh(p,new T.TorusGeometry(r,t,10,96),m,x,y,z);q.rotation.x=Math.PI/2;return q;}
function screw(p,x,y,z,scale=1){const b=cylinder(p,.035*scale,.018*scale,bright,x,y,z,.035*scale,12);b.rotation.x=Math.PI/2;block(p,.041*scale,.009*scale,.006*scale,dark,x,y,z+.014,0);}
function seed(n){return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}}
function textureNoise(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),r=seed(7),im=x.createImageData(256,256);for(let j=0;j<256;j++){const row=r()*16;for(let i=0;i<256;i++){let v=130+row+(r()-.5)*25,k=(j*256+i)*4;im.data[k]=im.data[k+1]=im.data[k+2]=v;im.data[k+3]=255;}}x.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,3);return t;}
let renderer,scene,camera,env,drum,drive,gear,fan,cart,lift,door,pusher,belts=[],groups=[],boxMeshes=[],activeBox=null,carried=null,category='All',page=0,selected=null,delivered=null,busy=false,inventory=[],shown=[],hover=null,hoverTarget=null,drag=false,dragX=0,dragY=0,rx=-.12,ry=-.25,targetRX=-.12,targetRY=-.25,clock=0,phase='idle',last=performance.now(),frameCount=0,mainWidth=0,mainHeight=0;
let metal,bright,dark,plastic,rubber,paint,glass,lightMat,brass,grip,leadScrew,focusX=-1.5;
let inspectionPivot=null,holdTask=null,heldState=null,holdProgress=0;const eyeCenter=new T.Vector3(),cameraAim=new T.Vector3(),cursorAim=new T.Vector2(),cursorNow=new T.Vector2();let cameraReady=false,selectionLight=null,slotMarker=null;
const ray=new T.Raycaster(),pointer=new T.Vector2(),tmp=new T.Vector3(),textures=new Map();
function makeEnv(r){const e=new T.Scene();e.background=new T.Color(0x46534a);const white=new T.MeshBasicMaterial({color:0xf7f5df}),grey=new T.MeshBasicMaterial({color:0x9bb2ac});for(const [x,y,z,w,h,c] of [[-4,4,3,5,4,white],[4,3,1,2,6,white],[0,6,-4,8,3,grey],[0,-3,4,6,2,grey]]){const a=mesh(e,new T.PlaneGeometry(w,h),c,x,y,z);a.lookAt(0,0,0);}const pm=new T.PMREMGenerator(r),out=pm.fromScene(e,.035);pm.dispose();return out.texture;}
function initRenderer(){renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.outputColorSpace=T.SRGBColorSpace;$('stage').append(renderer.domElement);
 env=makeEnv(renderer);scene=new T.Scene();scene.background=new T.Color(0x202625);scene.environment=env;
 camera=new T.PerspectiveCamera(38,1,.08,100);camera.position.set(-.6,4.2,15);camera.lookAt(-2.3,1.7,1.0);
 const grain=textureNoise();metal=mat(0x88918e,.82,.31,{roughnessMap:grain});bright=mat(0xc7c8c0,.85,.22,{roughnessMap:grain});dark=mat(0x303637,.65,.50,{roughnessMap:grain});plastic=mat(0x333b33,.08,.62);rubber=mat(0x141e17,.0,.85);paint=mat(0xa7a99b,.20,.54,{roughnessMap:grain});glass=new T.MeshPhysicalMaterial({color:0xd8e7dd,metalness:0,roughness:.07,transparent:true,opacity:.085,depthWrite:false,clearcoat:1});lightMat=new T.MeshBasicMaterial({color:0xd9e9bc});brass=mat(0xa8a17a,.75,.32);grip=mat(0x252e27,.1,.8);
 scene.add(new T.HemisphereLight(0xe3e3d8,0x353b3a,1.55));const key=new T.DirectionalLight(0xffedcf,2.75);key.position.set(-4,8,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-9;key.shadow.camera.right=9;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;key.shadow.normalBias=.035;scene.add(key);const fill=new T.DirectionalLight(0xc7d8e2,1.6);fill.position.set(6,4,-3);scene.add(fill);
 selectionLight=new T.PointLight(0xffe9bc,0,4,2);scene.add(selectionLight);scene.add(new T.HemisphereLight(0xe9e1ca,0x343e3b,.35));
}
function cabinet(){
 const floor=block(scene,12.1,.23,7.5,dark,-.08,-.18,.1,.08);block(scene,12.15,.08,7.5,paint,-.08,-.03,.1,.02);
 // Drum assembly: visible bearing, central spindle, segmented circular shelf, radial partitions, driven ring.
 drum=new T.Group();drum.position.set(-2.3,0,-.55);scene.add(drum);
 cylinder(scene,3.16,.20,dark,-2.3,.1,-.55);cylinder(drum,3.02,.22,metal,0,.28,0);ring(drum,2.95,.065,bright,0,.43,0);cylinder(drum,.37,3.85,bright,0,2.11,0);cylinder(drum,.63,.25,dark,0,3.92,0);ring(drum,2.93,.045,bright,0,3.76,0);
 // Partial annular cover keeps the physical mechanism exposed.
 for(let i=0;i<Math.max(4,catalogCategories().length);i++){const a=i*TAU/Math.max(4,catalogCategories().length),sector=new T.Group();sector.rotation.y=a;drum.add(sector);groups.push(sector);for(const sign of [-1,1]){const b=a+sign*Math.PI/4;const post=cylinder(drum,.056,3.15,bright,Math.sin(b)*2.85,2.03,Math.cos(b)*2.85);const divider=block(sector,.055,2.72,1.40,dark,sign*1.80,1.93,1.58,.01);divider.rotation.y=sign*.47;}const shelf=mesh(sector,new T.RingGeometry(.72,2.91,32,1,Math.PI*1.25,Math.PI*.5),metal,0,.54,0);shelf.rotation.x=-Math.PI/2; // open transfer edge
 const label=block(sector,1.8,.18,.08,paint,0,3.32,2.55);for(let k=0;k<3;k++)screw(sector,-.75+k*.75,3.32,2.61);
 }
 gear=new T.Group();gear.position.set(-2.3,.41,-.55);scene.add(gear);ring(gear,3.10,.065,brass,0,0,0);for(let i=0;i<72;i++){const a=i*TAU/72;const tooth=block(gear,.11,.13,.20,brass,Math.sin(a)*3.11,0,Math.cos(a)*3.11,.008);tooth.rotation.y=a;}
 drive=new T.Group();drive.position.set(1.05,.42,-.55);scene.add(drive);cylinder(drive,.28,.32,metal,0,0,0);for(let i=0;i<14;i++){const a=i*TAU/14,b=block(drive,.075,.14,.13,bright,Math.sin(a)*.29,.18,Math.cos(a)*.29,.01);b.rotation.y=a;}block(scene,.85,.57,.85,dark,1.09,.3,-1.0);for(let i=0;i<8;i++)block(scene,.04,.40,.05,metal,.75+i*.09,.32,-.55,0);
 // Visible transfer belt spans carousel exit to lift. Individual rollers and linked belt slats.
 cart=new T.Group();cart.position.set(0,.64,3.18);scene.add(cart);
 block(cart,7.1,.26,1.17,metal,.10,-.2,0,.035);for(let i=0;i<32;i++){const roller=cylinder(cart,.08,1.03,bright,-3.43+i*.222,-.045,0,.08,16);roller.rotation.x=Math.PI/2;belts.push(roller);}for(const z of [-.63,.63]){block(cart,7.12,.13,.11,dark,.10,.04,z);for(let i=0;i<13;i++)screw(cart,-3.35+i*.56,.04,z+.07);}
 pusher=new T.Group();pusher.position.set(-2.3,.88,1.17);scene.add(pusher);block(pusher,.42,.28,.50,paint,0,0,0);const shaft=cylinder(pusher,.065,.95,bright,0,0,.58,.065,18);shaft.rotation.x=Math.PI/2;pusher.userData.shaft=shaft;const pad=block(pusher,.5,.30,.08,grip,0,0,1.10);pusher.userData.pad=pad;
 // Lift side: double chrome guide rods, vertical lead screw, carriage and shelf.
 const lx=4.4,lz=3.18;for(const x of [lx-.73,lx+.73]){cylinder(scene,.07,3.75,bright,x,1.86,lz-.65);block(scene,.24,3.8,.19,dark,x,1.87,lz-.79);block(scene,.35,.22,.38,paint,x,3.76,lz-.65);}
 block(scene,1.85,.24,1.65,paint,lx,.04,lz);block(scene,1.85,.20,1.45,paint,lx,3.82,lz);leadScrew=new T.Group();leadScrew.position.set(lx,1.88,lz-.69);scene.add(leadScrew);cylinder(leadScrew,.075,3.55,brass,0,0,0,.075,32);const thread=[];for(let i=0;i<=640;i++){const a=i/640*TAU*24;thread.push(new T.Vector3(.086*Math.cos(a),-1.72+i/640*3.44,.086*Math.sin(a)));}mesh(leadScrew,new T.TubeGeometry(new T.CatmullRomCurve3(thread),640,.016,6,false),bright);lift=new T.Group();lift.position.set(lx,.64,lz);scene.add(lift);block(lift,1.48,.13,1.27,bright,0,-.08,0);for(const x of [-.70,.70])block(lift,.17,.38,.27,dark,x,.03,-.57);for(let i=0;i<6;i++)block(lift,.028,.017,1.05,rubber,-.57+i*.23,0,0,0);
 door=new T.Group();door.position.set(lx,.22,lz+.83);scene.add(door);block(door,1.75,.09,.09,metal,0,.05,0);const pane=block(door,1.63,.98,.04,glass,0,.56,0,.01);pane.castShadow=false;for(const x of [-.84,.84])block(door,.06,1.05,.08,bright,x,.56,0);block(door,1.74,.06,.09,bright,0,1.08,0);
 // Open industrial chassis, braces, cooling fan and inspection lighting.
 for(const x of [-5.68,5.36]){block(scene,.16,4.10,.19,paint,x,2.03,-3.45);block(scene,.36,.14,.35,bright,x,.12,-3.45);}block(scene,11.1,.18,.20,metal,-.16,4.04,-3.45);
 for(let i=0;i<5;i++)block(scene,.08,.12,3.64,metal,-4.8+i*2.35,4.06,-1.67);const lamp=block(scene,9.9,.055,.13,lightMat,-.14,3.95,.10,.01);lamp.castShadow=false;
 const fanbase=block(scene,1.20,1.20,.18,dark,3.9,2.25,-2.75);fan=new T.Group();fan.position.set(3.9,2.25,-2.61);scene.add(fan);const rim=mesh(scene,new T.TorusGeometry(.51,.055,10,48),metal,3.9,2.25,-2.62);for(let i=0;i<7;i++){const blade=block(fan,.18,.43,.045,metal,0,0,0,.018);const a=i*TAU/7;blade.position.set(Math.sin(a)*.25,Math.cos(a)*.25,0);blade.rotation.z=-a+.45;}const hub=cylinder(fan,.14,.12,bright,0,0,.03);hub.rotation.x=Math.PI/2;for(let i=0;i<9;i++)block(scene,.99,.035,.04,dark,3.9,1.82+i*.10,-2.53,0);
 // Distinct fasteners and rail ends; no solid cabinet walls to waste viewport space.
 for(let i=0;i<10;i++){screw(scene,-5.2+i*1.12,.17,4.02,1.4);}for(const x of [-5.7,5.35]){block(scene,.25,.19,.45,rubber,x,-.28,3.85);}
}
// Fabricated hardware, fitted to the existing transport coordinates.
function arcPanel(p,r0,r1,a0,a1,y,h,material){
 const s=new T.Shape();s.absarc(0,0,r1,a0,a1,false);s.lineTo(Math.cos(a1)*r0,Math.sin(a1)*r0);s.absarc(0,0,r0,a1,a0,true);s.closePath();
 const geo=new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:48});const m=mesh(p,geo,material,0,y,0);m.rotation.x=-Math.PI/2;return m;
}
function cable(p,points,r,m){return mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),32,r,8,false),m);}
function decal(p,txt,w,h,x,y,z,rot=0){
 const c=document.createElement('canvas');c.width=768;c.height=128;const q=c.getContext('2d');q.fillStyle='#d0c9b4';q.fillRect(0,0,768,128);q.fillStyle='#232a29';q.fillRect(0,0,12,128);q.font='bold 48px monospace';q.textBaseline='middle';q.fillText(txt,27,64);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const obj=mesh(p,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t}),x,y,z);obj.rotation.y=rot;obj.castShadow=false;return obj;
}
function hardwareFinish(){
 const enamel=mat(0xb3b0a1,.19,.54),black=mat(0x252a2a,.48,.44),red=mat(0x9c422d,.35,.53),yellow=mat(0xcaa05a,.25,.54),gasket=mat(0x171e1e,.05,.78);
 // A low, stepped plinth encloses the drive motor and the lower ring, not the boxes.
 const pedestal=new T.Group();pedestal.position.set(-2.3,0,-.55);scene.add(pedestal);
 arcPanel(pedestal,3.09,3.25,0,TAU,.03,.31,enamel);ring(pedestal,3.26,.026,black,0,.34,0);
 // Hollow upper rim exposes the box compartment. A compact hub and spokes carry it.
 arcPanel(drum,2.68,2.98,0,TAU,3.57,.14,enamel);ring(drum,2.98,.025,bright,0,3.72,0);
 for(let i=0;i<8;i++){const a=i*TAU/8;const s=block(drum,.14,.10,2.23,metal,Math.sin(a)*1.53,3.64,Math.cos(a)*1.53,.012);s.rotation.y=a;const bolt=cylinder(drum,.06,.035,bright,Math.sin(a)*2.79,3.75,Math.cos(a)*2.79,.06,12);}
 // Enclosure only on rear and sides; front remains open for picking and transfer.
 for(const side of [-1,1]){const x=side===-1?-5.57:5.56;
 block(scene,.20,3.45,.28,enamel,x,1.92,-3.16,.06);
 block(scene,.27,.26,3.24,enamel,x,3.66,-1.60,.045);
 block(scene,.28,.36,2.66,enamel,x,.26,-1.95,.045);
 for(let i=0;i<4;i++)screw(scene,x,.23+i*1.03,-3.00,1.35);
 }
 const rear=block(scene,4.1,3.40,.12,black,3.05,1.92,-3.38,.06);
 for(let row=0;row<9;row++)for(let col=0;col<10;col++)block(scene,.19,.035,.028,gasket,1.2+col*.35,.63+row*.15,-3.30,.006);
 // Fitted end cap, inspection light, service hatch with raised gasket and four latches.
 block(scene,1.86,3.67,.17,enamel,4.4,1.88,2.25,.06);
 block(scene,1.55,2.08,.05,black,4.4,2.25,2.35,.035);
 block(scene,1.39,1.92,.06,paint,4.4,2.25,2.39,.025);
 for(const x of [3.77,5.03])for(const y of [1.41,3.09])screw(scene,x,y,2.44,1.35);
 block(scene,1.62,.16,.12,lightMat,4.4,3.48,3.05,.025).castShadow=false;
 decal(scene,'LIFT / 02',1.25,.20,4.4,3.24,2.45);
 // Two short guarded transfer bridges, side mounting plates, motor housing.
 for(const z of [2.51,3.85]){block(scene,6.92,.18,.10,enamel,.12,.51,z,.025);for(let i=0;i<11;i++)screw(scene,-3.05+i*.62,.51,z+.064,1.2);}
 const motor=new T.Group();motor.position.set(.95,.37,-1.1);scene.add(motor);
 const motorBody=cylinder(motor,.39,.72,black,0,0,0,.39,32);motorBody.rotation.z=Math.PI/2;
 for(let i=0;i<8;i++){const r=ring(motor,.405,.022,metal,-.32+i*.09,0,0);r.rotation.set(0,Math.PI/2,0);}
 const cap=cylinder(motor,.40,.09,enamel,.42,0,0,.40,32);cap.rotation.z=Math.PI/2;
 cable(scene,[[1.36,.36,-1.1],[1.72,.39,-1.13],[1.85,.22,-1.9],[2.1,.18,-2.9],[3.1,.24,-3.2]],.045,rubber);
 cable(scene,[[3.5,3.62,2.53],[3.2,3.45,2.1],[2.8,3.25,1.2],[3.0,3.15,-.6],[4.0,2.95,-3.20]],.036,rubber);
 // Stop strip is printed on the sill, not projected over box artwork.
 const stripe=block(scene,1.33,.12,.045,yellow,4.4,.26,4.02,.005);for(let i=0;i<8;i++){const s=block(scene,.07,.10,.012,black,3.83+i*.16,.26,4.055,0);s.rotation.z=-.45;}
 decal(scene,'EG  /  ROTARY 01',2.13,.21,-3.98,.24,4.04);
 decal(scene,'TRANSFER',1.65,.20,.65,.24,4.04);
 // Service switch and machined latch at the fixed operator side.
 block(scene,.53,.50,.14,black,5.26,2.71,2.47,.035);const stop=cylinder(scene,.16,.12,red,5.26,2.74,2.59,.16,32);stop.rotation.x=Math.PI/2;
 for(const y of [2.49,2.93])screw(scene,5.26,y,2.56);
}

// Merge only fixed, opaque parts with matching materials. Dynamic groups remain separate.
function batchFixed(parent,exclude=new Set()){
 const bins=new Map();
 for(const m of [...parent.children]){
  if(!m.isMesh||Array.isArray(m.material)||m.material.transparent||exclude.has(m)||m.userData.content)continue;
  if(!m.geometry.hasAttribute('position')||!m.geometry.hasAttribute('normal')||!m.geometry.hasAttribute('uv'))continue;
  const key=m.material.uuid+'|'+m.castShadow+'|'+m.receiveShadow;
  if(!bins.has(key))bins.set(key,[]);bins.get(key).push(m);
 }
 let saved=0;
 for(const list of bins.values()){if(list.length<3)continue;const parts=list.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);return g;});
 const geo=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!geo)continue;
 const merged=new T.Mesh(geo,list[0].material);merged.castShadow=list[0].castShadow;merged.receiveShadow=list[0].receiveShadow;parent.add(merged);
 for(const m of list){parent.remove(m);m.geometry.dispose();}saved+=list.length-1;
 }return saved;
}
function optimizeHardware(){let count=batchFixed(scene);count+=batchFixed(drum);count+=batchFixed(gear);count+=batchFixed(drive);count+=batchFixed(fan);count+=batchFixed(lift);count+=batchFixed(door);count+=batchFixed(cart,new Set(belts));for(const g of groups)count+=batchFixed(g);document.body.dataset.batched=String(count);}
function textFit(ctx,text,max,size,min=26){while(size>min){ctx.font='bold '+size+'px system-ui';if(ctx.measureText(text).width<=max)break;size-=2;}return size;}
function wrap(ctx,text,width){let lines=[],s='';for(const word of text.split(/\s+/)){if(s&&ctx.measureText(s+' '+word).width>width){lines.push(s);s=word;}else s+=(s?' ':'')+word;}if(s)lines.push(s);return lines;}
async function art(g){if(textures.has(g.id))return textures.get(g.id);const w=768,h=Math.round(w*g.h/g.w),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=g.bg;x.fillRect(0,0,w,h);const rand=seed(g.id*127+93);const image=g.art?await new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>resolve(null);i.src=g.art;}):null;
 // Original catalog identity, with only genuine existing artwork used where available.
 if(image){const scale=Math.max(w/image.width,(h*.57)/image.height),iw=image.width*scale,ih=image.height*scale;x.save();x.beginPath();x.rect(0,h*.22,w,h*.57);x.clip();x.drawImage(image,(w-iw)/2,h*.22+(h*.57-ih)/2,iw,ih);x.restore();}
 else {
 // Printed category-specific graphic identity, not a fictitious gameplay screenshot.
 x.save();x.translate(w*.5,h*.51);const u=Math.min(w,h)*.001;
 x.strokeStyle=g.ink;x.fillStyle=g.ink;x.lineWidth=3*u;
 if(g.category==='Tools'){for(let j=0;j<11;j++){const q=(j-5)*38*u;x.globalAlpha=.18+j*.045;x.strokeRect(-215*u+q*.22,-150*u+q*.55,430*u-q*.44,38*u);}x.globalAlpha=.9;x.font='bold '+Math.round(125*u)+'px monospace';x.textAlign='center';x.fillText(g.title.includes('PAC')?'PAC':g.title.includes('SNAKE')?'S':g.title.includes('BRICK')?'BB':g.title.slice(0,2).toUpperCase(),0,48*u);}
 else if(g.category==='Simulation'){for(let j=0;j<16;j++){const v=rand(),xx=(j-8)*29*u,hh=(40+v*190)*u;x.globalAlpha=.18+v*.37;x.fillRect(xx,-hh*.55,21*u,hh);}x.globalAlpha=.8;x.lineWidth=7*u;x.beginPath();for(let j=0;j<8;j++){const xx=(-208+j*59)*u,yy=(rand()-.5)*180*u;j?x.lineTo(xx,yy):x.moveTo(xx,yy);}x.stroke();}
 else if(g.category==='Physics'){for(let j=0;j<8;j++){const rr=(22+j*24)*u;x.globalAlpha=.12+j*.06;x.beginPath();x.arc(0,0,rr,.2+j*.2,5.9-j*.2);x.stroke();}x.globalAlpha=.92;x.beginPath();x.moveTo(-165*u,120*u);x.lineTo(-55*u,-45*u);x.lineTo(58*u,32*u);x.lineTo(165*u,-128*u);x.stroke();}
 else {for(let j=0;j<40;j++){x.globalAlpha=.2+rand()*.6;x.fillRect((rand()-.5)*420*u,(rand()-.5)*300*u,3*u,3*u);}for(let j=0;j<5;j++){x.globalAlpha=.35+j*.10;x.beginPath();x.ellipse(0,0,(50+j*37)*u,(18+j*19)*u,-.42,0,TAU);x.stroke();}}
 x.restore();
 }
 x.fillStyle=g.ink;x.fillRect(0,0,w,17);x.fillRect(0,h-20,w,20);x.strokeStyle=g.ink+'88';x.lineWidth=2;x.strokeRect(24,28,w-48,h-56);x.textAlign='left';x.fillStyle=g.ink;x.font='27px monospace';x.fillText('EUCLIDI LABS / SOFTWARE',43,73);x.textAlign='center';const size=textFit(x,g.title.toUpperCase(),w-100,72,33);x.font='bold '+size+'px system-ui';const lines=wrap(x,g.title.toUpperCase(),w-90);lines.slice(0,3).forEach((s,i)=>x.fillText(s,w/2,142+i*(size+6)));x.font='26px monospace';x.fillText(g.category.toUpperCase(),w/2,h-81);x.font='22px monospace';x.fillText('EL-'+String(g.id).padStart(3,'0')+' / BROWSER EDITION',w/2,h-46);
 for(let i=0;i<12000;i++){x.fillStyle=rand()>.5?'#ffffff0b':'#0000000c';x.fillRect(rand()*w,rand()*h,1+rand()*2,1);}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());const b=document.createElement('canvas');b.width=w;b.height=h;const bx=b.getContext('2d');bx.fillStyle='#e0dfc8';bx.fillRect(0,0,w,h);bx.fillStyle=g.bg;bx.fillRect(25,25,w-50,145);bx.fillStyle=g.ink;bx.font='bold 44px system-ui';wrap(bx,g.title,w-96).slice(0,2).forEach((l,i)=>bx.fillText(l,48,83+i*48));bx.fillStyle='#28392b';bx.font='32px system-ui';wrap(bx,g.description,w-96).slice(0,8).forEach((l,i)=>bx.fillText(l,48,230+i*47));bx.strokeStyle='#7f8c77';bx.strokeRect(48,h-170,w-96,110);bx.font='25px monospace';bx.fillText('EL-'+String(g.id).padStart(3,'0')+' / '+g.category.toUpperCase(),64,h-115);const back=new T.CanvasTexture(b);back.colorSpace=T.SRGBColorSpace;const s=document.createElement('canvas');s.width=128;s.height=768;const sx=s.getContext('2d');sx.fillStyle=g.bg;sx.fillRect(0,0,128,768);sx.translate(64,384);sx.rotate(Math.PI/2);sx.fillStyle=g.ink;sx.textAlign='center';sx.font='bold 36px system-ui';sx.fillText(g.title.toUpperCase(),0,12,680);const spine=new T.CanvasTexture(s);spine.colorSpace=T.SRGBColorSpace;
 const result={front:tex,back,spine};textures.set(g.id,result);return result;}
async function box(g){const tex=await art(g),m=new T.Group();m.userData.game=g;const shell=new T.MeshPhysicalMaterial({color:g.bg,roughness:.55,metalness:0,clearcoat:.28,clearcoatRoughness:.25});block(m,g.w,g.h,g.d,shell,0,g.h/2,0,.008);const seamMat=mat(g.bg,0,.85);for(const sign of [-1,1]){block(m,.007,.009,g.d-.025,seamMat,sign*(g.w/2+.009),g.h-.055,0,0);}block(m,g.w-.025,.009,.009,seamMat,0,g.h+.009,-g.d*.24,0);const face=new T.MeshPhysicalMaterial({map:tex.front,roughness:.38,metalness:0,clearcoat:1,clearcoatRoughness:.065,envMapIntensity:1.5});const back=new T.MeshPhysicalMaterial({map:tex.back,roughness:.52,clearcoat:.4});const spine=new T.MeshPhysicalMaterial({map:tex.spine,roughness:.42,clearcoat:.5});mesh(m,new T.PlaneGeometry(g.w-.015,g.h-.015),face,0,g.h/2,g.d/2+.008);const bb=mesh(m,new T.PlaneGeometry(g.w-.015,g.h-.015),back,0,g.h/2,-g.d/2-.008);bb.rotation.y=Math.PI;for(const sign of [-1,1]){const sp=mesh(m,new T.PlaneGeometry(g.d-.012,g.h-.015),spine,sign*(g.w/2+.008),g.h/2,0);sp.rotation.y=sign*Math.PI/2;}return m;}
function labelPlate(text){const c=document.createElement('canvas');c.width=512;c.height=80;const x=c.getContext('2d');x.fillStyle='#a9b79d';x.fillRect(0,0,512,80);x.strokeStyle='#50624c';x.strokeRect(4,4,504,72);x.fillStyle='#263b2a';x.textAlign='center';x.font='bold 32px monospace';x.fillText(text.toUpperCase(),256,51);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:tex});}
function parseCatalog(source){const doc=new DOMParser().parseFromString(source,'text/html');return [...doc.querySelectorAll('article.game')].map((el,i)=>{const title=el.querySelector('.info h2')?.textContent.trim(),cover=el.querySelector('.cover'),id=Number(cover?.querySelector('.cover-top span')?.textContent.match(/\d+/)?.[0]||i+1),cat=el.dataset.category||'Other',bg=el.style.getPropertyValue('--cover').trim()||'#344539',ink=el.style.getPropertyValue('--ink').trim()||'#dce7d0',image=cover?.querySelector('img')?.getAttribute('src'),sizes=cat==='Tools'?[.82,1.13,.23]:cat==='Physics'?[1.04,1.55,.32]:cat==='Research'?[1.17,1.83,.40]:[1.12,1.72,.36];const factor=1+((id%3)-1)*.075;return {title,id,category:cat,bg,ink,description:el.querySelector('.info p')?.textContent.trim()||'',build:el.querySelector('.meta span:last-child')?.textContent.trim()||'',url:new URL(el.querySelector('.play').getAttribute('href'),root).href,links:[...el.querySelectorAll('.project-docs a,.actions a:not(.play)')].map(a=>({name:a.textContent.trim(),url:new URL(a.getAttribute('href'),root).href})),art:image?new URL(image,root).href:null,w:sizes[0]*factor,h:sizes[1]*factor,d:sizes[2]};}).filter(g=>g.title);}
let angle=0,displaySector=0,renderVersion=0;
function filtered(){const q=query.trim().toLowerCase();return inventory.filter(g=>(category==='All'||g.category===category)&&[g.title,g.category,g.description,g.build].join(' ').toLowerCase().includes(q));}
function catalogCategories(){return [...new Set(inventory.map(g=>g.category))];}
function groupedPages(){const result=[],items=filtered();for(const cat of catalogCategories()){const group=items.filter(g=>g.category===cat);for(let i=0;i<group.length;i+=3)result.push({cat,items:group.slice(i,i+3)});}return result;}
function pages(){return Math.max(1,groupedPages().length);}
function refreshButtons(){
 const locked=busy||!!delivered||!!holdTask,list=groupedPages();page=clamp(page,0,Math.max(0,list.length-1));shown=list[page]?.items||[];
 $('page-label').textContent=(list.length?String(page+1).padStart(2,'0'):'00')+' / '+String(list.length).padStart(2,'0');
 $('prev').disabled=locked||page===0;$('next').disabled=locked||page>=pages()-1;$('categories').disabled=locked;$('categories').value=category;$('search-open').disabled=locked;$('search').disabled=locked;
 $('search-open').dataset.active=String(!!query);$('search-caption').textContent=query||'Find';$('search-open').title=query?'Search: '+query:'Find a project';
 $('titles').replaceChildren();for(const g of shown){const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(selected===g));b.title=g.title;b.setAttribute('aria-label',g.title);const label=document.createElement('span');label.className='game-label';label.textContent=g.title;const sp=document.createElement('span');sp.className='game-code';sp.textContent='EL-'+String(g.id).padStart(3,'0');b.append(label,sp);b.disabled=locked;b.dataset.game=String(g.id);b.onclick=()=>chooseBox(g);$('titles').append(b);}
 if(!shown.length)$('titles').textContent=inventory.length?'No matching projects.':'Inventory empty — awaiting experiments.';
 $('retrieve').disabled=busy||!selected||!!holdTask||delivered!==null;$('retrieve').hidden=!!delivered;
 $('return').disabled=busy||!!holdTask;$('launch').hidden=!selected||!!delivered;$('play').hidden=!delivered;$('return').hidden=!delivered;
 $('inspect-open').disabled=busy||!selected||!!holdTask;$('details-open').disabled=!selected;$('retrieve').textContent=busy?'Working…':'Retrieve';
 document.body.dataset.busy=String(busy||!!holdTask);machine.dataset.busy=String(busy);machine.dataset.delivered=String(!!delivered);
}
function tween(duration,fn){return new Promise(resolve=>{const start=performance.now();function tick(now){const t=moving()?clamp((now-start)/duration,0,1):1;fn(ease(t),t);if(t<1)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});}
async function loadSector(index,items,title){const sector=groups[index];for(const old of [...sector.children])if(old.userData.content){sector.remove(old);old.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.userData.ownedMaterial||old.userData.game&&o.material)o.material.dispose()});}const label=mesh(sector,new T.PlaneGeometry(1.77,.19),labelPlate(title),0,3.32,2.606);label.userData.content=true;label.userData.ownedMaterial=true;const models=[];for(let i=0;i<items.length;i++){const g=items[i],m=await box(g),a=(i-(items.length-1)/2)*.53;m.position.set(Math.sin(a)*2.24,.57,Math.cos(a)*2.24);m.rotation.y=a;m.userData.baseAngle=a;m.userData.home=m.position.clone();m.userData.content=true;sector.add(m);models.push(m);}return models;}
async function rebuild(turn=true){if(busy)return;if(inspectOpen||holdTask)await inspectMode(false);busy=true;refreshButtons();status('ROTATING TO CATEGORY',20);const v=++renderVersion;const cats=catalogCategories(),cat=shown[0]?.category||(category==='All'?cats[displaySector]:category)||cats[0]||'EMPTY',target=Math.max(0,cats.indexOf(cat)),newAngle=-target*TAU/groups.length;const models=await loadSector(target,shown,cat);if(v!==renderVersion)return;const start=drum.rotation.y;let delta=newAngle-start;while(delta>Math.PI)delta-=TAU;while(delta<-Math.PI)delta+=TAU;fx('motor',-.4,1);phase='rotate';await tween(turn?880:1,(t)=>{drum.rotation.y=start+delta*t;gear.rotation.y=drum.rotation.y;drive.rotation.y=-drum.rotation.y*10;models.forEach((m,i)=>{m.rotation.z=Math.sin(t*23+i)*.012*Math.sin(t*Math.PI);});});models.forEach(m=>m.rotation.z=0);displaySector=target;boxMeshes=models;phase='idle';fx('rattle',-.4,.22);busy=false;await select(shown.includes(selected)?selected:shown[0]||null);refreshButtons();status(shown.length?'INDEX LOCKED / READY':'NO MATCHING SOFTWARE',100);}
async function select(g){
 if(busy||delivered)return;if(inspectOpen||holdTask)await inspectMode(false);selected=g;activeBox=boxMeshes.find(m=>m.userData.game===g)||null;refreshButtons();
 if(!g){$('name').textContent=inventory.length?'No matching projects':'Awaiting experiments';$('description').textContent='Try another category or search term.';$('build').textContent='';$('docs').replaceChildren();$('lcd-title').textContent='NO SELECTION';$('lcd-category').textContent=category.toUpperCase();$('lcd-id').textContent='—';$('scene-hint').textContent=inventory.length?'No matching projects. Try Find or change category.':'No experiments registered yet.';return;}
 $('name').textContent=g.title;$('description').textContent=g.description;$('build').textContent=g.build;$('lcd-title').textContent=g.title.toUpperCase();$('lcd-category').textContent=g.category.toUpperCase();$('lcd-id').textContent='EL-'+String(g.id).padStart(3,'0');$('launch').href=g.url;$('docs').replaceChildren();g.links.forEach(l=>{const a=document.createElement('a');a.href=l.url;a.textContent=l.name;$('docs').append(a);});
 targetRX=-.06;targetRY=-.18;rx=targetRX;ry=targetRY;status('SELECTED · TAP BOX TO INSPECT',0);$('scene-hint').textContent='Tap a box to inspect it. Swipe to browse.';fx('click',0);
}
function heldTarget(g){
 const vfov=T.MathUtils.degToRad(camera.fov),aspect=camera.aspect;
 const d=Math.max(g.h/(2*Math.tan(vfov/2)*.68),g.w/(2*Math.tan(vfov/2)*aspect*.70),g.d*2+.4);
 return camera.localToWorld(new T.Vector3(0,-d*Math.tan(vfov/2)*.015,-d));
}
function heldRotation(){return camera.quaternion.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(rx,ry,0,'YXZ')));}
async function changeHold(open){
 const m=activeBox,g=m.userData.game;
 if(open){
  // Preserve the very same physical box, including material and mesh identity.
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const original=m.parent,local=m.position.clone(),rotation=m.quaternion.clone(),scale=m.scale.clone(),worldQ=m.getWorldQuaternion(new T.Quaternion()),center=m.localToWorld(new T.Vector3(0,g.h/2,0));
  heldState={m,original,local,rotation,scale};const pivot=new T.Group();pivot.position.copy(center);pivot.quaternion.copy(worldQ);scene.add(pivot);pivot.attach(m);m.position.set(0,-g.h/2,0);m.quaternion.identity();inspectionPivot=pivot;
  inspectOpen=true;machine.dataset.inspecting='true';$('inspect-open').setAttribute('aria-pressed','true');$('inspect-open').textContent='Back';$('scene-hint').textContent='Drag the box to turn it over.';targetRX=-.06;targetRY=-.18;rx=targetRX;ry=targetRY;
  fx('clack',0,.16);const start=center.clone(),q=worldQ.clone();
  await tween(420,t=>{holdProgress=t;pivot.position.lerpVectors(start,heldTarget(g),t);pivot.quaternion.slerpQuaternions(q,heldRotation(),t);});
  holdProgress=1;status('INSPECTION · DRAG TO ROTATE',0);$('stage').focus({preventScroll:true});
 }else{
  if(!heldState)return;drag=false;const {m,original,local,rotation,scale}=heldState;const pivot=inspectionPivot;const start=pivot.position.clone(),q=pivot.quaternion.clone();original.updateWorldMatrix(true,false);
  const end=original.localToWorld(local.clone().add(new T.Vector3(0,g.h/2,0).applyQuaternion(rotation))),endQ=original.getWorldQuaternion(new T.Quaternion()).multiply(rotation);
  await tween(310,t=>{holdProgress=1-t;pivot.position.lerpVectors(start,end,t);pivot.quaternion.slerpQuaternions(q,endQ,t);});
  original.attach(m);m.position.copy(local);m.quaternion.copy(rotation);m.scale.copy(scale);scene.remove(pivot);inspectionPivot=null;heldState=null;holdProgress=0;inspectOpen=false;machine.dataset.inspecting='false';$('inspect-open').setAttribute('aria-pressed','false');$('inspect-open').textContent='Inspect';$('scene-hint').textContent=delivered?'Box ready. Play or return it.':'Tap a box to inspect it. Swipe to browse.';status(delivered?'PACKAGE DELIVERED':'SELECTED',delivered?100:0);fx('click',0,.12);
 }
}
async function chooseBox(g){if(busy||delivered)return;if(selected!==g)await select(g);if(!inspectOpen)await inspectMode(true);}
function moveBox(m,x,y,z){m.position.set(x,y,z);}
async function retrieve(){if(busy||!selected||delivered)return;await inspectMode(false);const g=selected,m=activeBox;if(!m)return;busy=true;refreshButtons();phase='eject';status('ALIGNING YOUR BOX',10);m.position.copy(m.userData.home);m.rotation.set(0,m.userData.baseAngle,0);const a=m.userData.baseAngle,old=drum.rotation.y;fx('motor',-.4,.65);await tween(560,t=>{drum.rotation.y=old-a*t;gear.rotation.y=drum.rotation.y;drive.rotation.y=-drum.rotation.y*10;});const wp=m.getWorldPosition(new T.Vector3());carried=m;m.userData.returnAngle=old;m.userData.returnWorld=wp.clone();scene.attach(m);m.rotation.set(0,0,0);pusher.position.x=wp.x;pusher.position.z=wp.z-1.35;const pad=pusher.userData.pad,shaft=pusher.userData.shaft;const initialPad=1.35-g.d/2-.04;pad.position.z=initialPad;const shaftAnchor=.23;function setExtension(z){pad.position.z=z;const len=Math.max(.1,z-shaftAnchor-.04);shaft.scale.y=len/.95;shaft.position.z=shaftAnchor+len/2;}setExtension(initialPad);status('SLIDING BOX OUT',30);fx('motor',-.35,.8);await tween(650,t=>{const z=lerp(wp.z,3.18,t);moveBox(m,wp.x,lerp(wp.y,.69,t),z);setExtension(initialPad+(3.18-wp.z)*t);});status('MOVING TO DELIVERY',52);phase='belt';fx('motor',0,1.35);await tween(1100,t=>{moveBox(m,lerp(wp.x,4.4,t),lerp(.69,.655,Math.max(0,(t-.85)/.15)),3.18);m.rotation.z=Math.sin(t*46)*.009;setExtension(lerp(initialPad+(3.18-wp.z),initialPad,t));});setExtension(initialPad);m.rotation.z=0;phase='lift';status('LOWERING BOX',78);fx('motor',.65,.75);await tween(650,t=>{lift.position.y=lerp(.64,.17,t);m.position.y=lift.position.y+.015;});phase='door';status('OPENING RETRIEVAL BAY',93);fx('clack',.65,.18);await tween(480,t=>{door.rotation.x=-t*1.25;});delivered=g;carried=null;phase='idle';busy=false;$('play').href=g.url;$('play').textContent='Open project';$('play').setAttribute('aria-label','Play '+g.title);$('scene-hint').textContent='Box ready. Play or return it.';refreshButtons();status('PACKAGE DELIVERED',100);fx('rattle',.65,.25);document.body.dataset.delivery='ready';}
async function returnBox(){if(busy||!delivered)return;await inspectMode(false);busy=true;refreshButtons();phase='lift';status('RETURNING SOFTWARE',20);const m=activeBox;fx('motor',.6,1);await tween(600,t=>{door.rotation.x=lerp(-1.25,0,t);lift.position.y=lerp(.17,.64,t);if(m)m.position.y=lift.position.y+.015;});phase='belt';const home=m?.userData.returnWorld||new T.Vector3(-2.3,.57,1.69);await tween(750,t=>{if(m)m.position.x=lerp(4.4,home.x,t);});await tween(420,t=>{if(m){m.position.z=lerp(3.18,home.z,t);m.position.y=lerp(.655,home.y,t);}});if(m){groups[displaySector].attach(m);m.position.copy(m.userData.home);m.rotation.set(0,m.userData.baseAngle,0);}delivered=null;document.body.dataset.delivery='empty';$('scene-hint').textContent='Tap a project box or swipe to browse.';busy=false;phase='idle';await rebuild(true);}
function rayHit(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(boxMeshes.filter(m=>m.parent===groups[displaySector]),true)[0];if(!hit)return null;let m=hit.object;while(m&&!m.userData.game)m=m.parent;return m||null;}
function input(){
 const canvas=renderer.domElement,stage=$('stage');let down=null;
 function coords(e){const r=canvas.getBoundingClientRect();cursorAim.set(clamp((e.clientX-r.left)/r.width*2-1,-1,1),clamp((e.clientY-r.top)/r.height*2-1,-1,1));}
 canvas.addEventListener('pointerdown',e=>{if(busy||holdTask)return;down={x:e.clientX,y:e.clientY};drag=inspectOpen;dragX=e.clientX;dragY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{
  coords(e);if(busy||holdTask)return;
  if(inspectOpen){if(drag){targetRY+=(e.clientX-dragX)*.014;targetRX=clamp(targetRX+(e.clientY-dragY)*.011,-1.15,1.15);dragX=e.clientX;dragY=e.clientY;}else if(e.pointerType==='mouse'){targetRY=cursorAim.x*.62;targetRX=-cursorAim.y*.40;}return;}
  hoverTarget=rayHit(e);canvas.style.cursor=hoverTarget?'pointer':'grab';
 });
 canvas.addEventListener('pointerleave',()=>{hoverTarget=null;cursorAim.set(0,0);});
 canvas.addEventListener('pointercancel',()=>{down=null;drag=false;});
 canvas.addEventListener('pointerup',e=>{
  if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;down=null;drag=false;
  if(busy||holdTask||inspectOpen)return;
  if(delivered){if(Math.abs(dx)+Math.abs(dy)<24)inspectMode(true);return;}
  if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.25){const target=clamp(page+(dx<0?1:-1),0,pages()-1);if(target!==page){page=target;rebuild();}}
  else if(Math.abs(dx)+Math.abs(dy)<32){const m=rayHit(e);if(m)chooseBox(m.userData.game);}
 });
 stage.addEventListener('keydown',e=>{if(inspectOpen&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();targetRY+=(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*.18;targetRX=clamp(targetRX+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)*.15,-1.15,1.15);}else if(!busy&&!delivered&&!holdTask&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const n=clamp(page+(e.key==='ArrowRight'?1:-1),0,pages()-1);if(n!==page){page=n;rebuild();}}});
 $('reset-view').onclick=()=>{targetRX=-.06;targetRY=-.18;};$('retrieve').onclick=retrieve;$('return').onclick=returnBox;
}
function resize(){
 const r=$('stage').getBoundingClientRect();if(r.width<1||r.height<1)return;
 if(r.width!==mainWidth||r.height!==mainHeight){mainWidth=r.width;mainHeight=r.height;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
}
function cameraStep(dt){
 const a=mainWidth/Math.max(1,mainHeight),narrow=a<1.5;
 if(inspectOpen||holdTask&&inspectionPivot)return;
 let x=narrow?-2.3:-.25,y=1.63,z=1.35,half=narrow?Math.max(2.18,2.65/a):Math.max(2.45,4.8/a);
 if((phase==='belt'||phase==='eject')&&activeBox?.parent===scene){x=activeBox.position.x;y=activeBox.position.y+.85;z=activeBox.position.z;half=Math.max(1.65,2.2/a);}
 if(phase==='lift'||phase==='door'||delivered){x=4.4;y=1.12;z=3.18;half=Math.max(1.63,1.95/a);}
 if(!busy&&!delivered&&activeBox){const world=activeBox.getWorldPosition(new T.Vector3());x+=narrow?clamp((world.x+2.3)*.16,-.35,.35):0;}
 cursorNow.lerp(cursorAim,moving()?Math.min(1,dt*4):1);const k=!cameraReady||!moving()?1:Math.min(1,dt*4.5);
 cameraAim.lerp(new T.Vector3(x,y,z),k);const pos=new T.Vector3(cameraAim.x+(narrow ? .85 : 1.4)+cursorNow.x*.15,cameraAim.y+(narrow?1.65:2.1)-cursorNow.y*.08,cameraAim.z+12.5);camera.position.lerp(pos,k);camera.lookAt(cameraAim);
 const distance=camera.position.distanceTo(cameraAim);camera.fov=lerp(camera.fov,T.MathUtils.radToDeg(2*Math.atan(half/distance)),k);camera.updateProjectionMatrix();camera.updateMatrixWorld();cameraReady=true;
}
function placeLabels(){
 const hide=busy||delivered||inspectOpen||!!holdTask;const labels=$('titles');labels.dataset.inactive=String(hide);if(hide)return;
 const visible=boxMeshes.filter(m=>m.parent===groups[displaySector]);for(const b of labels.querySelectorAll('button[data-game]')){
  const m=visible.find(m=>String(m.userData.game.id)===b.dataset.game);if(!m)continue;
  const v=m.localToWorld(new T.Vector3(0,-.09,m.userData.game.d/2+.14)).project(camera);
  const w=Math.min(150,Math.max(64,mainWidth/Math.max(1,visible.length)-12));
  b.style.width=w+'px';b.style.left=clamp((v.x+1)*mainWidth/2,w/2+5,mainWidth-w/2-5)+'px';b.style.top=clamp((1-v.y)*mainHeight/2,18,Math.max(18,mainHeight-59))+'px';
 }
}
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;if(document.hidden)return;resize();cameraStep(dt);
 if(moving()){
  fan.rotation.z+=dt*2.8;if(phase==='lift')leadScrew.rotation.y+=dt*13;if(phase==='belt')belts.forEach(b=>b.rotateY(dt*9));
  if(!busy&&!delivered&&!inspectOpen&&!holdTask)for(const m of boxMeshes){const hit=m===hoverTarget||m===activeBox;m.rotation.y=lerp(m.rotation.y,m.userData.baseAngle+(m===hoverTarget?-.13:0),.2);m.rotation.x=lerp(m.rotation.x,m===hoverTarget?-.075:0,.2);m.position.y=lerp(m.position.y,m.userData.home.y+(hit ? .018 : 0),.2);}
  $('lcd').style.filter='brightness('+(1+.008*Math.sin(clock*17)+.004*Math.sin(clock*53))+')';
 }else $('lcd').style.filter='none';
 if(inspectionPivot&&heldState&&!holdTask){rx=lerp(rx,targetRX,moving() ? .18 : 1);ry=lerp(ry,targetRY,moving() ? .18 : 1);inspectionPivot.position.copy(heldTarget(heldState.m.userData.game));inspectionPivot.quaternion.copy(heldRotation());}
 if(selectionLight){const target=inspectionPivot?inspectionPivot.position:activeBox?.getWorldPosition(new T.Vector3());if(target){selectionLight.position.copy(target).add(new T.Vector3(0,1.5,2.1));selectionLight.intensity=lerp(selectionLight.intensity,inspectOpen?9:3,.15);}else selectionLight.intensity=0;}
 if(busy||holdTask||hoverTarget||frameCount%16===0)renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);placeLabels();
 if(++frameCount%3===0){document.body.dataset.frames=String(frameCount);document.body.dataset.drum=drum.rotation.y.toFixed(3);document.body.dataset.lift=lift.position.y.toFixed(3);document.body.dataset.inspect=ry.toFixed(3);document.body.dataset.viewport=innerWidth+'x'+innerHeight;document.body.dataset.drawcalls=String(renderer.info.render.calls);document.body.dataset.held=String(!!inspectionPivot);document.body.dataset.heldSame=String(!!heldState&&heldState.m===activeBox);}
}
async function start(){try{const res=await fetch(classic.href,{cache:'no-cache'});if(!res.ok)throw Error('Catalog data unavailable');inventory=parseCatalog(await res.text());await document.fonts.ready;initRenderer();cabinet();hardwareFinish();optimizeHardware();const cats=['All',...new Set(inventory.map(g=>g.category))];
 for(const cat of cats){const option=document.createElement('option');option.value=cat;option.textContent=cat==='All'?'All projects':cat;$('categories').append(option);}
 $('categories').onchange=()=>{if(busy||delivered)return;category=$('categories').value;page=0;rebuild();};
 $('search-form').onsubmit=e=>{e.preventDefault();if(busy||delivered)return;query=$('search').value.trim();category='All';page=0;$('search-dialog').close();rebuild();};
 $('clear-search').onclick=()=>{if(busy||delivered)return;query='';$('search').value='';page=0;$('search-dialog').close();rebuild();};
 $('prev').onclick=()=>{if(!busy&&!delivered&&page>0){page--;rebuild();}};
 $('next').onclick=()=>{if(!busy&&!delivered&&page<pages()-1){page++;rebuild();}};
 // Populate the three inactive sectors from actual game categories before the first index.
 for(let i=0;i<groups.length;i++){const cat=cats[i+1]||'RESERVE',items=inventory.filter(g=>g.category===cat).slice(0,3);await loadSector(i,items,cat);}
 input();refreshButtons();await rebuild(false);resize();cameraStep(1);renderer.render(scene,camera);placeLabels();$('loading').hidden=true;document.body.dataset.ready='true';document.body.dataset.inventory=String(inventory.length);document.body.dataset.delivery='empty';requestAnimationFrame(frame);
 }catch(e){console.error(e);$('loading').innerHTML='<div class="fatal">MECHANICAL VIEW UNAVAILABLE<br><a href="../?view=classic">OPEN CLASSIC VIEW ↗</a></div>';$('system').textContent='RENDERER OFFLINE';document.body.dataset.ready='error';}}
 start();

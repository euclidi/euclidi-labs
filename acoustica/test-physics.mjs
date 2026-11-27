import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const bytes=fs.readFileSync(new URL('core.wasm',import.meta.url));const imports={math:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt}};const {instance}=await WebAssembly.instantiate(bytes,imports),w=instance.exports;
const W=160,H=100,dx=.0125,N=W*H;let results=[];function check(name,pass,detail){results.push({name,pass,detail});assert.ok(pass,name+': '+detail);}
w.field_init(dx,0,0,1,0);const dt=w.field_dt(),p=new Float64Array(w.memory.buffer,w.field_p(),N);check('CFL safety',343*dt/dx*Math.SQRT2<1,343*dt/dx*Math.SQRT2);
// Right-traveling wave packet in homogeneous duct, centered spatially; use matched velocity initial state.
const u=new Float64Array(w.memory.buffer,w.field_u(),(W+1)*H),v=new Float64Array(w.memory.buffer,w.field_v(),W*(H+1));const rho=1.204,c=343,lambda=20*dx,k=2*Math.PI/lambda,xc=35*dx,sigma=.15;
function pulse(x){return Math.exp(-.5*((x-xc)/sigma)**2)*Math.cos(k*(x-xc));}
for(let y=0;y<H;y++){for(let x=0;x<W;x++)p[y*W+x]=pulse((x+.5)*dx);for(let x=1;x<W;x++)u[y*(W+1)+x]=pulse(x*dx+c*dt/2)/(rho*c);}
function centroid(){let num=0,den=0;for(let x=0;x<W;x++){let a=p[50*W+x]**2;num+=(x+.5)*dx*a;den+=a;}return num/den;}
let before=centroid(),steps=80;for(let i=0;i<steps;i++)w.field_step(0,-1,-1);let speed=(centroid()-before)/(steps*dt);check('Wave packet speed (20 cells/wavelength)',Math.abs(speed/c-1)<.02,speed);
function energy(){let E=0;for(let x of p)E+=x*x/(2*rho*c*c);for(let x of u)E+=rho*x*x/2;for(let x of v)E+=rho*x*x/2;return E;}
let e1=energy();for(let i=0;i<60;i++)w.field_step(0,-1,-1);let e2=energy();check('Short lossless energy drift',Math.abs(e2/e1-1)<.01,e2/e1-1);
w.field_init(dx,1,1,1,1);for(let i=0;i<250;i++)w.field_step(10000*Math.sin(2*Math.PI*440*i*w.field_dt()),25,50);check('Heterogeneous simulation finite',p.every(Number.isFinite),Math.max(...p));
const emitted=[];const response=()=>new Response(bytes,{headers:{'Content-Type':'application/wasm'}});const ctx=vm.createContext({Math,Float64Array,Float32Array,WebAssembly,fetch:async()=>response(),postMessage:m=>emitted.push(m),onmessage:null});vm.runInContext(fs.readFileSync(new URL('physics.js',import.meta.url),'utf8'),ctx);
for(let mode of ['plate','tube','field','voice','ripple']){await ctx.onmessage({data:{type:'config',mode,cfg:{length:mode==='voice'?.17:mode==='field'?2:.5,force:1,damping:.025}}});await ctx.onmessage({data:{type:'signal',wave:Float32Array.from({length:8192},(_,i)=>.5*Math.sin(2*Math.PI*440*i/48000)),fs:48000}});await ctx.onmessage({data:{type:'step'}});let m=emitted.pop();check('Worker '+mode,!!m&&m.mode===mode&&Number.isFinite(m.max)&&(m.out||m.curve).every(Number.isFinite),m?.max);}
console.log(JSON.stringify(results,null,2));

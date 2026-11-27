import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const bytes=fs.readFileSync(new URL('core.wasm',import.meta.url)),source=fs.readFileSync(new URL('dsp.js',import.meta.url),'utf8');
const ctx=vm.createContext({Math,Float64Array,Float32Array,WebAssembly,fetch:async()=>new Response(bytes,{headers:{'Content-Type':'application/wasm'}}),postMessage:()=>{},onmessage:null});vm.runInContext(source,ctx);
const test=code=>vm.runInContext(code,ctx),close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,a+' versus '+b);
close(test("compileGraph([{id:'n1',type:'gain',a:'left',v:2},{id:'n2',type:'sum',a:'n1',b:'right'}],48000).step(.2,.4,2)"),.4,1e-12);
assert.throws(()=>test("compileGraph([{id:'n1',type:'gain',a:'n1'}],48000)"));
close(test("(()=>{let g=compileGraph([{id:'n1',type:'delay',ms:1}],48000),v;for(let i=0;i<=48;i++)v=g.step(i===0?1:0,0,1);return v})()"),1,1e-12);
for(const type of ['lowpass','highpass','bandpass','notch']){let ratio=test("(()=>{let g=compileGraph([{id:'n1',type:'"+type+"',freq:1000,q:.70710678}],48000),a=0,b=0;for(let i=0;i<4800;i++){let s=Math.sin(2*Math.PI*1000*i/48000),v=g.step(s,0,1);if(i>=2400){a+=v*v;b+=s*s;}}return Math.sqrt(a/b)})()");close(ratio,type==='notch'?0:type==='bandpass'?1:Math.SQRT1_2,.001);}
close(test("(()=>{let l=Float64Array.from({length:8192},(_,i)=>Math.sin(2*Math.PI*1000*i/48000)),r=Float64Array.from(l,(_,i)=>Math.sin(2*Math.PI*1000*i/48000+Math.PI/3));return coherentPhase(l,r,48000,1000)})()"),60,.01);
assert.equal(test("burgEnvelope(new Float64Array(8192),48000).length"),0);
console.log('PASS: 9 patch routing, filter, delay, phase and silence checks');

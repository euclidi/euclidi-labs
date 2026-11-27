// Reference experimental solvers. Quantitative models with limited geometries, not a full room solver.
let wasm=null;const ready=WebAssembly.instantiateStreaming(fetch('core.wasm'),{math:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt}}).catch(async()=>WebAssembly.instantiate(await (await fetch('core.wasm')).arrayBuffer(),{math:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt}})).then(r=>wasm=r.instance.exports);
let mode='plate',cfg={},signal=new Float32Array(0),sampleRate=48000,phase=0,clock=0,paused=false,srcIndex=0;
const W=160,H=100,N=W*H,TAU=2*Math.PI;let p=new Float64Array(N),old=new Float64Array(N),next=new Float64Array(N),modes=[],sand=[],last=0;

let inputKind='reference',buffer=new Float32Array(0),startFrame=0,writeFrame=0,readFrame=0,streamGen=null,gaps=0,skipped=0,offline=null,requestKind='step',fieldBudget=100,modalBudget=2400;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function resetInput(){inputKind='stream';signal=new Float32Array(0);buffer=new Float32Array(0);startFrame=writeFrame=readFrame=0;streamGen=null;gaps=skipped=0;offline=null;fieldBudget=100;modalBudget=2400;}
function receiveStream(m){
 if(inputKind==='offline'||!m.wave?.length||!Number.isFinite(m.fs)||m.fs<=0||!Number.isFinite(m.frame))return;
 if(inputKind!=='stream'||m.gen!==streamGen||m.fs!==sampleRate||!buffer.length){resetInput();sampleRate=m.fs;streamGen=m.gen;buffer=new Float32Array(Math.max(2048,Math.ceil(sampleRate*(cfg.runMode==='precision'?10:2))));startFrame=writeFrame=readFrame=m.frame;reset();}
 if(m.frame!==writeFrame){gaps++;skipped+=Math.max(0,m.frame-writeFrame);startFrame=writeFrame=readFrame=m.frame;reset();}
 for(let i=0;i<m.wave.length;i++)buffer[(m.frame+i)%buffer.length]=m.wave[i];
 writeFrame=m.frame+m.wave.length;startFrame=Math.max(startFrame,writeFrame-buffer.length);
 if(readFrame<startFrame){skipped+=Math.ceil(startFrame-readFrame);gaps++;readFrame=startFrame;reset();}
}
function receiveOffline(m){if(!m.wave?.length||!Number.isFinite(m.fs)||m.fs<=0)return;resetInput();inputKind='offline';offline=m.wave;sampleRate=m.fs;writeFrame=offline.length;reset();}
function atFrame(f){if(inputKind==='offline')return offline?.[f]||0;if(inputKind==='stream')return f>=startFrame&&f<writeFrame?buffer[f%buffer.length]:0;return signal.length?signal[((f%signal.length)+signal.length)%signal.length]:0;}
let firKey='',firTable=null;const PHASES=64,TAPS=48,HALF=24;
function getFir(cut){let fc=clamp(cut/sampleRate,.00001,.45),key=sampleRate+':'+fc;if(key===firKey)return firTable;firKey=key;firTable=Array.from({length:PHASES},(_,phase)=>{let f=phase/PHASES,w=new Float64Array(TAPS),sum=0;for(let k=0;k<TAPS;k++){let x=k-HALF+1-f,sinc=Math.abs(x)<1e-12?2*fc:Math.sin(2*Math.PI*fc*x)/(Math.PI*x);w[k]=sinc*(.5+.5*Math.cos(Math.PI*x/HALF));sum+=w[k];}for(let k=0;k<TAPS;k++)w[k]/=sum||1;return w;});return firTable;}
function filteredSample(t,cut){let pos=(inputKind==='reference'?srcIndex:readFrame)+t*sampleRate,base=Math.floor(pos),phase=Math.min(PHASES-1,Math.floor((pos-base)*PHASES)),w=getFir(cut)[phase],v=0;for(let k=0;k<TAPS;k++)v+=atFrame(base+k-HALF+1)*w[k];return v;}
function chooseSteps(dt,kind){if(inputKind==='reference')return requestKind==='single'?1:kind==='field'?50:800;let budget=kind==='field'?fieldBudget:modalBudget;if(cfg.runMode==='precision')budget=Math.min(budget,kind==='field'?32:480);if(requestKind==='single')budget=1;let available=writeFrame-readFrame-(inputKind==='stream'?HALF+1:0);return Math.max(0,Math.min(budget,Math.floor(Math.max(0,available)/(sampleRate*dt))));}
function advanceInput(dt,steps){clock+=dt*steps;if(inputKind==='reference')srcIndex=(srcIndex+steps*dt*sampleRate)%Math.max(1,signal.length);else readFrame+=steps*dt*sampleRate;}
function streamInfo(){return {inputKind,sourceFrame:inputKind==='reference'?srcIndex:readFrame,sourceRate:sampleRate,sourceEnd:writeFrame,skipped,gaps,bufferSeconds:inputKind==='reference'?0:Math.max(0,(writeFrame-readFrame)/sampleRate),modelSeconds:clock};}
function streamLabel(){let a=streamInfo();return inputKind==='reference'?'explicit reference-window replay':inputKind==='offline'?'offline source '+(a.sourceFrame/sampleRate).toFixed(3)+' / '+(writeFrame/sampleRate).toFixed(3)+' s':(cfg.runMode==='precision'?'precision':'live bounded')+' · buffer '+a.bufferSeconds.toFixed(3)+' s · '+skipped+' source frames skipped · '+gaps+' discontinuities';}
function adaptBudget(ms,steps,kind){if(inputKind==='reference'||requestKind==='single'||steps===0||cfg.runMode==='precision')return;let ratio=clamp(27/Math.max(1,ms),.6,1.5);if(kind==='field')fieldBudget=Math.round(clamp(fieldBudget*ratio,8,1024));else modalBudget=Math.round(clamp(modalBudget*ratio,240,6000));}


let shapeCache=[],plateMask=null,tractCache=null;
const rootCache=new Map();
function bessel(m,x,modified=false){let term=1;for(let j=1;j<=m;j++)term*=x/(2*j);let sum=term;for(let j=1;j<=100;j++){term*= (modified?1:-1)*x*x/(4*j*(m+j));sum+=term;if(j>x+4&&Math.abs(term)<1e-15*Math.max(1,Math.abs(sum)))break;}return sum;}
function radialRoots(m,plate,count=3){let key=m+':'+plate+':'+count;if(rootCache.has(key))return rootCache.get(key);const fun=x=>{let j=bessel(m,x);if(!plate)return j;let I=bessel(m,x,true),jp=m===0?-bessel(1,x):(bessel(m-1,x)-bessel(m+1,x))/2,ip=m===0?bessel(1,x,true):(bessel(m-1,x,true)+bessel(m+1,x,true))/2;return jp-j*ip/I;};let roots=[],x0=.5,v0=fun(x0);for(let x=.55;x<=32&&roots.length<count;x+=.05){let v=fun(x);if(v*v0<0){let lo=x0,hi=x,s=v0;for(let k=0;k<45;k++){let mid=(lo+hi)/2;if(fun(mid)*s>0)lo=mid;else hi=mid;}roots.push((lo+hi)/2);}x0=x;v0=v;}rootCache.set(key,roots);return roots;}
function fieldShape(fn){let values=new Float64Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++)values[y*W+x]=fn(x/(W-1),y/(H-1));return values;}
function structuralModes(){
 let L=cfg.length||.5,h=cfg.thickness||.001,E=cfg.young||2e11,rho=cfg.rho||7800,nu=.3,D=E*h*h*h/(12*(1-nu*nu)),depth=cfg.depth||.02,tension=cfg.tension||100,sigma=cfg.surfaceTension??.072,fluid=cfg.fluidDensity||1000,isPlate=mode==='plate'&&cfg.structure!=='membrane',isMembrane=mode==='plate'&&!isPlate,circular=mode==='plate'&&cfg.geometry==='circular',sx=cfg.srcX??.42,sy=cfg.srcY??.4,area=L*L*H/W/((W-1)*(H-1));
 const omega=k=>isPlate?Math.sqrt(D/(rho*h))*k*k:isMembrane?Math.sqrt(tension/(rho*h))*k:Math.sqrt((9.81*k+sigma/fluid*k**3)*Math.tanh(k*depth));
 const add=(k,fn,label)=>{let shape=fieldShape(fn),mass=1;if(mode==='plate'){let sum=0;for(const q of shape)sum+=q*q;mass=Math.max(1e-20,rho*h*area*sum);}modes.push({omega:omega(k),q:0,v:0,c:fn(sx,sy)/mass,label});shapeCache.push(shape);};
 if(circular){
  let R=L*H/W/2;const coord=(x,y)=>{let xx=(x-.5)*L/R,yy=(y-.5)*L*H/W/R;return [Math.hypot(xx,yy),Math.atan2(yy,xx)];};
  plateMask=Uint8Array.from({length:N},(_,i)=>coord((i%W)/(W-1),Math.floor(i/W)/(H-1))[0]<=1?1:0);
  for(let m=0;m<=4;m++)for(let [n,root] of radialRoots(m,isPlate).entries()){
   let q=isPlate?bessel(m,root)/bessel(m,root,true):0,radial=Float64Array.from({length:513},(_,i)=>bessel(m,root*i/512)-q*bessel(m,root*i/512,true));
   const fn=(x,y,odd)=>{let [rr,theta]=coord(x,y);if(rr>=1)return 0;let pos=rr*512,j=Math.floor(pos),v=radial[j]+(pos-j)*(radial[j+1]-radial[j]);return v*(odd?Math.sin(m*theta):Math.cos(m*theta));};
   add(root/R,(x,y)=>fn(x,y,false),'m'+m+' n'+(n+1)+' cos');if(m)add(root/R,(x,y)=>fn(x,y,true),'m'+m+' n'+(n+1)+' sin');
  }
 }else{
  for(let i=1;i<=8;i++)for(let j=1;j<=5;j++){let k=Math.hypot(Math.PI*i/L,Math.PI*j/(L*H/W));add(k,(x,y)=>Math.sin(Math.PI*i*x)*Math.sin(Math.PI*j*y),i+','+j);}
 }

}
function tubeModes(){
 let L=cfg.length||.5,c=331.3+.606*(cfg.temp??20),kind=cfg.resonator||'tube',x=cfg.srcX??.2;
 if(kind==='helmholtz'||kind==='coupled'){
  let V=(cfg.volume||1)*.001,r=cfg.neckRadius||.012,le=(cfg.neckLength||.035)+1.2*r,A=Math.PI*r*r,k=A/le;
  const add=(w,shape,label)=>{modes.push({omega:w,q:0,v:0,c:shape(x),shape,label});};
  if(kind==='helmholtz')add(c*Math.sqrt(k/V),()=>1,'Helmholtz');
  else {let rc=cfg.couplingRadius||.008,lc=(cfg.couplingLength||.045)+1.2*rc,kc=Math.PI*rc*rc/lc;add(c*Math.sqrt(k/V),()=>Math.SQRT1_2,'in phase');add(c*Math.sqrt((k+2*kc)/V),u=>u<.5?Math.SQRT1_2:-Math.SQRT1_2,'out of phase');}
 }else{
  let e=kind==='corrected'?.6*(cfg.neckRadius||.012):0,Le=L+(cfg.closed?1:2)*e;
  for(let i=1;i<=16;i++){let k=(cfg.closed?2*i-1:i)*Math.PI/(Le*(cfg.closed?2:1)),shape=u=>cfg.closed?Math.cos(k*u*L):Math.sin(k*(u*L+e));modes.push({i,k,omega:c*k,q:0,v:0,c:shape(x),shape,label:'n'+i});}
 }
}
function reset(){p.fill(0);old.fill(0);next.fill(0);clock=phase=srcIndex=0;modes=[];sand=[];shapeCache=[];plateMask=null;tractCache=null;
 if(mode==='field'&&wasm)wasm.field_init((cfg.length||2)/W,+!!cfg.barrier,+!!cfg.absorb,+!!cfg.rigid,+!!cfg.water);
 if(mode==='plate'||mode==='ripple'){structuralModes();if(mode==='plate'){let rand=()=>{last=(1664525*last+1013904223)>>>0;return last/4294967296};last=123;while(sand.length<1800){let x=rand(),y=rand();if(!plateMask||plateMask[Math.round(y*(H-1))*W+Math.round(x*(W-1))])sand.push([x,y]);}}}
 if(mode==='tube')tubeModes();
}

function sample(t){if(!signal.length)return 0;let v=(srcIndex+t*sampleRate)%signal.length,i=Math.floor(v),f=v-i;return signal[i]*(1-f)+signal[(i+1)%signal.length]*f;}
function modalStep(dt,f){let damping=cfg.damping||.025;for(let m of modes){let w=m.omega,decay=Math.exp(-damping*w*dt),wd=w*Math.sqrt(1-damping*damping),qeq=m.c*f*(cfg.force||1)/(w*w),q=m.q-qeq,c=Math.cos(wd*dt),s=Math.sin(wd*dt),v=m.v;m.q=qeq+decay*(q*c+(v+damping*w*q)*s/wd);m.v=decay*(v*c-(w*w*q+damping*w*v)*s/wd);}}
function modalField(){let rms=new Float64Array(N),out=new Float32Array(N),dt=1/48000,steps=chooseSteps(dt,'modal'),then=Date.now();for(let t=0;t<steps;t++)modalStep(dt,filteredSample(t*dt,20000));advanceInput(dt,steps);adaptBudget(Date.now()-then,steps,'modal');let max=0;if(mode==='tube'){for(let y=0;y<H;y++)for(let x=0;x<W;x++){let pos=x/(W-1),v=0;for(let m of modes)v+=m.q*m.shape(pos);out[y*W+x]=v;max=Math.max(max,Math.abs(v));}}else{for(let y=0;y<H;y++)for(let x=0;x<W;x++){let v=0,a=0;for(let k=0;k<modes.length;k++){let m=modes[k],shape=shapeCache[k][y*W+x];v+=m.q*shape;a+=(m.q*m.q+(m.v/m.omega)**2)*shape*shape;}let j=y*W+x;out[j]=v;rms[j]=a;max=Math.max(max,Math.abs(v));}if(mode==='plate'){// Deliberately approximate migration down time-averaged modal vibration energy, not discrete grain contact.
 let maxR=Math.max(1e-24,...rms);for(let q of sand){let x=Math.min(W-2,Math.max(1,Math.round(q[0]*(W-1)))),y=Math.min(H-2,Math.max(1,Math.round(q[1]*(H-1)))),j=y*W+x;let nx=clamp(q[0]-.006*Math.min(1,steps/800)*(rms[j+1]-rms[j-1])/maxR,0,1),ny=clamp(q[1]-.006*Math.min(1,steps/800)*(rms[j+W]-rms[j-W])/maxR,0,1);if(!plateMask||plateMask[Math.round(ny*(H-1))*W+Math.round(nx*(W-1))]){q[0]=nx;q[1]=ny;}}}}return {out,max,units:mode==='plate'?'m (simulated displacement)':'relative model amplitude',stats:'Model time '+clock.toFixed(3)+' s · '+modes.length+' modes · '+streamLabel()+' · probe '+out[Math.round((cfg.probeY??.5)*(H-1))*W+Math.round((cfg.probeX??.65)*(W-1))].toExponential(2),sand:mode==='plate'?sand:null,mask:plateMask,geometry:cfg.geometry||'rectangle',resonator:cfg.resonator||'tube',modeFrequencies:modes.map(m=>({label:m.label,hz:m.omega/TAU})).sort((a,b)=>a.hz-b.hz).slice(0,8)};}
function waveField(){let L=cfg.length||2,dx=L/W,dt=wasm.field_dt(),cut=343/(10*dx),steps=chooseSteps(dt,'field'),then=Date.now();let max=0,sx=Math.round((cfg.srcX??25/(W-1))*(W-1)),sy=Math.round((cfg.srcY??50/(H-1))*(H-1));for(let k=0;k<steps;k++){let v=filteredSample(k*dt,Math.min(cut,20000));wasm.field_step(v*(cfg.force||1)*1e5,sx,sy);}advanceInput(dt,steps);adaptBudget(Date.now()-then,steps,'field');let vals=new Float64Array(wasm.memory.buffer,wasm.field_p(),N),out=new Float32Array(N),view=cfg.view||'pressure',u=new Float64Array(wasm.memory.buffer,wasm.field_u(),(W+1)*H),v=new Float64Array(wasm.memory.buffer,wasm.field_v(),W*(H+1));for(let y=0;y<H;y++)for(let x=0;x<W;x++){let i=y*W+x,j=y*(W+1)+x,rho=cfg.water&&x>105?998:1.204,c=cfg.water&&x>105?1480:343,ux=(u[j]+u[j+1])*.5,uy=(v[i]+v[i+W])*.5;let z=view==='velocity'?Math.hypot(ux,uy):view==='energy'?vals[i]**2/(2*rho*c*c)+rho*(ux*ux+uy*uy)/2:view==='gradient'?Math.hypot(vals[Math.min(N-1,i+1)]-vals[Math.max(0,i-1)],vals[Math.min(N-1,i+W)]-vals[Math.max(0,i-W)])/(2*dx*c*c):vals[i];out[i]=z;max=Math.max(max,Math.abs(z));}return {out,max,units:view==='velocity'?'m/s (simulated)':view==='energy'?'J/m³ (simulated)':view==='gradient'?'kg/m⁴ (simulated density gradient)':'Pa (simulated)',stats:'Model time '+clock.toFixed(3)+' s · Δx '+(dx*1000).toFixed(1)+' mm · nominal spatial target ≤ '+Math.round(cut)+' Hz · '+streamLabel()+' · probe '+out[Math.round((cfg.probeY??.5)*(H-1))*W+Math.round((cfg.probeX??.65)*(W-1))].toExponential(2)};}

function tractAreas(){return [1,.8,1.5,cfg.tongue||.8,2,cfg.lip||1];}
function fractionalDelay(delay){let size=Math.ceil(delay)+3,buf=new Float64Array(size),idx=0;return{read(){let at=(idx-delay+size)%size,i=Math.floor(at),f=at-i;return buf[i]*(1-f)+buf[(i+1)%size]*f;},push(x){buf[idx]=x;idx=(idx+1)%size;}};}
function waveguide(seconds=1.2,impulse=false){
 const rate=48000,over=4,ir=rate*over,areas=tractAreas(),N=areas.length,delay=(cfg.length||.17)/N/343*ir,forward=areas.map(()=>fractionalDelay(delay)),back=areas.map(()=>fractionalDelay(delay)),nasal=cfg.nasalArea||0,nd=(cfg.nasalLength||.12)/343*ir,nf=fractionalDelay(nd),nb=fractionalDelay(nd),loss=.995,glot=.8,lip=-.84,nose=-.78,frames=Math.round(rate*seconds),raw=new Float64Array(frames*over),F=new Float64Array(N),B=new Float64Array(N),fi=new Float64Array(N),bi=new Float64Array(N);
 let phase=0,f0=cfg.glottalHz||120;
 for(let t=0;t<raw.length;t++){
  for(let i=0;i<N;i++){F[i]=forward[i].read()*loss;B[i]=back[i].read()*loss;}
  let src=impulse?(t===0?1:0):(phase<.4?Math.sin(Math.PI*phase/.4)**2:0);phase=(phase+f0/ir)%1;fi[0]=src+glot*B[0];bi[N-1]=lip*F[N-1];
  let nasalIn=nb.read()*loss,nasalOut=nf.read()*loss,nfIn=0;
  for(let i=0;i<N-1;i++){let y1=areas[i],y2=areas[i+1],yn=i===2?nasal:0,p=2*(y1*F[i]+y2*B[i+1]+yn*nasalIn)/(y1+y2+yn);bi[i]=p-F[i];fi[i+1]=p-B[i+1];if(i===2&&yn>0)nfIn=p-nasalIn;}
  for(let i=0;i<N;i++){forward[i].push(fi[i]);back[i].push(bi[i]);}nf.push(nfIn);nb.push(nose*nasalOut);raw[t]=(1+lip)*F[N-1]+(nasal>0?(1+nose)*nasalOut*Math.sqrt(nasal/Math.max(.1,areas[N-1])):0);
 }
 let taps=64,w=new Float64Array(taps+1),sum=0;for(let k=0;k<=taps;k++){let x=k-taps/2,v=x===0?.22:Math.sin(.22*Math.PI*x)/(Math.PI*x);w[k]=v*(.5-.5*Math.cos(2*Math.PI*k/taps));sum+=w[k];}
 let out=new Float32Array(frames),last=0,max=0;for(let i=0;i<frames;i++){let z=0;for(let k=0;k<=taps;k++)z+=(raw[i*over-k]||0)*w[k]/sum;if(!impulse){last+=.0065*(z-last);z-=last;}out[i]=z;max=Math.max(max,Math.abs(z));}
 if(!impulse&&max>0)for(let i=0;i<out.length;i++)out[i]*=.5/max;return out;
}
function tract(){
 if(tractCache)return {curve:tractCache.curve.slice(),max:tractCache.max,areas:tractCache.areas,units:'relative response',stats:tractCache.stats};
 const impulse=waveguide(.085,true),curve=new Float32Array(400);let max=0;
 for(let i=0;i<curve.length;i++){let f=20+i/399*4980,w=TAU*f/48000,c=2*Math.cos(w),a=0,b=0;for(let sample of impulse){let z=sample+c*a-b;b=a;a=z;}let val=Math.sqrt(Math.max(0,a*a+b*b-c*a*b));curve[i]=val;max=Math.max(max,val);}
 tractCache={curve,max,areas:tractAreas(),stats:'Six-section fractional-delay waveguide · '+(cfg.nasalArea>0?'nasal branch enabled':'oral tract')+' · 20–5000 Hz · modeled transfer magnitude'};return {curve:curve.slice(),max,areas:tractCache.areas,units:'relative response',stats:tractCache.stats};
}

onmessage=async({data:m})=>{await ready;if(m.type==='config'){mode=m.mode;cfg=m.cfg;if(m.clearInput)resetInput();reset();}else if(m.type==='signal'){inputKind='reference';signal=m.wave;sampleRate=m.fs;srcIndex%=Math.max(1,signal.length);}else if(m.type==='stream')receiveStream(m);else if(m.type==='offline')receiveOffline(m);else if(m.type==='voice-synthesize'){let wave=waveguide(1.2,false);postMessage({type:'voice-audio',wave,fs:48000},[wave.buffer]);}else if(m.type==='clear-input'){resetInput();reset();}else if(m.type==='pause')paused=m.value;else if(m.type==='reset'){if(inputKind==='offline')readFrame=0;else if(inputKind==='stream')readFrame=writeFrame;reset();}else if((m.type==='step'&&!paused)||m.type==='single'){requestKind=m.type;let r=mode==='field'?waveField():mode==='voice'?tract():modalField();postMessage({...r,...streamInfo(),mode,w:W,h:H},r.out?[r.out.buffer]:[r.curve.buffer]);}};

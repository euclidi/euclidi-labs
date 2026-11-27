let wasm,fs=48000,n=8192,win=1,ring=new Float64Array(65536),rightRing=new Float64Array(65536),leftRing=new Float64Array(65536),channels=1,ptr=0,count=0,last=0,prevFrame=null,drops=0,gen=0,filter=0,cut=1000,gain=1,z=0,delay=0,dl=new Float64Array(96000),di=0,cal=null;

// Directed, ordered audio patch graph. Only prior nodes can be used as inputs,
// so zero-delay cycles cannot be created. Input taps are raw left/right/mix.
const LIMIT=12;
function compileGraph(spec,rate){
 if(!Array.isArray(spec)||spec.length>LIMIT||!Number.isFinite(rate)||rate<=0)throw Error('Invalid patch graph');
 const names=new Set(['mix','left','right']), nodes=[];
 for(const raw of spec){
  const {id,type,a='mix',b='mix'}=raw;
  if(!/^n[0-9]+$/.test(id)||names.has(id)||!names.has(a)||!names.has(b))throw Error('Unknown, duplicate or forward patch connection');
  const finite=(v,lo,hi,d)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):d;
  let n={id,type,a,b,v:finite(raw.v,0,10,1),phase:0,z1:0,z2:0};
  if(type==='osc'){n.freq=finite(raw.freq,1,rate*.45,440);n.amp=finite(raw.amp,0,1,.1);}
  else if(type==='delay'){n.delay=new Float64Array(Math.round(finite(raw.ms,0,1000,10)*rate/1000));n.i=0;}
  else if(['lowpass','highpass','bandpass','notch'].includes(type)){
   const w=2*Math.PI*finite(raw.freq,10,rate*.45,1000)/rate,c=Math.cos(w),s=Math.sin(w),alpha=s/(2*finite(raw.q,.1,20,.70710678)),a0=1+alpha;
   let b0,b1,b2;
   if(type==='lowpass'){b0=(1-c)/2;b1=1-c;b2=b0;}
   if(type==='highpass'){b0=(1+c)/2;b1=-(1+c);b2=b0;}
   if(type==='bandpass'){b0=alpha;b1=0;b2=-alpha;}
   if(type==='notch'){b0=1;b1=-2*c;b2=1;}
   Object.assign(n,{b0:b0/a0,b1:b1/a0,b2:b2/a0,a1:-2*c/a0,a2:(1-alpha)/a0});
  }else if(!['gain','sum','difference','invert'].includes(type))throw Error('Unknown patch node');
  names.add(id);nodes.push(n);
 }
 const values=Object.create(null);
 return {nodes,step(l,r,channels){
  values.left=l;values.right=channels===2?r:0;values.mix=channels===2?(l+r)/2:l;
  for(const n of nodes){let x=values[n.a],y=values[n.b],v=x;
   if(n.type==='gain')v=x*n.v;
   else if(n.type==='sum')v=(x+y)*.5;
   else if(n.type==='difference')v=(x-y)*.5;
   else if(n.type==='invert')v=-x;
   else if(n.type==='osc'){v=Math.sin(n.phase)*n.amp;n.phase=(n.phase+2*Math.PI*n.freq/rate)%(2*Math.PI);}
   else if(n.type==='delay'&&n.delay.length){v=n.delay[n.i];n.delay[n.i]=x;n.i=(n.i+1)%n.delay.length;}
   else if(n.b0!==undefined){v=n.b0*x+n.z1;n.z1=n.b1*x-n.a1*v+n.z2;n.z2=n.b2*x-n.a2*v;}
   values[n.id]=v;
  }
  return nodes.length?values[nodes[nodes.length-1].id]:values.mix;
 }};
}
// Burg autoregression on pre-emphasized, low-pass-resampled speech frames.
// Spectral maxima are candidates, not independently validated formant poles.
function burgEnvelope(x,rate){
 const factor=Math.max(1,Math.round(rate/10000)),r=rate/factor,m=16,N=Math.min(400,Math.floor(x.length/factor)-16);
 if(N<64)return [];
 const y=new Float64Array(N),taps=32,weights=[];
 for(let k=-taps;k<=taps;k++){let u=k/factor,v=k===0?.9/factor:Math.sin(.9*Math.PI*u)/(Math.PI*k);weights.push(v*(.5+.5*Math.cos(Math.PI*k/(taps+1))));}
 let ws=weights.reduce((s,v)=>s+v,0),prev=0,energy=0;
 for(let i=0;i<N;i++){let j=x.length-1-taps-(N-1-i)*factor,v=0;for(let k=-taps;k<=taps;k++)v+=(x[j+k]||0)*weights[k+taps]/ws;let z=(v-.97*prev)*(.54-.46*Math.cos(2*Math.PI*i/(N-1)));prev=v;y[i]=z;energy+=z*z;}
 if(energy<1e-9)return [];
 let ef=y.slice(),eb=y.slice(),a=[1];
 for(let k=1;k<=m;k++){let top=0,bot=0;for(let i=k;i<N;i++){top+=ef[i]*eb[i-1];bot+=ef[i]**2+eb[i-1]**2;}if(bot<1e-20)break;
  let refl=Math.max(-.9999,Math.min(.9999,-2*top/bot)),next=[1];for(let j=1;j<k;j++)next[j]=a[j]+refl*a[k-j];next[k]=refl;a=next;
  for(let i=N-1;i>=k;i--){let v=ef[i],w=eb[i-1];ef[i]=v+refl*w;eb[i]=w+refl*v;}
 }
 const response=f=>{let re=1,im=0;for(let j=1;j<a.length;j++){let t=2*Math.PI*f*j/r;re+=a[j]*Math.cos(t);im-=a[j]*Math.sin(t);}return -10*Math.log10(Math.max(1e-20,re*re+im*im));};
 let peaks=[],prev2=-Infinity,prev1=-Infinity;
 for(let f=100;f<Math.min(5000,r/2-20);f+=10){let v=response(f);if(prev1>prev2&&prev1>v){let center=f-10,lo=center,hi=center;while(lo>100&&response(lo)>prev1-3)lo-=10;while(hi<r/2-20&&response(hi)>prev1-3)hi+=10;peaks.push({hz:center,bw:hi-lo});}prev2=prev1;prev1=v;}
 return peaks.slice(0,5);
}
function coherentPhase(l,r,rate,f){
 if(!(f>0)||l.length!==r.length)return null;let lr=0,li=0,rr=0,ri=0;
 for(let i=0;i<l.length;i++){let t=2*Math.PI*f*i/rate,w=.5-.5*Math.cos(2*Math.PI*i/(l.length-1)),c=Math.cos(t)*w,s=Math.sin(t)*w;lr+=l[i]*c;li-=l[i]*s;rr+=r[i]*c;ri-=r[i]*s;}
 if(Math.hypot(lr,li)*Math.hypot(rr,ri)<1e-10)return null;
 let phase=(Math.atan2(ri,rr)-Math.atan2(li,lr))*180/Math.PI;
 return ((phase+540)%360)-180;
}

let transferEnabled=false,distortionHz=0;
function complexFFT(re,im){let n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;while(j&b){j^=b;b>>=1;}j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let m=2;m<=n;m*=2){let a=-2*Math.PI/m,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=m){let r=1,v=0;for(let j=0;j<m/2;j++){let p=i+j,q=p+m/2,x=re[q]*r-im[q]*v,y=re[q]*v+im[q]*r;re[q]=re[p]-x;im[q]=im[p]-y;re[p]+=x;im[p]+=y;let z=r*wr-v*wi;v=r*wi+v*wr;r=z;}}}}
function transferEstimate(l,r,rate){let N=Math.min(4096,2**Math.floor(Math.log2(l.length/4)));if(N<128)return null;let n=N/2+1,xx=new Float64Array(n),yy=new Float64Array(n),cr=new Float64Array(n),ci=new Float64Array(n),re1=new Float64Array(N),im1=new Float64Array(N),re2=new Float64Array(N),im2=new Float64Array(N),segments=0;
 for(let offset=0;offset+N<=l.length;offset+=N/2){for(let j=0;j<N;j++){let w=.5-.5*Math.cos(2*Math.PI*j/(N-1));re1[j]=l[offset+j]*w;re2[j]=r[offset+j]*w;im1[j]=im2[j]=0;}complexFFT(re1,im1);complexFFT(re2,im2);segments++;for(let k=0;k<n;k++){xx[k]+=re1[k]**2+im1[k]**2;yy[k]+=re2[k]**2+im2[k]**2;cr[k]+=re2[k]*re1[k]+im2[k]*im1[k];ci[k]+=im2[k]*re1[k]-re2[k]*im1[k];}}
 const magnitude=new Float32Array(n),phase=new Float32Array(n),coherence=new Float32Array(n),delay=new Float32Array(n);let max=Math.max(...xx),previous=null;
 for(let k=0;k<n;k++){if(xx[k]<Math.max(1e-12,max*1e-7)||yy[k]<1e-12){magnitude[k]=phase[k]=coherence[k]=delay[k]=NaN;previous=null;continue;}let a=Math.atan2(ci[k],cr[k]);if(previous!==null)a+=2*Math.PI*Math.round((previous-a)/(2*Math.PI));magnitude[k]=20*Math.log10(Math.max(1e-20,Math.hypot(cr[k],ci[k])/xx[k]));phase[k]=a*180/Math.PI;coherence[k]=Math.min(1,(cr[k]**2+ci[k]**2)/(xx[k]*yy[k]));delay[k]=previous===null?NaN:-(a-previous)/(2*Math.PI*rate/N)*1000;previous=a;}
 return{magnitude,phase,coherence,delay,df:rate/N,segments};
}
function distortionEstimate(x,rate,f){if(!(f>0)||f*x.length/rate<8||f>=rate/4)return null;let n=x.length,S=0,C=0,SS=0,CC=0,SC=0,Y=0,YS=0,YC=0;for(let i=0;i<n;i++){let t=2*Math.PI*f*i/rate,s=Math.sin(t),c=Math.cos(t),v=x[i];S+=s;C+=c;SS+=s*s;CC+=c*c;SC+=s*c;Y+=v;YS+=v*s;YC+=v*c;}
 let A=[[n,S,C,Y],[S,SS,SC,YS],[C,SC,CC,YC]];for(let j=0;j<3;j++){let p=j;for(let k=j+1;k<3;k++)if(Math.abs(A[k][j])>Math.abs(A[p][j]))p=k;[A[p],A[j]]=[A[j],A[p]];let v=A[j][j];if(Math.abs(v)<1e-12)return null;for(let k=j;k<4;k++)A[j][k]/=v;for(let i=0;i<3;i++)if(i!==j){let q=A[i][j];for(let k=j;k<4;k++)A[i][k]-=q*A[j][k];}}
 let [dc,b,c]=A.map(r=>r[3]),amp=Math.hypot(b,c);if(amp<1e-5)return null;let residual=new Float64Array(n),e=0;for(let i=0;i<n;i++){let t=2*Math.PI*f*i/rate,z=x[i]-dc-b*Math.sin(t)-c*Math.cos(t);residual[i]=z;e+=z*z;}let harm=0,order=Math.min(10,Math.floor(rate*.45/f));for(let k=2;k<=order;k++){let re=0,im=0,ws=0;for(let i=0;i<n;i++){let w=.5-.5*Math.cos(2*Math.PI*i/(n-1)),t=2*Math.PI*k*f*i/rate;re+=residual[i]*w*Math.cos(t);im-=residual[i]*w*Math.sin(t);ws+=w;}harm+=(2*Math.hypot(re,im)/ws)**2;}return{thd:Math.sqrt(harm)/amp,thdn:Math.sqrt(e/n)/(amp/Math.SQRT2),fundamental:amp,order,f};
}


// Integrated window-normalized spectral power, not a sum of dB values.
// Each bin's power is apportioned by overlap with the frequency interval.
const listenEdges=[20,60,250,500,2000,4000,8000,20000];
function listeningBands(power,rate,size){
 const df=rate/size,nyq=rate/2,values=new Float64Array(7);
 let total=0;
 for(let i=1;i<power.length;i++){
  const lo=Math.max(0,(i-.5)*df),hi=Math.min(nyq,(i+.5)*df),width=hi-lo;
  if(width<=0)continue;
  // One-sided periodogram samples, including the Nyquist bin, have energy df*PSD.
  const energy=power[i]*df;
  for(let b=0;b<7;b++){let overlap=Math.max(0,Math.min(hi,listenEdges[b+1])-Math.max(lo,listenEdges[b]));if(overlap){let v=energy*overlap/width;values[b]+=v;total+=v;}}
 }
 return {energy:Array.from(values),total,available:listenEdges.slice(0,-1).map((lo,i)=>Math.max(0,Math.min(nyq,listenEdges[i+1])-lo)/(listenEdges[i+1]-lo))};
}

let graphSpec=[],patch=null,modelStreaming=false,channelMode='stereo';

const db=x=>x>0?20*Math.log10(x):-Infinity;
const ready=WebAssembly.instantiateStreaming(fetch('core.wasm'),{math:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt}}).catch(async()=>WebAssembly.instantiate(await (await fetch('core.wasm')).arrayBuffer(),{math:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt}})).then(r=>{wasm=r.instance.exports;postMessage({type:'ready'});}).catch(e=>postMessage({type:'error',message:String(e)}));
function lpc(x,rate){ // autocorrelation LPC, not approved Burg; experimental spectral envelope only
 const factor=Math.max(1,Math.round(rate/10000)),r=rate/factor,m=18,sz=Math.min(400,Math.floor(x.length/factor)-1),y=new Float64Array(sz),ac=new Float64Array(m+1);if(sz<60)return [];
 for(let i=0;i<sz;i++){let j=x.length-1-(sz-1-i)*factor;y[i]=(x[j]-.97*x[j-factor])*(.54-.46*Math.cos(2*Math.PI*i/(sz-1)));}
 for(let k=0;k<=m;k++)for(let i=k;i<sz;i++)ac[k]+=y[i]*y[i-k];if(ac[0]<1e-10)return [];
 let a=[1],e=ac[0];for(let k=1;k<=m;k++){let v=ac[k];for(let j=1;j<k;j++)v+=a[j]*ac[k-j];let q=-v/e;if(Math.abs(q)>=1)return [];let b=[1];for(let j=1;j<k;j++)b[j]=a[j]+q*a[k-j];b[k]=q;a=b;e*=1-q*q;}
 let peaks=[],prev=-Infinity,prev2=-Infinity;for(let f=100;f<Math.min(5000,r/2);f+=10){let re=1,im=0;for(let j=1;j<a.length;j++){let t=2*Math.PI*f*j/r;re+=a[j]*Math.cos(t);im-=a[j]*Math.sin(t);}let p=-Math.log(re*re+im*im);if(prev>prev2&&prev>p)peaks.push(f-10);prev2=prev;prev=p;}return peaks.slice(0,5);
}
onmessage=async({data:m})=>{await ready;if(!wasm)return;if(m.type==='advanced-settings'){transferEnabled=!!m.transfer;distortionHz=Number(m.distortionHz)||0;return;}if(m.type==='model-route'){modelStreaming=!!m.active;return;}if(m.type==='graph'){try{const candidate=compileGraph(m.nodes,fs);graphSpec=m.nodes;patch=candidate.nodes.length?candidate:null;postMessage({type:'graph-ok'});}catch(e){postMessage({type:'graph-error',message:String(e.message)});}return;}if(m.type==='reset'){fs=m.fs;gen=m.gen;patch=graphSpec.length?compileGraph(graphSpec,fs):null;ptr=count=last=drops=di=0;prevFrame=null;z=0;ring.fill(0);rightRing.fill(0);leftRing.fill(0);dl.fill(0);channels=1;return;}if(m.type==='settings'){n=m.n;win=m.win;channelMode=['stereo','left','right','mix'].includes(m.channelMode)?m.channelMode:'stereo';filter=m.filter;cut=m.cut;gain=m.gain;delay=m.delay;cal=m.cal;return;}if(m.type!=='samples'||m.gen!==gen)return;
 if(prevFrame!==null&&m.frame!==prevFrame)drops+=Math.max(0,m.frame-prevFrame);prevFrame=m.frame+m.samples.length;
 let alpha=1-Math.exp(-2*Math.PI*Math.min(cut,fs*.45)/fs),ds=Math.min(dl.length-1,Math.round(delay*fs/1000));channels=m.channels||1;let modelBlock=modelStreaming?new Float32Array(m.samples.length):null;for(let i=0;i<m.samples.length;i++){let l=m.samples[i],r=m.right?.[i]??0;leftRing[ptr]=l;rightRing[ptr]=r;let v=channels===2?(channelMode==='left'?l:channelMode==='right'?r:channelMode==='stereo'&&!patch&&filter===0&&gain===1&&delay===0?l:(l+r)*.5):l;z+=alpha*(v-z);v=(filter===1?z:filter===2?v-z:v)*gain;dl[di]=v;v=dl[(di-ds+dl.length)%dl.length];di=(di+1)%dl.length;if(patch)v=patch.step(l,r,channels);ring[ptr]=v;if(modelBlock)modelBlock[i]=v;ptr=(ptr+1)%ring.length;count++;}if(modelBlock)postMessage({type:'model-block',gen,fs,frame:m.frame,wave:modelBlock},[modelBlock.buffer]);
 if(count<n||count-last<fs/20)return;last=count;
 let x=new Float64Array(wasm.memory.buffer,wasm.input(),n);for(let i=0;i<n;i++)x[i]=ring[(ptr-n+i+ring.length)%ring.length];wasm.analyze(n,win);let s=Array.from(new Float64Array(wasm.memory.buffer,wasm.metrics(),8));let spectrum=new Float32Array(new Float64Array(wasm.memory.buffer,wasm.output(),n/2+1));let f0=wasm.pitch(Math.min(n,4096),fs,50,2000),conf=new Float64Array(wasm.memory.buffer,wasm.metrics(),8)[7],formCandidates=f0?burgEnvelope(x,fs):[],form=formCandidates.map(p=>p.hz);
 let wave=Float32Array.from(x),power=new Float32Array(spectrum.length),A=0,C=0,corr=null,lissajous=null,phaseDeg=null,transfer=null,distortion=distortionHz?distortionEstimate(x,fs,distortionHz):null;let stereoPower=channels===2&&channelMode==='stereo'&&!patch&&filter===0&&gain===1&&delay===0,channelLevels=null,analysisBasis=stereoPower?'stereo-power':patch?'routed':channelMode==='stereo'?'mix':channelMode;if(stereoPower){let ls=s.slice();for(let i=0;i<n;i++)x[i]=rightRing[(ptr-n+i+ring.length)%ring.length];wasm.analyze(n,win);let rs=Array.from(new Float64Array(wasm.memory.buffer,wasm.metrics(),8)),rightSpectrum=new Float64Array(wasm.memory.buffer,wasm.output(),n/2+1);for(let i=0;i<spectrum.length;i++)spectrum[i]=Math.hypot(spectrum[i],rightSpectrum[i])*Math.SQRT1_2;s[0]=Math.hypot(ls[0],rs[0])*Math.SQRT1_2;s[1]=Math.max(ls[1],rs[1]);s[6]=ls[6]+rs[6];channelLevels={left:db(ls[0]),right:db(rs[0]),peakLeft:db(ls[1]),peakRight:db(rs[1])};}let k=1;for(let i=2;i<spectrum.length;i++)if(spectrum[i]>spectrum[k])k=i;let qa=Math.log(Math.max(spectrum[k-1],1e-30)),qb=Math.log(Math.max(spectrum[k],1e-30)),qc=Math.log(Math.max(spectrum[k+1]||0,1e-30)),qd=qa-2*qb+qc;let dom=s[0]>1e-5&&spectrum[k]>1e-7?(k+(k<spectrum.length-1&&qd!==0?Math.max(-.5,Math.min(.5,.5*(qa-qc)/qd)):0))*fs/n:0;for(let i=0;i<spectrum.length;i++){let f=i*fs/n,f2=f*f,wgt=(i===0||i===n/2)?1:.5,P=spectrum[i]**2*wgt*s[5]**2/(n*s[4]);power[i]=P/(fs/n);if(i){let hi=12194**2,lo=20.6**2,a=hi*f2*f2/((f2+lo)*Math.sqrt((f2+107.7**2)*(f2+737.9**2))*(f2+hi))*10**(.1),c=hi*f2/((f2+lo)*(f2+hi))*10**(.003);A+=P*a*a;C+=P*c*c;}}if(channels===2){let ll=0,rr=0,lr=0;lissajous=new Float32Array(1024);for(let i=0;i<n;i++){let k=(ptr-n+i+ring.length)%ring.length,l=leftRing[k],r=rightRing[k];ll+=l*l;rr+=r*r;lr+=l*r;if(i%Math.ceil(n/512)===0){let j=Math.floor(i/Math.ceil(n/512))*2;lissajous[j]=l;lissajous[j+1]=r;}}corr=ll*rr>1e-20?lr/Math.sqrt(ll*rr):null;let l=Float64Array.from({length:n},(_,i)=>leftRing[(ptr-n+i+ring.length)%ring.length]),r=Float64Array.from({length:n},(_,i)=>rightRing[(ptr-n+i+ring.length)%ring.length]);phaseDeg=coherentPhase(l,r,fs,dom);if(transferEnabled)transfer=transferEstimate(l,r,fs);}postMessage({type:'analysis',gen,fs,n,frame:m.frame+m.samples.length-1,spectrum,wave,power,bands:listeningBands(power,fs,n),weightedA:db(Math.sqrt(A)),weightedC:db(Math.sqrt(C)),channels,analysisBasis,channelLevels,corr,phaseDeg,transfer,distortion,formCandidates,lissajous,rms:s[0],peak:s[1],dc:s[2],clipped:s[6],dom,f0,conf,form,drops,dbfs:db(s[0]),spl:cal===null?null:db(s[0])+cal},[spectrum.buffer,wave.buffer,power.buffer,...(lissajous?[lissajous.buffer]:[]),...(transfer?[transfer.magnitude.buffer,transfer.phase.buffer,transfer.coherence.buffer,transfer.delay.buffer]:[])]);
};

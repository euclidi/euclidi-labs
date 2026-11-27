import * as THREE from './vendor/three.module.min.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Apparatus {
 constructor(host){
  this.host=host;this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0x151719);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.replaceChildren(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Interactive three-dimensional apparatus representation');
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,1,.01,40);this.az=.56;this.el=.56;this.distance=4.7;this.target=new THREE.Vector3(0,.05,0);
  this.scene.add(new THREE.HemisphereLight(0xe4ebf4,0x514a41,2.1));
  let key=new THREE.DirectionalLight(0xfff4e1,3.4);key.position.set(-3,5,2);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.bias=-.001;this.scene.add(key);let rim=new THREE.DirectionalLight(0xc7dcff,1.4);rim.position.set(3,2,-3);this.scene.add(rim);
  this.root=new THREE.Group();this.scene.add(this.root);this.mode='';this.field=null;this.particles=null;this.last=null;
  this.materials={metal:new THREE.MeshStandardMaterial({color:0x9c9d99,metalness:.65,roughness:.37}),dark:new THREE.MeshStandardMaterial({color:0x26282a,metalness:.42,roughness:.52}),base:new THREE.MeshStandardMaterial({color:0x393a3a,metalness:.22,roughness:.71}),brass:new THREE.MeshStandardMaterial({color:0xa28b60,metalness:.6,roughness:.38}),rubber:new THREE.MeshStandardMaterial({color:0x151515,roughness:.9}),glass:new THREE.MeshStandardMaterial({color:0xb8d5e1,metalness:.05,roughness:.17,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}),seal:new THREE.MeshStandardMaterial({color:0x727678,metalness:.65,roughness:.4})};
  const canvas=this.renderer.domElement;canvas.style.touchAction='none';let drag=null;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointermove',e=>{if(!drag)return;this.az-=(e.clientX-drag.x)*.008;this.el=clamp(this.el+(e.clientY-drag.y)*.008,.08,1.45);drag={x:e.clientX,y:e.clientY};this.render();});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>drag=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.distance=clamp(this.distance*Math.exp(e.deltaY*.001),2.3,9);this.render();},{passive:false});
  this.observer=new ResizeObserver(()=>this.render());this.observer.observe(host);
 }
 mesh(g,mat,x=0,y=0,z=0,parent=this.root){let m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 box(w,h,d,x,y,z,mat=this.materials.dark){return this.mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
 cyl(r,h,x,y,z,mat=this.materials.metal,segments=48){return this.mesh(new THREE.CylinderGeometry(r,r,h,segments),mat,x,y,z);}
 ring(r,t,x,y,z,axis='y',mat=this.materials.metal){let a=this.mesh(new THREE.TorusGeometry(r,t,12,64),mat,x,y,z);if(axis==='y')a.rotation.x=Math.PI/2;if(axis==='x')a.rotation.y=Math.PI/2;return a;}
 screw(x,y,z){let s=this.cyl(.022,.014,x,y,z,this.materials.seal,12);this.box(.027,.002,.004,x,y+.008,z,this.materials.dark);return s;}
 clear(){this.root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&!Object.values(this.materials).includes(o.material))o.material.dispose();});this.root.clear();this.field=null;this.particles=null;this.wall=[];}
 base(w,d){this.box(w,.13,d,0,-.22,0,this.materials.base);this.box(w*.98,.012,d*.98,0,-.148,0,this.materials.dark);for(let x of [-w*.39,w*.39])for(let z of [-d*.38,d*.38])this.box(.25,.07,.24,x,-.32,z,this.materials.rubber);for(let x of [-w*.46,w*.46])for(let z of [-d*.44,d*.44])this.screw(x,-.138,z);}
 fieldMesh(w,h,width,depth,y){let g=new THREE.PlaneGeometry(width,depth,w-1,h-1);g.rotateX(-Math.PI/2);g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(w*h*3),3));let m=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.48,metalness:.15});this.field=this.mesh(g,m,0,y,0);this.field.frustumCulled=false;this.field.receiveShadow=true;}
 rebuild(mode,result,cfg){
  this.clear();this.mode=mode;this.shapeKey=[mode,result?.w,result?.h,!!cfg.closed,!!cfg.barrier,cfg.srcX,cfg.srcY,cfg.length].join(':');const M=this.materials,W=2.35,D=1.47;
  if(mode==='plate'||mode==='ripple'){
   this.base(2.85,1.99);
   for(let x of [-W/2,W/2])this.box(.085,.15,D+.09,x,-.06,0,M.metal);
   for(let z of [-D/2,D/2])this.box(W+.08,.15,.085,0,-.06,z,M.metal);
   for(let x of [-W/2,W/2])for(let z of [-D/2,D/2]){this.box(.18,.12,.18,x,-.07,z,M.dark);this.screw(x,.005,z);}
   if(mode==='plate'){this.cyl(.18,.09,-W*.08,-.1,-D*.1,M.brass);this.cyl(.075,.07,-W*.08,-.035,-D*.1,M.metal);}
   else {for(let x of [-W/2,W/2])this.box(.035,.17,D,x,.06,0,M.glass);for(let z of [-D/2,D/2])this.box(W,.17,.035,0,.06,z,M.glass);}
   this.fieldMesh(result.w,result.h,W,D,.015);
   if(mode==='plate'){let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((result.sand?.length||0)*3),3));this.particles=new THREE.Points(g,new THREE.PointsMaterial({color:0xd9bd85,size:.018,sizeAttenuation:true}));this.root.add(this.particles);}
  }else if(mode==='field'){
   this.base(2.85,1.99);this.fieldMesh(result.w,result.h,W,D,.015);
   if(cfg.barrier){let x=-W/2+85/(result.w-1)*W;for(let [a,b] of [[0,40],[60,result.h-1]]){let z=-D/2+(a+b)*.5/(result.h-1)*D;this.box(.035,.15,(b-a)/(result.h-1)*D,x,.09,z,M.metal);}}
   let sx=-W/2+(cfg.srcX??25/(result.w-1))*W,sz=-D/2+(cfg.srcY??50/(result.h-1))*D;this.cyl(.055,.075,sx,.065,sz,M.brass);this.ring(.052,.008,sx,.11,sz);
  }else if(mode==='tube'){
   this.base(3.05,.94);let r=.26,L=2.55;
   let tube=this.mesh(new THREE.CylinderGeometry(r,r,L,64,1,true),M.glass,0,.32,0);tube.rotation.z=Math.PI/2;
   this.fieldMesh(result.w,result.h,L,.36,.32);
   for(let x of [-L/2,L/2]){this.ring(r,.026,x,.32,0,'x');this.ring(r*.9,.008,x,.32,0,'x',M.dark);}
   if(cfg.closed){let cap=this.cyl(r,.035,-L/2,.32,0,M.metal);cap.rotation.z=Math.PI/2;}
   for(let x of [-.92,.92]){this.ring(r+.03,.028,x,.32,0,'x',M.dark);this.box(.15,.22,.23,x,.02,0,M.metal);for(let z of [-.15,.15])this.screw(x,-.128,z);}
  }else if(mode==='voice'){
   this.base(2.8,.98);this.makeTract(result.areas||[1,.8,1.5,.8,2,1],cfg.length||.17);
  }
  this.render();
 }
 makeTract(areas,length){let M=this.materials,total=2.25,scale=total/length,seg=total/areas.length,prev=null;for(let i=0;i<areas.length;i++){let r=Math.sqrt(areas[i]*1e-4/Math.PI)*scale,x=-total/2+(i+.5)*seg;let c=this.mesh(new THREE.CylinderGeometry(r,r,seg-.006,48,1,true),M.glass,x,.2,0);c.rotation.z=Math.PI/2;this.ring(r,.014,x-seg/2,.2,0,'x',M.metal);if(i===areas.length-1)this.ring(r,.014,x+seg/2,.2,0,'x',M.metal);if(prev!==null){let a=this.mesh(new THREE.RingGeometry(Math.min(r,prev),Math.max(r,prev),48),M.dark,x-seg/2,.2,0);a.rotation.y=Math.PI/2;}prev=r;}}
 update(mode,result,cfg,scale){
  if(!result)return;let key=[mode,result.w,result.h,!!cfg.closed,!!cfg.barrier,cfg.srcX,cfg.srcY,cfg.length].join(':');
  if(key!==this.shapeKey||(mode==='voice'&&JSON.stringify(result.areas)!==this.areasKey)){this.rebuild(mode,result,cfg);this.areasKey=JSON.stringify(result.areas);}
  if(result!==this.last||scale!==this.lastScale){
   if(this.field&&result.out){let g=this.field.geometry,p=g.attributes.position,c=g.attributes.color,displace=['plate','ripple'].includes(mode),max=Math.max(1e-14,scale||result.max),lo=new THREE.Color(0x2c6fa7),zero=new THREE.Color(0x404348),hi=new THREE.Color(0xc88744),color=new THREE.Color();for(let i=0;i<result.out.length;i++){let v=clamp(result.out[i]/max,-1,1);p.setY(i,displace?v*.075:0);color.copy(zero).lerp(v<0?lo:hi,Math.abs(v));c.setXYZ(i,color.r,color.g,color.b);}p.needsUpdate=true;c.needsUpdate=true;if(displace)g.computeVertexNormals();if(this.particles&&result.sand){let a=this.particles.geometry.attributes.position;for(let i=0;i<result.sand.length;i++){let s=result.sand[i],x=Math.round(s[0]*(result.w-1)),y=Math.round(s[1]*(result.h-1)),v=clamp(result.out[y*result.w+x]/max,-1,1);a.setXYZ(i,(s[0]-.5)*2.35,.025+v*.075,(s[1]-.5)*1.47);}a.needsUpdate=true;}}
   this.last=result;this.lastScale=scale;
  }this.render();
 }
 render(){if(!this.host.clientWidth||!this.host.clientHeight)return;let w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.camera.position.set(this.distance*Math.cos(this.el)*Math.sin(this.az),this.distance*Math.sin(this.el),this.distance*Math.cos(this.el)*Math.cos(this.az));this.camera.lookAt(this.target);this.renderer.render(this.scene,this.camera);}
}

/* Euclidi player reporting v1 — local drafts, opt-in diagnostics, authenticated GitHub Issues. */
(()=>{
'use strict';
const config=document.currentScript?.dataset;
const repo=config?.repo;
if(!['euclidi/euclidi-games','euclidi/euclidi-labs'].includes(repo))return;
const project=config.project||'unknown';
const version=1, maxLogs=24, logs=[];
const issueBase='https://github.com/'+repo+'/issues/new';
const localKey='euclidi.bug-report.v1:'+repo+':'+project;
const clean=value=>String(value??'').slice(0,8000)
 .replace(/https?:\/\/[^\s<>"')]+/gi,'[URL omitted]')
 .replace(/(?:file:\/\/\/|[A-Z]:\\)[^\s<>"']+/gi,'[local path omitted]')
 .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[IP omitted]')
 .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email omitted]')
 .replace(/\b(?:bearer\s+\S+|(?:token|password|secret|api[_-]?key|authorization)\s*[:=]\s*["']?\S+)/gi,'[credential omitted]')
 .replace(/[A-Za-z0-9+/_=-]{60,}/g,'[long value omitted]')
 .replace(/[\r\n\t]+/g,' ').slice(0,260);
function record(kind,message){
 try{
  const value=clean(message);if(!value)return;
  const prev=logs[logs.length-1];
  if(prev&&prev.kind===kind&&prev.message===value){prev.count++;return;}
  logs.push({kind,message:value,count:1});
  if(logs.length>maxLogs)logs.shift();
 }catch{}
}
window.addEventListener('error',e=>{
 if(e instanceof ErrorEvent)record('error',e.message+' (line '+(e.lineno||0)+')');
 else if(e.target!==window)record('resource','Failed to load '+String(e.target?.tagName||'resource'));
},true);
window.addEventListener('unhandledrejection',e=>{
 const r=e.reason;record('rejection',typeof r==='string'?r:r instanceof Error?r.name+': '+r.message:'Non-string promise rejection');
});
const originalError=console.error;
console.error=function(...args){
 try{record('console.error',args.map(a=>typeof a==='string'?a:a instanceof Error?a.name+': '+a.message:'[non-text argument omitted]').join(' '));}catch{}
 return Reflect.apply(originalError,this,args);
};
function readDraft(){try{return JSON.parse(localStorage.getItem(localKey)||'{}')||{};}catch{return {};}}
function saveDraft(value){try{localStorage.setItem(localKey,JSON.stringify(value));return true;}catch{return false;}}
function safeVersion(){const v=new URL(location.href).searchParams.get('v');return v&&/^[\w.-]{1,24}$/.test(v)?v:'not specified';}
function makeBody(details,include){
 const out=['## Player report','',details.trim(),'','## Environment','- Project: '+project,'- Catalog: '+repo,'- Release parameter: '+safeVersion(),'- Reported (UTC): '+new Date().toISOString(),'- Viewport: '+innerWidth+' × '+innerHeight+' CSS px','- Reporter schema: '+version];
 if(include){out.push('','## Optional browser diagnostics','Review and redact before publishing. These are bounded messages, not a full log.','',...logs.map(l=>'- '+l.kind+': '+l.message+(l.count>1?' (×'+l.count+')':'')));if(!logs.length)out.push('No captured errors in this session.');}
 return out.join('\n');
}
let dialog;
function build(){
 if(dialog)return dialog;
 if(typeof HTMLDialogElement==='undefined'||typeof HTMLDialogElement.prototype.showModal!=='function')return null;
 dialog=document.createElement('dialog');dialog.id='euclidi-report-dialog';dialog.setAttribute('aria-labelledby','euclidi-report-title');
 dialog.innerHTML='<form id="euclidi-report-form"><div class="er-head"><h2 id="euclidi-report-title">Report a bug</h2><button type="button" id="er-close" aria-label="Close bug report">Close</button></div><p class="er-note" id="er-project"></p><label>Summary <input id="er-summary" maxlength="100" required placeholder="Short description of the problem"></label><label>What happened? <textarea id="er-details" rows="5" maxlength="1200" required placeholder="What were you doing? What did you expect? What happened instead?"></textarea></label><label class="er-check"><input type="checkbox" id="er-include"> Include recent browser error messages (optional)</label><p class="er-note">Reports are public GitHub issues. Do not include passwords, personal information or private audio/device details. Diagnostics are best-effort redacted; review them below.</p><label>Review exactly what will be posted <textarea id="er-preview" rows="6" readonly></textarea></label><div class="er-actions"><button type="button" id="er-save">Save local draft</button><button type="button" id="er-copy">Copy report</button><button type="button" id="er-export">Export JSON</button><a id="er-open" href="#" target="_blank" rel="noopener noreferrer">Continue to GitHub</a></div><p id="er-status" role="status">Nothing is sent until you create the issue on GitHub.</p></form>';
 document.body.append(dialog);
 const q=id=>dialog.querySelector('#'+id);
 q('er-project').textContent=project+' / '+repo;
 const form=q('euclidi-report-form'),summary=q('er-summary'),details=q('er-details'),include=q('er-include'),preview=q('er-preview'),status=q('er-status'),open=q('er-open');
 const saved=readDraft();summary.value=typeof saved.summary==='string'?saved.summary.slice(0,100):'';details.value=typeof saved.details==='string'?saved.details.slice(0,1200):'';
 include.checked=false; // Never carry diagnostic consent to another session.
 let fullBody='';
 function update(){
  fullBody=makeBody(details.value,include.checked);preview.value=fullBody;
  const title='[Player bug] ['+project+'] '+summary.value.trim();
  const url=issueBase+'?'+new URLSearchParams({title,body:fullBody}).toString();
  if(url.length>7500){open.href=issueBase+'?'+new URLSearchParams({title}).toString();open.dataset.copyRequired='true';status.textContent='Report is too long for a prefilled URL. Copy the complete report, then paste it into the issue body.';}
  else{open.href=url;delete open.dataset.copyRequired;status.textContent='Nothing is sent until you create the issue on GitHub.';}
 }
 function persist(){return saveDraft({summary:summary.value,details:details.value});}
 form.addEventListener('submit',e=>e.preventDefault());
 form.addEventListener('input',update);
 q('er-close').addEventListener('click',()=>dialog.close());
 q('er-save').addEventListener('click',()=>{status.textContent=persist()?'Draft saved on this device. Not submitted.':'Local storage unavailable. Copy or export the report instead.';});
 q('er-copy').addEventListener('click',async()=>{
  update();
  try{await navigator.clipboard.writeText(fullBody);status.textContent='Report copied. Not submitted.';}
  catch{preview.focus();preview.select();status.textContent='Select and copy the report manually.';}
 });
 q('er-export').addEventListener('click',()=>{
  update();
  const data={schema:version,repository:repo,project,title:'[Player bug] ['+project+'] '+summary.value.trim(),body:fullBody,diagnosticsIncluded:include.checked};
  const href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=href;a.download='euclidi-bug-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  status.textContent='JSON export requested. Not submitted.';
 });
 open.addEventListener('click',e=>{
  update();
  if(!form.reportValidity()||!summary.value.trim()||!details.value.trim()){e.preventDefault();status.textContent='Enter a summary and describe the problem.';return;}
  persist();
  status.textContent=open.dataset.copyRequired?'Paste the copied report into GitHub, review and select Create issue.':'Review the prefilled public report on GitHub and select Create issue. A draft is not a submitted report.';
 });
 for(const type of ['keydown','keyup','keypress','pointerdown','pointerup','click','wheel','touchstart','touchend'])dialog.addEventListener(type,e=>e.stopPropagation());
 dialog.addEventListener('close',()=>{document.querySelector('[data-euclidi-bug-report]')?.focus();});
 dialog.euclidiUpdate=update;update();return dialog;
}
function connect(){
 for(const link of document.querySelectorAll('[data-euclidi-bug-report]')){
  link.addEventListener('click',e=>{
   if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
   const d=build();if(!d)return; // Ordinary GitHub link remains the no-JS/unsupported fallback.
   e.preventDefault();d.euclidiUpdate();if(!d.open)d.showModal();d.querySelector('#er-summary').focus();
  });
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});else connect();
})();

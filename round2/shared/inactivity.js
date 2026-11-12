import {goToRound} from './navigation.js';
export const INACTIVITY_TIMEOUT_MS=180000;
const INSTALLATION=Symbol.for('twentys.inactivity');
// Only real input extends the exhibition session; animation and focus do not.
export function installInactivityReset({targetWindow=window,onTimeout=()=>goToRound(1),timeoutMs=INACTIVITY_TIMEOUT_MS}={}){
 if(targetWindow[INSTALLATION])return targetWindow[INSTALLATION];
 const now=()=>targetWindow.Date.now();
 let lastActivity=now(),timer=0,active=true;
 const removers=[];
 const listen=(target,type,handler)=>{target.addEventListener(type,handler,{capture:true,passive:true});removers.push(()=>target.removeEventListener(type,handler,true));};
 function dispose(){
  if(!active)return;active=false;targetWindow.clearTimeout(timer);
  removers.splice(0).forEach(remove=>remove());
  delete targetWindow[INSTALLATION];
 }
 function check(){
  if(!active)return;
  targetWindow.clearTimeout(timer);
  const remaining=timeoutMs-(now()-lastActivity);
  if(remaining<=0){dispose();onTimeout();return;}
  timer=targetWindow.setTimeout(check,Math.min(remaining,1000));
 }
 function activity(event){
  if(!active||!event.isTrusted)return;
  if(now()-lastActivity>=timeoutMs){check();return;}
  lastActivity=now();
 }
 const documents=new Set([targetWindow.document]);
 try{if(targetWindow.top.location.origin===targetWindow.location.origin)documents.add(targetWindow.top.document);}catch{}
 for(const document of documents){
  for(const type of ['pointermove','pointerdown','pointerup','mousemove','mousedown','click','touchstart','touchmove','keydown','wheel'])listen(document,type,activity);
  listen(document,'visibilitychange',check);
 }
 listen(targetWindow,'focus',check);
 listen(targetWindow,'pagehide',event=>{if(event.persisted)targetWindow.clearTimeout(timer);else dispose();});
 listen(targetWindow,'pageshow',check);
 targetWindow[INSTALLATION]=dispose;
 check();return dispose;
}

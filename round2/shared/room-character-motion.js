// Live game character reactions. Original character and room transforms stay intact.
const NS='http://www.w3.org/2000/svg';
export function installRoomCharacterMotion(svg,{room='workki'}={}){
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const explicit=[...svg.querySelectorAll('[data-game-character]')];
 const sources=explicit.length?explicit:[svg.querySelector('#room-character')?.firstElementChild,svg.querySelector('#room-complete')?.lastElementChild].filter(Boolean);
 const descriptors=[],wrappers=[];let animations=[],generation=0,disposed=false,paused=false;
 const group=()=>document.createElementNS(NS,'g');
 for(const [index,source]of sources.entries()){
  const original=[...source.children],heads=[];
  if(room==='workki'&&original.length===70){
   const box=original[0].getBBox(),origin=`${box.x+box.width/2}px ${box.y+box.height-4}px`;
   for(const [first,last]of [[0,9],[28,34],[57,60],[69,69]]){
    const head=group();head.dataset.characterPart='head';source.insertBefore(head,original[first]);
    for(let n=first;n<=last;n++)head.append(original[n]);
    head.style.transformBox='view-box';head.style.transformOrigin=origin;heads.push(head);wrappers.push(head);
   }
  }
  const body=group();body.dataset.characterMotion=room;body.dataset.characterState='idle';
  body.append(...source.childNodes);source.append(body);wrappers.push(body);
  descriptors.push({source,body,heads,index});
 }
 const transform=(y=0,rotation=0,x=0)=>`translate(${x}px,${y}px) rotate(${rotation}deg)`;
 function cancel(){++generation;animations.forEach(a=>a.cancel());animations=[];}
 function active(){return descriptors.filter(d=>!d.source.closest('[hidden]'));}
 function begin(state){
  cancel();const version=generation;
  for(const d of descriptors)d.body.dataset.characterState=state;
  if(disposed||paused||media.matches||document.hidden)return;
  const duration=state==='idle'?(room==='zibi'?5400:room==='eddie'?4800:5000):state==='complete'?800:room==='zibi'?650:600;
  let frames;
  if(state==='idle')frames=room==='zibi'
   ?[{transform:transform()},{transform:transform(0,1.4,1),offset:.25},{transform:transform(),offset:.5},{transform:transform(0,-1.4,-1),offset:.75},{transform:transform()}]
   :room==='eddie'?[{transform:transform()},{transform:transform(-1.8),offset:.4},{transform:transform(),offset:.7},{transform:transform()}]
   :[{transform:transform()},{transform:transform(0,.8),offset:.3},{transform:transform(0,-.8),offset:.65},{transform:transform()}];
  else {
   const jump=state==='complete'?(room==='workki'?16:room==='eddie'?14:8):(room==='workki'?8:room==='eddie'?6:4);
   frames=room==='zibi'
    ?[{transform:transform()},{transform:transform(-jump,-1.5),offset:.23},{transform:transform(),offset:.43},{transform:transform(-jump*.8,1.5),offset:.68},{transform:transform()}]
    :[{transform:transform()},{transform:transform(2),offset:.12},{transform:transform(-jump,room==='workki'?-2:0),offset:.4},{transform:transform(1),offset:.76},{transform:transform()}];
  }
  for(const d of active()){
   const box=d.body.getBBox();d.body.style.transformBox='view-box';d.body.style.transformOrigin=`${box.x+box.width/2}px ${box.y+box.height}px`;
   const animation=d.body.animate(frames,{duration,iterations:state==='idle'?Infinity:1,easing:'ease-in-out'});
   animation.id=`character-${room}-${state}-${d.index}`;animations.push(animation);
   for(const [index,head]of d.heads.entries()){
    const angle=state==='idle'?2.5:state==='complete'?9:6;
    const nod=head.animate([{transform:'rotate(0deg)'},{transform:`rotate(${angle}deg)`,offset:.35},{transform:`rotate(${-angle*.35}deg)`,offset:.65},{transform:'rotate(0deg)'}],{duration,iterations:state==='idle'?Infinity:1,easing:'ease-in-out'});
    nod.id=`character-${room}-${state}-head-${d.index}-${index}`;animations.push(nod);
   }
  }
  if(state!=='idle')Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(version===generation&&!disposed)begin('idle');});
 }
 const sync=()=>begin('idle');
 document.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);
 const api={idle:()=>begin('idle'),placement:()=>begin('placement'),complete:()=>begin('complete'),reset:()=>begin('idle'),
  setPaused(value){paused=value;begin('idle');},
  dispose(){disposed=true;cancel();document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);for(const wrapper of wrappers.reverse()){while(wrapper.firstChild)wrapper.before(wrapper.firstChild);wrapper.remove();}}
 };
 return api;
}

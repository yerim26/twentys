import {goToRound} from './navigation.js';
import {BOARD,artLayout,footprint,createGame} from './game.js';
import {playPlacement,stopPlacementMotion} from './motion.js';
import {installRoomCharacterMotion} from './room-character-motion.js';
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs={},children=[])=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);n.append(...children);return n;};
const use=id=>el('use',{href:`#${id}`});
const show=(node,visible)=>node?.toggleAttribute('hidden',!visible);
const parameters=new URL(location.href).searchParams;
const round=parameters.get('round')==='3'||(!parameters.has('round')&&parameters.get('stage')==='2')?3:2;
const requested=parameters.get('room')==='wooki'?'workki':parameters.get('room');
const room=['workki','zibi','eddie'].includes(requested)?requested:'workki';
try {
 const directory=round===3?'round3':'rooms';
 const responses=await Promise.all([fetch(`./${directory}/${room}.svg?v=speech-center-3`),fetch(`./${directory}/${room}.json`)]);
 if(responses.some(r=>!r.ok))throw new Error('방 파일을 불러오지 못했습니다.');
 const [source,data]=await Promise.all([responses[0].text(),responses[1].json()]);
 const svg=new DOMParser().parseFromString(source,'image/svg+xml').documentElement;
 if(svg.tagName!=='svg')throw new Error('방 그림 형식이 올바르지 않습니다.');
 svg.querySelector('#speech')?.setAttribute('hidden','');
 document.querySelector('#game').replaceChildren(document.importNode(svg,true));
 document.title=`${data.name||room} · Round ${round} ${round===3?'경험과 성장':'독립'} — Twentys`;
 await document.fonts.ready;
 initialize(document.querySelector('#game-svg'),data.items||data);
} catch(error) {document.querySelector('#game').textContent=error.message;console.error(error);}
function initialize(svg,items){
 const $=s=>svg.querySelector(s),defs=$('defs'),game=createGame(items),byId=new Map(items.map(i=>[i.id,i]));
 svg.dataset.round=String(round);
 // The completion card belongs only to Round 3; Round 2 ends on its final line.
 if(round===2)$('#completion')?.remove();
 let state=game.initial(),pointer=null,inverse=null,raf=0,heldKey='',revision=0,endTimer=0,popupTimer=0,returnTimer=0;
 const rendered=new Map(),artCache=new Map();let cancelSpeech=()=>{},progressTarget=-1,progressAnimation=null;
 const characterMotion=installRoomCharacterMotion(svg,{room});
 window.addEventListener('pagehide',()=>{cancelSpeech();characterMotion.dispose();},{once:true});
 let completionOpen=false,returnFocus=null;
 const savedTabIndexes=new Map();
 function setCompletion(open){
  const popup=$('#completion');if(round!==3||!popup)return;
  if(open===completionOpen)return;
  completionOpen=open;show(popup,open);characterMotion.setPaused(open);clearTimeout(returnTimer);
  if(open)returnTimer=setTimeout(()=>goToRound(1),4000);
  if(open){
   returnFocus=document.activeElement;
   for(const control of svg.querySelectorAll('[role="button"], [tabindex]')){
    if(popup.contains(control))continue;
    savedTabIndexes.set(control,control.getAttribute('tabindex'));control.setAttribute('tabindex','-1');
   }
   $('#completion-next')?.focus();
  }else{
   for(const [control,value]of savedTabIndexes){if(value===null)control.removeAttribute('tabindex');else control.setAttribute('tabindex',value);}
   savedTabIndexes.clear();
   const target=returnFocus?.isConnected&&!returnFocus.closest('[hidden]')&&returnFocus.getAttribute('aria-disabled')!=='true'?returnFocus:$('#reset');
   if(target&&target!==document.body)target.focus();else $('#reset')?.focus();
   returnFocus=null;
  }
 }
 const attributes={x:'-50%',y:'-50%',width:'200%',height:'200%','color-interpolation-filters':'sRGB',primitiveUnits:'userSpaceOnUse'};
 const shadow=el('filter',{id:'common-shadow',...attributes},[
  el('feGaussianBlur',{in:'SourceAlpha',stdDeviation:5,result:'blur'}),el('feOffset',{in:'blur',dx:2,dy:2,result:'offset'}),
  el('feFlood',{'flood-color':'#000','flood-opacity':.25,result:'color'}),el('feComposite',{in:'color',in2:'offset',operator:'in'})
 ]);
 defs.append(shadow);
 for(const panel of svg.querySelectorAll('[data-shadow-panel]')) {
  if(panel.id)panel.before(el('g',{class:'shadow-only',filter:'url(#common-shadow)'},[use(panel.id)]));
 }
 const board=$('#board-base');
 if(board){const shadowNode=el('g',{class:'shadow-only',filter:'url(#common-shadow)'},[use('board-base')]);board.before(shadowNode);}
 for(const item of items)for(const rotation of [0,90,180,270]){
  const layout=artLayout(item,rotation),id=`layout-${item.id}-${rotation}`;
  const art=el('g',{id},layout.parts.map(p=>el('g',{transform:p.transform},[use(p.id)])));
  defs.append(art);artCache.set(`${item.id}:${rotation}`,id);
  const clip=el('clipPath',{id:`cells-${item.id}-${rotation}`,clipPathUnits:'userSpaceOnUse'},layout.cells.map(([c,r])=>el('rect',{x:c*BOARD.cellWidth,y:r*BOARD.cellHeight,width:BOARD.cellWidth,height:BOARD.cellHeight})));
  defs.append(clip);
 }
 const paperCache=new Map();
 function paperArtwork(item,rotation){
  const key=`${item.id}:${rotation}`;if(paperCache.has(key))return paperCache.get(key);
  const layout=artLayout(item,rotation),id=`paper-${item.id}-${rotation}`,layers=[];
  const sourceShapes=layout.parts.flatMap(part=>[...$(`#${part.id}`).querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')]);
  const ink=sourceShapes.map(node=>getComputedStyle(node).stroke).find(color=>color!=='none'&&color!=='rgba(0, 0, 0, 0)')||(round===3?'#000':'#351e28');
  // Two vector silhouettes form a smooth 2-unit outline around an 8-unit backing.
  // Source artwork is drawn separately, so no raster filter can distort its seams.
  for(const [color,width]of [[ink,20],['#fff',16]]){
   const layer=el('g');
   for(const part of layout.parts){
    const source=$(`#${part.id}`),copy=source.cloneNode(true);
    const originals=[source,...source.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
    for(let i=0;i<copies.length;i++){
     const node=copies[i];node.removeAttribute('id');
     if(!['path','rect','circle','ellipse','polygon','polyline','line','text','tspan'].includes(node.localName))continue;
     const paint=getComputedStyle(originals[i]);
     node.style.setProperty('fill',paint.fill==='none'?'none':color,'important');
     node.style.setProperty('stroke',color,'important');
     node.style.setProperty('stroke-width',String(width),'important');
     node.style.setProperty('stroke-linejoin','round','important');
     node.style.setProperty('stroke-linecap','round','important');
     node.style.setProperty('filter','none','important');
    }
    layer.append(el('g',{transform:part.transform},[copy]));
   }
   layers.push(layer);
  }
  defs.append(el('g',{id},layers));paperCache.set(key,id);return id;
 }
 for(const original of svg.querySelectorAll('[data-item] .tray-original')){
  const visual=el('g',{class:'tray-hover-visual'});original.before(visual);visual.append(original);
 }
 const resetVisuals=[];
 for(const source of svg.querySelectorAll('[data-reset-visual]')){
  const visual=el('g',{class:'reset-hover-visual'});source.before(visual);visual.append(source);resetVisuals.push(visual);
 }
 const reset=$('#reset'),resetState=(name,active)=>resetVisuals.forEach(node=>node.classList.toggle(name,active));
 reset?.addEventListener('pointerenter',()=>resetState('is-hovered',true));
 reset?.addEventListener('pointerleave',()=>{resetState('is-hovered',false);resetState('is-active',false);});
 reset?.addEventListener('pointerdown',()=>resetState('is-active',true));reset?.addEventListener('pointerup',()=>resetState('is-active',false));reset?.addEventListener('pointercancel',()=>resetState('is-active',false));
 reset?.addEventListener('focus',()=>resetState('is-focused',reset.matches(':focus-visible')));reset?.addEventListener('blur',()=>resetState('is-focused',false));
 const completionVisuals=[];
 for(const source of svg.querySelectorAll('[data-completion-button]')){
  const visual=el('g',{class:'completion-button-visual'});source.before(visual);visual.append(source);completionVisuals.push(visual);
 }
 const completionButton=$('#completion-next'),completionState=(name,active)=>completionVisuals.forEach(node=>node.classList.toggle(name,active));
 completionButton?.addEventListener('pointerenter',()=>completionState('is-hovered',true));
 completionButton?.addEventListener('pointerleave',()=>{completionState('is-hovered',false);completionState('is-active',false);});
 completionButton?.addEventListener('pointerdown',()=>completionState('is-active',true));completionButton?.addEventListener('pointerup',()=>completionState('is-active',false));completionButton?.addEventListener('pointercancel',()=>completionState('is-active',false));
 completionButton?.addEventListener('focus',()=>completionState('is-focused',completionButton.matches(':focus-visible')));completionButton?.addEventListener('blur',()=>completionState('is-focused',false));
 function updateProgress(count){
  const fill=$('#progress-fill');if(!fill)return;
  const target=(Number(fill.dataset.fullWidth)||243.73)*count/items.length;if(target===progressTarget)return;
  const current=Number.parseFloat(getComputedStyle(fill).width)||0;progressTarget=target;progressAnimation?.cancel();fill.setAttribute('width',target);
  if(count>0&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&Math.abs(current-target)>.01){
   progressAnimation=fill.animate([{width:`${current}px`},{width:`${target}px`}],{duration:400,easing:'cubic-bezier(.2,.8,.2,1)'});progressAnimation.id='puzzle-progress-fill';
  }
 }
 const updateMatrix=()=>{inverse=svg.getScreenCTM()?.inverse();positionHeld();};
 const svgPoint=(x,y)=>new DOMPoint(x,y).matrixTransform(inverse||svg.getScreenCTM().inverse());
 function track(event){pointer={x:event.clientX,y:event.clientY};if(state.held&&!raf)raf=requestAnimationFrame(()=>{raf=0;positionHeld();});}
 function positionHeld(){if(!state.held||!pointer)return;const p=svgPoint(pointer.x,pointer.y),a=artLayout(byId.get(state.held),state.rotations[state.held]);$('#held-item').setAttribute('transform',`translate(${p.x-a.centerX} ${p.y-a.centerY})`);}
 function renderPiece(item,p){
  const origin=`translate(${BOARD.x+p.col*BOARD.cellWidth} ${BOARD.y+p.row*BOARD.cellHeight})`,a=artLayout(item,p.rotation);
  // Round 3 uses the native texture directly, so a rotated long piece never
  // magnifies an already-cropped horizontal image. Round 2 keeps its source mapping.
  const viewport=item.texture
   ?el('image',{href:item.texture,x:0,y:0,width:a.pixelWidth,height:a.pixelHeight,preserveAspectRatio:'xMidYMid slice'})
   :el('svg',{x:0,y:0,width:a.pixelWidth,height:a.pixelHeight,viewBox:`0 0 ${item.width*BOARD.cellWidth} ${item.height*BOARD.cellHeight}`,preserveAspectRatio:'xMidYMid slice',overflow:'hidden'},[use(`photo-${item.id}`)]);
  const texture=el('g',{'data-texture':item.id,transform:origin},[el('g',{'clip-path':`url(#cells-${item.id}-${p.rotation})`},[viewport])]);
  const piece=el('g',{'data-placed':item.id,transform:origin,role:'button',tabindex:0,'aria-label':`${item.name} 집기`},[
   ...a.cells.map(([c,r])=>el('rect',{x:c*BOARD.cellWidth,y:r*BOARD.cellHeight,width:BOARD.cellWidth,height:BOARD.cellHeight,fill:'transparent'})),
   el('g',{class:'placed-art'},[use(artCache.get(`${item.id}:${p.rotation}`))])
  ]);
  $('#board-textures').append(texture);$('#placed-items').append(piece);
  rendered.set(item.id,{key:JSON.stringify(p),texture,piece});
 }
 function dialogue(kind,animate,delay=0){
  const speech=$('#speech');if(!speech||!$(`#dialogue-${kind}`))return Promise.resolve(false);
  cancelSpeech();speech.getAnimations().forEach(a=>a.cancel());
  if(speech.dataset.popOrigin){const [x,y]=speech.dataset.popOrigin.split(/[, ]+/).map(Number);if(Number.isFinite(x)&&Number.isFinite(y))speech.style.transformOrigin=`${x}px ${y}px`;}
  speech.replaceChildren(use(`dialogue-${kind}`));speech.dataset.dialogue=kind;show(speech,false);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?0:animate?(kind==='finish'?600:1020):420,exitDuration=reduced?0:220;
  speech.dataset.entryDuration=String(duration);speech.dataset.exitDuration=String(exitDuration);speech.dataset.delayDuration=String(delay);speech.dataset.speechPhase=delay?'waiting':'entering';
  let entry=null,exit=null,delayTimer=0,hideTimer=0,settled=false,resolve;
  const finished=new Promise(done=>{resolve=done;});
  cancelSpeech=()=>{clearTimeout(delayTimer);clearTimeout(hideTimer);entry?.cancel();exit?.cancel();if(!settled){settled=true;resolve(false);}};
  const hidden=()=>{if(settled)return;show(speech,false);speech.dataset.speechPhase='hidden';settled=true;resolve(true);};
  const leave=()=>{
   if(settled)return;speech.dataset.speechPhase='exiting';
   if(exitDuration){exit=speech.animate([{transform:'translateY(0) scale(1)',opacity:1},{transform:'translateY(4px) scale(.08)',opacity:0}],{duration:exitDuration,easing:'cubic-bezier(.4,0,1,1)'});exit.id='speech-exit';exit.finished.then(hidden).catch(()=>{});}else hidden();
  };
  const entered=()=>{if(settled)return;speech.dataset.speechPhase='shown';hideTimer=setTimeout(leave,2000);};
  const enter=()=>{
   if(settled)return;show(speech,true);speech.dataset.speechPhase='entering';
   if(duration){
    const frames=animate
     ?[{transform:'translateY(10px) scale(.04,.04)',opacity:0},{transform:'translateY(-1px) scale(1.035,1.06)',opacity:1,offset:.7},{transform:'translateY(0) scale(1)',opacity:1}]
     :[{transform:'translateY(10px) scale(.98)',opacity:0},{transform:'translateY(0) scale(1)',opacity:1}];
    entry=speech.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});entry.id='speech-enter';entry.finished.then(entered).catch(()=>{});
   }else entered();
  };
  if(delay)delayTimer=setTimeout(enter,delay);else enter();
  return finished;
 }
 function render(lastPlaced=null){
  ++revision;clearTimeout(endTimer);clearTimeout(popupTimer);setCompletion(false);
  for(const item of items){
   const placement=state.placements[item.id],previous=rendered.get(item.id);
   if(previous&&previous.key!==JSON.stringify(placement)){stopPlacementMotion(previous.piece);previous.texture.remove();previous.piece.remove();rendered.delete(item.id);}
   if(placement&&!rendered.has(item.id))renderPiece(item,placement);
   const slot=$(`[data-item="${item.id}"]`),used=!!placement||state.held===item.id;
   if(slot){show(slot.querySelector('.tray-original'),!used);show(slot.querySelector('.tray-ghost'),used);show(slot.querySelector('.tray-label'),!!placement);slot.setAttribute('aria-disabled',String(used));slot.setAttribute('tabindex',used?'-1':'0');slot.style.pointerEvents=used?'none':'';}
   svg.querySelectorAll(`[data-reveal="${item.id}"]`).forEach(n=>{if(!placement)stopPlacementMotion(n);show(n,!!placement);});
   if(!placement)svg.querySelectorAll(`[data-complete-reveal="${item.id}"]`).forEach(stopPlacementMotion);
  }
  const count=Object.keys(state.placements).length,complete=game.complete(state);
  if($('#progress-count'))$('#progress-count').textContent=`${count}/${items.length}`;
  updateProgress(count);
  svg.dataset.complete=String(complete);svg.dataset.held=state.held||'';
  svg.classList.toggle('holding',!!state.held);
  const key=state.held?`${state.held}:${state.rotations[state.held]}`:'';
  if(key!==heldKey){heldKey=key;const held=$('#held-item');held.replaceChildren();if(key){const id=artCache.get(key),paperId=paperArtwork(byId.get(state.held),state.rotations[state.held]);held.append(el('g',{class:'shadow-only',filter:'url(#common-shadow)'},[use(paperId)]),el('g',{class:'pickup-paper-vector'},[use(paperId)]),el('g',{class:'held-art'},[use(id)]));}show(held,!!key);}
  positionHeld();
  const completedRoom=$('#room-complete')||$('#room-finish');
  show($('#room-start'),!complete||!completedRoom);show(completedRoom,complete);show($('#room-additions'),!complete||!completedRoom);
  if(lastPlaced)characterMotion[complete&&round===2?'complete':'placement']();else characterMotion.reset();
  if(lastPlaced){
   const selector=complete?`[data-complete-reveal="${lastPlaced}"]`:`[data-reveal="${lastPlaced}"]`;
   playPlacement(rendered.get(lastPlaced)?.piece,[...svg.querySelectorAll(selector)]);
  }
  if(lastPlaced&&round===3){
   // Read the placed piece's own line, including the ninth piece, before the ending.
   const finishedSpeech=dialogue($(`#dialogue-${lastPlaced}`)?lastPlaced:'start',true);
   if(complete){
    const version=revision;
    finishedSpeech.then(shown=>{
     if(!shown||version!==revision||!game.complete(state))return;
     dialogue('finish',true);characterMotion.complete();
     // This timer starts when the final line appears, independently of motion.
     popupTimer=setTimeout(()=>{if(version===revision&&game.complete(state))setCompletion(true);},3000);
    });
   }
  }else if(lastPlaced&&complete){dialogue('finish',true);const version=revision;endTimer=setTimeout(()=>{if(version===revision&&game.complete(state))goToRound(3,room);},3000);}
  else if(!complete&&$('#speech')?.dataset.dialogue==='finish')dialogue('start',false);
 }
 function resetRound(){state=game.initial();dialogue('start',false);render();}
 function completionAction(){if(round===3)goToRound(1);}
 function activate(target,point){
  if(target.closest('#completion-next')){completionAction();return;}
  if(completionOpen)return;
  if(target.closest('#reset')){resetRound();return;}
  if(state.held){
   if(target.closest('#inventory')){state=game.returnPiece(state);render();return;}
   const held=state.held,next=game.place(state,point.x-BOARD.x,point.y-BOARD.y);
   if(next!==state){state=next;render(held);}return;
  }
  const node=target.closest('[data-placed],[data-item]');if(!node)return;
  const id=node.dataset.placed||node.dataset.item;if(node.dataset.item&&state.placements[id])return;
  state=game.pickup(state,id);render();
 }
 svg.addEventListener('click',event=>{track(event);activate(event.target,svgPoint(event.clientX,event.clientY));});
 window.addEventListener('pointermove',track,{passive:true});
 window.addEventListener('resize',updateMatrix);new ResizeObserver(updateMatrix).observe(svg);
 document.addEventListener('contextmenu',event=>{if(!state.held||completionOpen)return;event.preventDefault();track(event);state=game.rotate(state);render();});
 document.addEventListener('keydown',event=>{
  if(completionOpen){
   if(event.key==='Escape'){event.preventDefault();completionAction();return;}
   if(event.key==='Tab'){event.preventDefault();$('#completion-next')?.focus();return;}
   if(event.key==='Enter'||event.key===' '){event.preventDefault();if(event.target.closest('#completion-next'))completionAction();return;}
   return;
  }
  if(event.key==='Escape'&&state.held){event.preventDefault();state=game.returnPiece(state);render();return;}
  if(event.key.toLowerCase()==='r'&&state.held){event.preventDefault();state=game.rotate(state);render();return;}
  if(event.key!=='Enter'&&event.key!==' ')return;
  const target=event.target.closest('[role="button"]');if(!target)return;event.preventDefault();
  const b=target.getBoundingClientRect();if(!state.held)pointer={x:b.x+b.width/2,y:b.y+b.height/2};
  if(pointer)activate(target,svgPoint(pointer.x,pointer.y));
 });
 updateMatrix();dialogue('start',false,1000);render();
 // Read-only state snapshots make browser QA reproducible without bypassing input.
 window.puzzle={room,round,items,getState:()=>structuredClone(state),layout:(id,r)=>artLayout(byId.get(id),r)};
}

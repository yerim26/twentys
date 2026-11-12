import {goToRound} from '../shared/navigation.js';
const NS='http://www.w3.org/2000/svg';
const make=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const show=(node,yes)=>node?.toggleAttribute('hidden',!yes);
try{
 const [response,configuration,questionResponse]=await Promise.all([fetch(new URL('./screen.svg',import.meta.url)),fetch(new URL('./data.json',import.meta.url)),fetch(new URL('./questions.json',import.meta.url))]);
 if(!response.ok||!configuration.ok||!questionResponse.ok)throw Error('설문 화면을 불러오지 못했습니다.');
 const [source,data,questions]=await Promise.all([response.text(),configuration.json(),questionResponse.json()]);data.questions=questions;
 const parsed=new DOMParser().parseFromString(source,'image/svg+xml').documentElement;
 if(parsed.localName!=='svg')throw Error('설문 그림 형식이 올바르지 않습니다.');
 document.querySelector('#game').replaceChildren(document.importNode(parsed,true));
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./styles.css',import.meta.url);document.head.append(css);
 document.title='Round 1 · 나를 알아가는 시간 — Twentys';
 await document.fonts.ready;initialize(document.querySelector('#game-svg')||document.querySelector('#game svg'),data);
}catch(error){document.querySelector('#game').textContent=error.message;console.error(error);}
function initialize(svg,data){
 const $=selector=>svg.querySelector(selector),$$=selector=>[...svg.querySelectorAll(selector)];
 let phase='survey',question=0,answers=Array(7).fill(null),room=null,nextDot=1;
 const questions=data.questions||[];
 const dots=$$('[data-dot]').sort((a,b)=>Number(a.dataset.dot)-Number(b.dataset.dot));
 const initial=data.originalDots||dots.map(dot=>{const m=dot.transform.baseVal.consolidate()?.matrix;return[m?.e||0,m?.f||0];});
 const lines=make('polyline',{id:'connection-line',fill:'none',stroke:'#514840','stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round','pointer-events':'none'});
 $('#connections').append(lines);
 for(const dot of dots){
  const number=Number(dot.dataset.dot),circle=dot.querySelector('circle');circle?.classList.add('dot-core');
  dot.setAttribute('role','button');dot.setAttribute('tabindex','-1');dot.setAttribute('aria-label',`${number}번 점`);
  const ring=make('circle',{class:'dot-highlight',cx:0,cy:0,r:16,fill:'none',stroke:'#fff','stroke-width':3,'pointer-events':'none'});
  dot.prepend(ring);
 }
 const controls=['#question-prev','#question-next','#result-show','#restart','#continue'];
 for(const selector of controls){const n=$(selector);if(n){n.setAttribute('role','button');n.setAttribute('tabindex','0');}}
 for(const answer of $$('[data-answer]')){
  answer.setAttribute('role','button');answer.setAttribute('tabindex','0');
  const circle=answer.querySelector('circle');answer.querySelectorAll('path').forEach(path=>path.remove());
  const label=make('text',{class:'answer-number',x:circle.getAttribute('cx'),y:circle.getAttribute('cy'),'text-anchor':'middle','dominant-baseline':'central','font-family':'Pretendard','font-size':24});circle.parentNode.append(label);
  const row=make('g',{class:'answer-row','data-answer-row':answer.dataset.answer});
  const hit=answer.querySelector('.hit-target');
  if(hit){hit.setAttribute('width','480');hit.setAttribute('y',String(586.52+(Number(answer.dataset.answer)-1)*60));hit.setAttribute('height','58');}
  row.style.transformOrigin=`375px ${615.52+(Number(answer.dataset.answer)-1)*60}px`;
  answer.before(row);row.append(answer,$(`#answer-${answer.dataset.answer}-text`));
 }
 const nextQuestion=$('#question-next'),nextVisual=make('g',{class:'question-next-visual'});
 for(const child of [...nextQuestion.children])if(!child.classList.contains('hit-target'))nextVisual.append(child);
 nextQuestion.prepend(nextVisual);
 const questionContent=make('g',{id:'question-content',transform:'translate(-10 0)'});
 $('#question-number').before(questionContent);
 questionContent.append($('#question-number'),$('#question-text'),...$$('.answer-row'));
 const resultButton=$('#result-show'),resultVisual=make('g',{class:'result-show-visual'});
 resultVisual.append(...resultButton.childNodes);resultButton.append(resultVisual);
 for(const source of $$('[data-result-character],[data-result-reveal]')){
  const role=source.dataset.resultCharacter?'character':source.dataset.resultReveal;
  const wrapper=make('g',{'data-result-entry':role,'data-result-order':source.dataset.resultOrder||0});
  source.before(wrapper);
  if(role==='actions'){
   const visual=make('g',{class:'result-action-visual','data-action':source.dataset.resultAction});wrapper.append(visual);visual.append(source);
  }else wrapper.append(source);
 }
 for(const action of ['restart','continue']){
  const hit=$(`#${action}`);
  const set=(name,enabled)=>$$(`[data-result="${room}"] .result-action-visual[data-action="${action}"]`).forEach(node=>node.classList.toggle(name,enabled));
  hit.addEventListener('pointerenter',()=>set('is-hovered',true));hit.addEventListener('pointerleave',()=>{set('is-hovered',false);set('is-active',false);});
  hit.addEventListener('pointerdown',()=>set('is-active',true));hit.addEventListener('pointerup',()=>set('is-active',false));hit.addEventListener('pointercancel',()=>set('is-active',false));
  hit.addEventListener('focus',()=>set('is-focused',hit.matches(':focus-visible')));hit.addEventListener('blur',()=>{set('is-focused',false);set('is-active',false);});
 }
 function revealResult(){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const entries=$$(`[data-result="${room}"] [data-result-entry]`),running=[];
  for(const target of entries){
   target.getAnimations().forEach(animation=>animation.cancel());
   if(reduced)continue;
   const role=target.dataset.resultEntry,order=Number(target.dataset.resultOrder)||0;
   const timing=role==='character'?[0,600]:role==='title'?[150,450]:role==='description'?[Math.min(600,300+order*100),400]:role==='actions'?[650,350]:[400,420];
   const transform=role==='character'?'translateY(10px)':role==='title'?'scale(.985)':role==='description'?'translateY(6px)':role==='actions'?'translateY(0)':'scale(.96)';
   const animation=target.animate([{transform,opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],{delay:timing[0],duration:timing[1],fill:'backwards',easing:'cubic-bezier(.2,.8,.2,1)'});
   animation.id=`result-${role}-enter`;running.push(animation.finished);
  }
  Promise.allSettled(running).then(()=>{if(phase==='result')$('#continue')?.focus();});
 }

 const measure=document.createElement('canvas').getContext('2d');
 function text(selector,value){
  const n=$(selector);if(!n)return;
  const plain=String(value).replaceAll('\\n','\n');
  if(selector!=='#question-text'&&!selector.startsWith('#answer-')){n.textContent=plain;return;}
  const answer=selector.startsWith('#answer-'),maxWidth=answer?410:430,maxLines=answer?2:3;
  let size=answer?28:30,wrapped=[];
  do{
   measure.font=`${size}px Pretendard`;wrapped=[];
   for(const paragraph of plain.split('\n')){let line='';for(const char of paragraph){if(line&&measure.measureText(line+char).width>maxWidth){wrapped.push(line.trim());line=char;}else line+=char;}wrapped.push(line.trim());}
   if(wrapped.length<=maxLines||size<=18)break;size-=1;
  }while(true);
  n.setAttribute('font-family','Pretendard');n.setAttribute('font-size',size);n.replaceChildren();
  wrapped.forEach((line,index)=>{const span=make('tspan',{x:n.getAttribute('x'),dy:index===0?(answer?-(wrapped.length-1)*size*.56:0):size*1.12});span.textContent=line;n.append(span);});
 }

 function update(){
  svg.dataset.phase=phase;svg.dataset.question=String(question+1);if(room)svg.dataset.room=room;
  const survey=phase==='survey',result=phase==='result';
  show($('#survey-screen'),!result);show($('#connect-screen'),!survey&&!result);show($('#result-screen'),result);
  for(const resultNode of $$('[data-result]'))show(resultNode,resultNode.dataset.result===room);
  const selected=new Set(answers.flatMap((answer,index)=>answer===null?[]:[index*3+answer]));
  for(const dot of dots){const number=Number(dot.dataset.dot);dot.classList.toggle('selected-dot',survey&&selected.has(number));dot.classList.toggle('next-dot',phase==='connect'&&number===nextDot);dot.classList.toggle('connected-dot',!survey&&number<nextDot);dot.setAttribute('tabindex',phase==='connect'&&number===nextDot?'0':'-1');dot.setAttribute('aria-disabled',String(phase!=='connect'||number!==nextDot));}
  if(phase==='connect'&&dots[nextDot-1])$('#dots').append(dots[nextDot-1]);
  const item=questions[question]||{text:`[임시] 질문 ${question+1}`,answers:['임시 답변 1','임시 답변 2','임시 답변 3']};
  show($('#question-original'),false);
  show($('#question-text'),!result);show($('#question-number'),!result);
  text('#question-number',`Q${question+1}.`);text('#question-text',item.text||item.question||`[임시] 질문 ${question+1}`);
  for(let n=1;n<=3;n++){
   text(`#answer-${n}-text`,item.answers?.[n-1]||`임시 답변 ${n}`);show($(`#answer-${n}-text`),!result);$(`#answer-${n}-text`).dataset.answerTarget=String(n);
   const control=$(`[data-answer="${n}"]`);control.closest('.answer-row').dataset.enabled=String(survey);show(control,!result);control?.setAttribute('tabindex',survey?'0':'-1');control?.setAttribute('aria-pressed',String(answers[question]===n));control?.classList.toggle('answer-selected',answers[question]===n);
   const number=question*3+n,label=control.querySelector('.answer-number');label.textContent=String(number);label.setAttribute('font-size',number<10?24:19);control.setAttribute('aria-label',`${number}번 답변: ${item.answers?.[n-1]||''}`);
  }
  show($('#question-prev'),survey);show($('#question-next'),survey);
  $('#question-prev')?.setAttribute('aria-disabled',String(question===0));$('#question-next')?.setAttribute('aria-disabled',String(answers[question]===null));
  lines.setAttribute('fill',phase==='connected'?'#f9f2fc':'none');
  const progress=$('#dot-progress-fill');if(progress)progress.setAttribute('width',Number(progress.dataset.fullWidth||243.73)*Math.min(nextDot-1,21)/21);
  show($('#result-show'),phase==='connected');show($('#draw-hint'),phase==='connect'||phase==='moving');text('#dot-progress',`${Math.min(nextDot-1,21)}/21`);
 }
 function chooseRoom(){
  if(room)return room;
  const totals=[1,2,3].map(answer=>answers.filter(value=>value===answer).length),max=Math.max(...totals),candidates=totals.map((count,index)=>count===max?index:-1).filter(index=>index>=0);
  room=['zibi','workki','eddie'][candidates[Math.floor(Math.random()*candidates.length)]];return room;
 }
 async function connect(){
  if(answers.some(answer=>answer===null)||phase!=='survey')return;
  chooseRoom();phase='moving';update();
  const points=data.dots?.[room];if(!points||points.length!==21)throw Error('캐릭터 연결점이 올바르지 않습니다.');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  await Promise.all(dots.map(async(dot,index)=>{
   const from=initial[index],to=points[index];
   if(!reduced){const animation=dot.animate([{transform:`translate(${from[0]}px,${from[1]}px)`},{transform:`translate(${to[0]}px,${to[1]}px)`}],{duration:900,easing:'cubic-bezier(.2,.8,.2,1)'});await animation.finished.catch(()=>{});}
   dot.setAttribute('transform',`translate(${to[0]} ${to[1]})`);
  }));
  phase='connect';update();dots[0]?.focus();
 }
 function activate(target){
  const action=target.closest('[data-answer],[data-answer-target],[data-dot],#question-prev,#question-next,#result-show,#restart,#continue');if(!action)return;
  if(phase==='survey'){
   if(action.dataset.answer||action.dataset.answerTarget){answers[question]=Number(action.dataset.answer||action.dataset.answerTarget);update();}
   else if(action.id==='question-prev'&&question>0){question--;update();}
   else if(action.id==='question-next'&&answers[question]!==null){if(question<6){question++;update();}else connect().catch(console.error);}
  }else if(phase==='connect'&&Number(action.dataset.dot)===nextDot){
   nextDot++;const points=data.dots[room].slice(0,nextDot-1);if(nextDot===22&&data.closedOutline)points.push(points[0]);lines.setAttribute('points',points.map(point=>point.join(',')).join(' '));
   if(nextDot===22)phase='connected';update();if(phase==='connect')dots[nextDot-1]?.focus();else $('#result-show')?.focus();
  }else if(phase==='connected'&&action.id==='result-show'){phase='result';update();revealResult();}
  else if(phase==='result'&&action.id==='restart')goToRound(1);
  else if(phase==='result'&&action.id==='continue')goToRound(2,room);
 }
 svg.addEventListener('click',event=>activate(event.target));
 svg.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate(event.target);}});
 update();window.survey={getState:()=>({phase,question,answers:[...answers],room,nextDot}),points:()=>structuredClone(room?data.dots[room]:initial)};
}

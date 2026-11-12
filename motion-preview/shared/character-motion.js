// Optional preview module. The game does not import this file.
// Original SVG paths are preserved; Workki's head runs retain their paint order.
const NS='http://www.w3.org/2000/svg';
export function installCharacterMotion(svg,{room='workki',mode='active',paused=false,intensity=1}={}) {
  const candidates=[...svg.querySelectorAll('[data-character-source]')];
  if(!candidates.length){
    const start=svg.querySelector('#room-character');
    if(start)candidates.push(start.firstElementChild||start);
    const complete=svg.querySelector('#room-complete');
    if(complete?.lastElementChild)candidates.push(complete.lastElementChild);
  }
  const media=matchMedia('(prefers-reduced-motion: reduce)'),descriptors=[],wrappers=[],restore=[];
  let animations=[],stopped=paused,disposed=false;
  let strength=Math.max(.25,Math.min(1.5,Number(intensity)||1));
  const frames=(steps,gain)=>steps.map(([offset,rotation=0,x=0,y=0])=>({offset,transform:`translate(${x*gain}px,${y*gain}px) rotate(${rotation*gain}deg)`}));
  for(const [index,character]of candidates.entries()){
    character.dataset.character=room;
    const b=character.getBBox(),cx=b.x+b.width/2,feet=b.y+b.height;
    restore.push([character,character.getAttribute('style')]);
    character.style.transformBox='view-box';character.style.transformOrigin=`${cx}px ${feet}px`;
    descriptors.push({target:character,kind:'sway',id:`character-${room}-${index}-sway`,frames:gain=>frames([[0,0],[.25,2.5],[.5,0],[.75,-2.5],[1,0]],gain),duration:room==='zibi'?4200:3800});
    const active=room==='workki'
      ? [[0,0],[.12,-2,0,1],[.26,3,0,-4],[.4,0],[.53,-2,0,-3],[.7,1.5],[.84,0],[1,0]]
      : room==='zibi'
        ? [[0,0],[.18,-7,-3,-2],[.34,-3,-1,-5],[.52,7,3,-2],[.7,3,1,-4],[.88,0],[1,0]]
        : [[0,0],[.08,-2,0,2],[.2,-5,-2,-12],[.32,0],[.4,2,0,2],[.52,5,2,-9],[.65,0],[.77,7],[.9,0],[1,0]];
    descriptors.push({target:character,kind:'active',id:`character-${room}-${index}-active`,frames:gain=>frames(active,gain),duration:room==='workki'?2600:room==='zibi'?3200:3000});
    if(room==='workki'&&character.children.length===70){
      const children=[...character.children],headBox=children[0].getBBox(),hx=headBox.x+headBox.width/2,hy=headBox.y+headBox.height-4;
      const runs=[[0,9],[28,34],[57,60],[69,69]];
      for(const [run,[first,last]]of runs.entries()){
        const group=document.createElementNS(NS,'g');group.dataset.characterPart='head';
        character.insertBefore(group,children[first]);
        for(let n=first;n<=last;n++)group.append(children[n]);
        group.style.transformBox='view-box';group.style.transformOrigin=`${hx}px ${hy}px`;
        wrappers.push(group);
        descriptors.push({target:group,kind:'nod',id:`character-${room}-${index}-nod-${run}`,duration:3000,frames:gain=>frames([[0,0],[.15,0],[.34,7],[.52,-3],[.7,4],[.85,0],[1,0]],gain)});
        descriptors.push({target:group,kind:'active',id:`character-${room}-${index}-head-active-${run}`,duration:2600,frames:gain=>frames([[0,0],[.12,-3],[.26,10],[.4,-4],[.53,8],[.7,-2],[.84,0],[1,0]],gain)});
      }
    } else {
      // A small whole-body bow keeps the original unsplit face/body artwork intact.
      // This is deliberately labelled as body motion rather than isolated head animation.
      descriptors.push({target:character,kind:'nod',id:`character-${room}-${index}-bow`,duration:3000,frames:gain=>frames([[0,0],[.16,0],[.37,8,0,1],[.56,-2],[.75,0],[1,0]],gain)});
    }
  }
  function rebuild(){
    animations.forEach(a=>a.cancel());animations=[];
    if(disposed||media.matches)return;
    const startTime=document.timeline.currentTime;
    for(const d of descriptors){
      const enabled=mode==='both'?(d.kind==='sway'||(room==='workki'&&d.kind==='nod')):d.kind===mode;
      if(!enabled)continue;
      const animation=d.target.animate(d.frames(strength),{duration:d.duration,iterations:Infinity,easing:'ease-in-out'});
      animation.id=d.id;animation.startTime=startTime;animations.push(animation);
    }
    sync();
  }
  function sync(){for(const animation of animations){const hidden=animation.effect.target.closest('[hidden]');if(stopped||document.hidden||hidden)animation.pause();else animation.play();}}
  function preferenceChanged(){rebuild();}
  document.addEventListener('visibilitychange',sync);media.addEventListener('change',preferenceChanged);
  const observer=new MutationObserver(sync);
  for(const node of [svg.querySelector('#room-start'),svg.querySelector('#room-complete')].filter(Boolean))observer.observe(node,{attributes:true,attributeFilter:['hidden']});
  rebuild();
  const cleanup=()=>{
    disposed=true;animations.forEach(a=>a.cancel());observer.disconnect();document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',preferenceChanged);
    for(const wrapper of wrappers){while(wrapper.firstChild)wrapper.before(wrapper.firstChild);wrapper.remove();}
    for(const [node,style]of restore){if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);delete node.dataset.character;}
  };
  cleanup.pause=()=>{stopped=true;sync();};cleanup.play=()=>{stopped=false;sync();};cleanup.setMode=next=>{mode=next;rebuild();};
  cleanup.setIntensity=value=>{strength=Math.max(.25,Math.min(1.5,Number(value)||1));rebuild();};
  cleanup.animations=()=>[...animations];cleanup.room=room;
  return cleanup;
}

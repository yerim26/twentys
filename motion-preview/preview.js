import {installCharacterMotion} from './shared/character-motion.js';
const NS='http://www.w3.org/2000/svg',controllers=[];let playing=true;
async function load(room){
 const response=await fetch(`./rooms/${room}.svg`);if(!response.ok)throw new Error(`${room} 캐릭터를 불러오지 못했습니다.`);
 const source=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
 const original=source.querySelector('#room-character > g');if(!original)throw new Error(`${room} 원본 캐릭터가 없습니다.`);
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${room} 움직임 시안`);
 const defs=source.querySelector('defs').cloneNode(true);
 // Only vector styles are needed for these figures; don't load game textures or duplicate IDs.
 for(const child of [...defs.children])if(child.tagName!=='style')child.remove();
 // Scope Illustrator classes so one character stylesheet cannot affect another room.
 const prefix=`preview-${room}-`;
 const style=defs.querySelector('style');if(style)style.textContent=style.textContent.replace(/\.cls-/g,`.${prefix}cls-`);
 const character=original.cloneNode(true);character.setAttribute('data-character-source','');
 for(const node of [character,...character.querySelectorAll('[class]')])if(node.hasAttribute('class'))node.setAttribute('class',node.getAttribute('class').split(/\s+/).map(c=>prefix+c).join(' '));
 svg.append(defs,character);document.querySelector(`[data-room="${room}"] .art`).append(svg);
 const b=character.getBBox(),pad=34;svg.setAttribute('viewBox',`${b.x-pad} ${b.y-pad} ${b.width+pad*2} ${b.height+pad*2}`);
 const controller=installCharacterMotion(svg,{room,mode:document.querySelector('#mode').value,intensity:Number(document.querySelector('#strength').value)/100});controllers.push(controller);
 return {room,paths:character.querySelectorAll('path,polygon,rect,line,circle,ellipse').length};
}
try{window.previewReport=await Promise.all(['workki','zibi','eddie'].map(load));document.querySelector('#status').textContent='세 캐릭터의 시안이 준비됐습니다.';}catch(error){document.querySelector('#status').textContent=error.message;console.error(error);}
document.querySelector('#mode').addEventListener('change',event=>controllers.forEach(c=>c.setMode(event.target.value)));
document.querySelector('#strength').addEventListener('input',event=>{document.querySelector('#strength-value').value=event.target.value+'%';controllers.forEach(c=>c.setIntensity(Number(event.target.value)/100));});
document.querySelector('#play').addEventListener('click',event=>{playing=!playing;controllers.forEach(c=>playing?c.play():c.pause());event.target.textContent=playing?'일시 정지':'재생';});
document.querySelector('#reset').addEventListener('click',()=>controllers.forEach(c=>c.animations().forEach(a=>a.currentTime=0)));
window.addEventListener('pagehide',()=>controllers.forEach(c=>c()),{once:true});
window.characterPreview={controllers};

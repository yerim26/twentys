// Grid geometry and artwork are independent: rectangular tiles never stretch icons.
export const BOARD = Object.freeze({ x:715.57, y:155.63, columns:6, rows:4, cellWidth:175, cellHeight:160, width:1050, height:640 });
export function footprint(item, rotation=0) {
  let cells=item.cells.map(p=>[...p]), width=item.width, height=item.height;
  for(let r=0;r<rotation/90;r++) {cells=cells.map(([x,y])=>[height-1-y,x]);[width,height]=[height,width];}
  return {cells,width,height};
}
const cache=new WeakMap();
export function artLayout(item, rotation=0) {
  if(!cache.has(item))cache.set(item,new Map());
  if(cache.get(item).has(rotation))return cache.get(item).get(rotation);
  const shape=footprint(item,rotation), width=shape.width*BOARD.cellWidth, height=shape.height*BOARD.cellHeight;
  const baseW=item.width*BOARD.cellWidth, baseH=item.height*BOARD.cellHeight;
  const angle=rotation*Math.PI/180, cos=Math.round(Math.cos(angle)),sin=Math.round(Math.sin(angle));
  const parts=(item.parts||[{id:`art-${item.id}`,box:item.art}]).map(part=>{
    const [x,y,w,h]=part.box;
    let cx=x+w/2,cy=y+h/2,tx,ty,regionW=width,regionH=height;
    if(part.cell) {
      let [col,row]=part.cell,cols=item.width,rows=item.height;
      for(let r=0;r<rotation/90;r++){[col,row]=[rows-1-row,col];[cols,rows]=[rows,cols];}
      tx=(col+.5)*BOARD.cellWidth;ty=(row+.5)*BOARD.cellHeight;
      regionW=BOARD.cellWidth;regionH=BOARD.cellHeight;
    } else {
      tx=width/2+(cx-baseW/2)*cos-(cy-baseH/2)*sin;
      ty=height/2+(cx-baseW/2)*sin+(cy-baseH/2)*cos;
    }
    const rotatedW=Math.abs(w*cos)+Math.abs(h*sin),rotatedH=Math.abs(w*sin)+Math.abs(h*cos);
    const scale=rotation===0?1:Math.min(1,(regionW-16)/rotatedW,(regionH-16)/rotatedH);
    if(rotation===0){tx=cx;ty=cy;}
    else {
      tx=Math.max(rotatedW*scale/2+4,Math.min(width-rotatedW*scale/2-4,tx));
      ty=Math.max(rotatedH*scale/2+4,Math.min(height-rotatedH*scale/2-4,ty));
    }
    return {id:part.id,scale,transform:`translate(${tx} ${ty}) rotate(${rotation}) scale(${scale}) translate(${-cx} ${-cy})`,bounds:[tx-rotatedW*scale/2,ty-rotatedH*scale/2,rotatedW*scale,rotatedH*scale]};
  });
  const left=Math.min(...parts.map(p=>p.bounds[0])),top=Math.min(...parts.map(p=>p.bounds[1]));
  const right=Math.max(...parts.map(p=>p.bounds[0]+p.bounds[2])),bottom=Math.max(...parts.map(p=>p.bounds[1]+p.bounds[3]));
  const result={...shape,pixelWidth:width,pixelHeight:height,parts,bounds:[left,top,right-left,bottom-top],centerX:(left+right)/2,centerY:(top+bottom)/2};
  cache.get(item).set(rotation,result);return result;
}
export function createGame(items) {
  const byId=new Map(items.map(i=>[i.id,i]));
  const initial=()=>({held:null,placements:{},rotations:Object.fromEntries(items.map(i=>[i.id,i.initialRotation||0]))});
  const canPlace=(state,id,col,row,rotation)=>{
    if(!byId.has(id)||!Number.isInteger(col)||!Number.isInteger(row))return false;
    const shape=footprint(byId.get(id),rotation);
    if(col<0||row<0||col+shape.width>6||row+shape.height>4)return false;
    const occupied=new Set();
    for(const [other,p]of Object.entries(state.placements))if(other!==id)for(const [x,y]of footprint(byId.get(other),p.rotation).cells)occupied.add(`${x+p.col},${y+p.row}`);
    return shape.cells.every(([x,y])=>!occupied.has(`${x+col},${y+row}`));
  };
  return {initial,canPlace,
    pickup(state,id){if(state.held||!byId.has(id))return state;const placements={...state.placements};delete placements[id];return {...state,placements,held:id};},
    rotate(state){return state.held?{...state,rotations:{...state.rotations,[state.held]:(state.rotations[state.held]+90)%360}}:state;},
    returnPiece(state){return state.held?{...state,held:null,rotations:{...state.rotations,[state.held]:byId.get(state.held).initialRotation||0}}:state;},
    place(state,x,y){if(!state.held)return state;const id=state.held,rotation=state.rotations[id],layout=artLayout(byId.get(id),rotation);
      const rawCol=(x-layout.centerX)/BOARD.cellWidth,rawRow=(y-layout.centerY)/BOARD.cellHeight;
      const col=Math.max(0,Math.min(6-layout.width,Math.round(rawCol))),row=Math.max(0,Math.min(4-layout.height,Math.round(rawRow)));
      if(Math.abs(rawCol-col)>.65||Math.abs(rawRow-row)>.65||!canPlace(state,id,col,row,rotation))return state;
      return {...state,held:null,placements:{...state.placements,[id]:{col,row,rotation}}};},
    complete:state=>!state.held&&Object.keys(state.placements).length===items.length
  };
}

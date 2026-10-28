// Pure free-placement rules. No DOM, animation or solution-position checks.
import { ITEMS, LEVEL, itemById } from './level.js';
export const createState = () => ({ held: null, placements: {}, rotations: Object.fromEntries(ITEMS.map(item => [item.id, item.initialRotation])) });
export function footprint(item, rotation) {
  let cells = item.cells.map(cell => [...cell]);
  let width = item.width, height = item.height;
  for (let turn = 0; turn < rotation / 90; turn++) {
    cells = cells.map(([col,row]) => [height - 1 - row, col]);
    [width,height] = [height,width];
  }
  return { cells, width, height };
}
// Rotate repeated folder icons at their own cell anchors, preserving each
// icon's proportions even though the board cells are wider than they are tall.
function partLayouts(item, rotation) {
  const angle = rotation*Math.PI/180, cos = Math.round(Math.cos(angle)), sin = Math.round(Math.sin(angle));
  return item.parts.map(part => {
    let [col,row] = part.cell, width = item.width, height = item.height;
    for (let turn = 0; turn < rotation/90; turn++) {
      [col,row] = [height-1-row,col];
      [width,height] = [height,width];
    }
    const sourceX = (part.cell[0]+.5)*LEVEL.cellWidth, sourceY = (part.cell[1]+.5)*LEVEL.cellHeight;
    const targetX = (col+.5)*LEVEL.cellWidth, targetY = (row+.5)*LEVEL.cellHeight;
    const [x,y,w,h] = part.art;
    const corners = [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([px,py]) => [
      targetX+(px-sourceX)*cos-(py-sourceY)*sin,
      targetY+(px-sourceX)*sin+(py-sourceY)*cos
    ]);
    const xs = corners.map(p=>p[0]), ys = corners.map(p=>p[1]);
    return { id:part.id, cell:[col,row],
      bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)],
      transform:`translate(${targetX} ${targetY}) rotate(${rotation}) translate(${-sourceX} ${-sourceY})` };
  });
}
// Artwork rotates without distortion. Tile footprints rotate separately.
export function artLayout(item, rotation) {
  const shape = footprint(item, rotation);
  const baseW = item.width * LEVEL.cellWidth, baseH = item.height * LEVEL.cellHeight;
  const width = shape.width * LEVEL.cellWidth, height = shape.height * LEVEL.cellHeight;
  if (item.parts) {
    const parts = partLayouts(item, rotation);
    const left = Math.min(...parts.map(p=>p.bounds[0])), right = Math.max(...parts.map(p=>p.bounds[0]+p.bounds[2]));
    const top = Math.min(...parts.map(p=>p.bounds[1])), bottom = Math.max(...parts.map(p=>p.bounds[1]+p.bounds[3]));
    return { ...shape, pixelWidth:width, pixelHeight:height, centerX:(left+right)/2, centerY:(top+bottom)/2,
      transform:'translate(0 0)', parts };
  }
  const dx = item.art[0] + item.art[2]/2 - baseW/2;
  const dy = item.art[1] + item.art[3]/2 - baseH/2;
  const angle = rotation * Math.PI/180;
  return { ...shape, pixelWidth: width, pixelHeight: height,
    centerX: width/2 + dx*Math.cos(angle) - dy*Math.sin(angle),
    centerY: height/2 + dx*Math.sin(angle) + dy*Math.cos(angle),
    transform: `translate(${width/2} ${height/2}) rotate(${rotation}) translate(${-baseW/2} ${-baseH/2})` };
}
export function pickUp(state, id) {
  if (state.held || !itemById(id)) return state;
  const placements = { ...state.placements }, prior = placements[id];
  delete placements[id];
  return { ...state, held: id, placements, rotations: { ...state.rotations, [id]: prior?.rotation ?? state.rotations[id] } };
}
export function rotateHeld(state) {
  if (!state.held) return state;
  return { ...state, rotations: { ...state.rotations, [state.held]: (state.rotations[state.held] + 90) % 360 } };
}
export function returnHeld(state) {
  if (!state.held) return state;
  const item = itemById(state.held);
  // The tray always shows the original inventory pose.
  return { ...state, held: null, rotations: { ...state.rotations, [item.id]: item.initialRotation } };
}
export function canPlace(state, id, col, row, rotation) {
  const item = itemById(id);
  if (!item || !Number.isInteger(col) || !Number.isInteger(row)) return false;
  const shape = footprint(item, rotation);
  if (col < 0 || row < 0 || col + shape.width > LEVEL.columns || row + shape.height > LEVEL.rows) return false;
  const occupied = new Set();
  for (const [otherId, placed] of Object.entries(state.placements)) {
    if (otherId === id) continue;
    for (const [c,r] of footprint(itemById(otherId), placed.rotation).cells) occupied.add(`${placed.col+c},${placed.row+r}`);
  }
  return shape.cells.every(([c,r]) => !occupied.has(`${col+c},${row+r}`));
}
// Slight imprecision snaps; far-away clicks cannot teleport onto the board.
export function snapPlacement(state, pointerX, pointerY) {
  if (!state.held || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return null;
  const item = itemById(state.held), rotation = state.rotations[item.id];
  const layout = artLayout(item, rotation);
  const rawCol = (pointerX - layout.centerX) / LEVEL.cellWidth;
  const rawRow = (pointerY - layout.centerY) / LEVEL.cellHeight;
  const col = Math.max(0, Math.min(LEVEL.columns - layout.width, Math.round(rawCol)));
  const row = Math.max(0, Math.min(LEVEL.rows - layout.height, Math.round(rawRow)));
  if (Math.abs(rawCol-col) > LEVEL.snapTolerance || Math.abs(rawRow-row) > LEVEL.snapTolerance) return null;
  return canPlace(state, item.id, col, row, rotation) ? { col, row, rotation } : null;
}
export function placeHeld(state, pointerX, pointerY) {
  const placement = snapPlacement(state, pointerX, pointerY);
  if (!placement) return state;
  return { ...state, held: null, placements: { ...state.placements, [state.held]: placement } };
}
export const isComplete = state => !state.held && Object.keys(state.placements).length === ITEMS.length;

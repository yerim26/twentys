import { ITEMS, LEVEL, itemById } from './level.js';
import { createState, pickUp, rotateHeld, returnHeld, placeHeld, footprint, artLayout, isComplete } from './game.js';
import { playPlacement, stopMotion } from './motion.js';

const svg = document.querySelector('#game-svg');
const $ = selector => svg.querySelector(selector);
const ns = 'http://www.w3.org/2000/svg';
const element = (tag, attributes = {}, children = []) => {
  const node = document.createElementNS(ns, tag);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key, value);
  node.append(...children);
  return node;
};
const use = (id, attributes = {}) => element('use', { href: `#${id}`, ...attributes });
const hide = (node, hidden) => node.toggleAttribute('hidden', hidden);
let state = createState();
let pointer = null;
let completionOpen = false;
let renderVersion = 0;

// The whole original tray, including its gaps, accepts a returned piece.
$('#inventory').prepend(element('rect', {
  id: 'inventory-drop-zone', x: 703, y: 1515, width: 1086, height: 145,
  fill: 'transparent', 'aria-hidden': 'true'
}));

function svgPoint(clientX, clientY) {
  return new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM().inverse());
}
function trackPointer(event) {
  pointer = { clientX: event.clientX, clientY: event.clientY };
  positionHeld();
}
function positionHeld() {
  if (!state.held || !pointer) return;
  const point = svgPoint(pointer.clientX, pointer.clientY);
  const layout = artLayout(itemById(state.held), state.rotations[state.held]);
  $('#held-item').setAttribute('transform', `translate(${point.x-layout.centerX} ${point.y-layout.centerY})`);
}

// Keep the supplied photograph continuous across all cells occupied by a piece.
for (const item of ITEMS) {
  const clip = element('clipPath', { id: `texture-clip-${item.id}`, clipPathUnits: 'userSpaceOnUse' });
  for (const [col,row] of item.cells) clip.append(element('rect', {
    x: col*LEVEL.cellWidth, y: row*LEVEL.cellHeight, width: LEVEL.cellWidth, height: LEVEL.cellHeight
  }));
  $('defs').append(clip);
  const preload = new Image();
  preload.src = `assets/backgrounds/${item.id}.jpeg`;
}
function textureTransform(item, rotation) {
  const w = LEVEL.cellWidth, h = LEVEL.cellHeight;
  return {
    0: 'matrix(1 0 0 1 0 0)',
    90: `matrix(0 ${h/w} ${-w/h} 0 ${item.height*w} 0)`,
    180: `matrix(-1 0 0 -1 ${item.width*w} ${item.height*h})`,
    270: `matrix(0 ${-h/w} ${w/h} 0 0 ${item.width*h})`
  }[rotation];
}
function renderPlaced(item, placed) {
  const origin = `translate(${LEVEL.x+placed.col*LEVEL.cellWidth} ${LEVEL.y+placed.row*LEVEL.cellHeight})`;
  const [x,y,width,height] = item.texture;
  const photograph = element('image', { href: `assets/backgrounds/${item.id}.jpeg`, x,y,width,height, preserveAspectRatio: 'none' });
  $('#board-textures').append(element('g', { 'data-texture': item.id, transform: origin }, [
    element('g', { transform: textureTransform(item, placed.rotation) }, [
      element('g', { 'clip-path': `url(#texture-clip-${item.id})` }, [photograph])
    ])
  ]));
  const group = element('g', { 'data-placed': item.id, transform: origin, role: 'button', tabindex: 0, 'aria-label': item.name });
  for (const [col,row] of footprint(item, placed.rotation).cells) group.append(element('rect', {
    x: col*LEVEL.cellWidth, y: row*LEVEL.cellHeight, width: LEVEL.cellWidth, height: LEVEL.cellHeight, fill: 'transparent'
  }));
  const orientation = artLayout(item, placed.rotation).transform;
  group.append(element('g', { class: 'piece-depth' }, [
    element('g', { class: 'piece-art' }, [
      element('g', { transform: orientation }, [use(`art-${item.id}`)])
    ]),
    element('g', { transform: orientation }, [use(`label-${item.id}`, { class: 'placed-label' })])
  ]));
  $('#placed-items').append(group);
}
function setCompletion(open) {
  completionOpen = open;
  hide($('#completion'), !open);
  for (const node of svg.querySelectorAll('#window [role="button"]')) node.setAttribute('tabindex', open ? -1 : 0);
  if (open) $('#next').focus();
}
function render(placedId = null) {
  const version = ++renderVersion;
  stopMotion($('#placed-items'));
  $('#board-textures').replaceChildren();
  $('#placed-items').replaceChildren();
  for (const item of ITEMS) {
    const placed = state.placements[item.id];
    const occupied = !!placed || state.held === item.id;
    const slot = $(`[data-item="${item.id}"]`);
    slot.classList.toggle('is-empty', occupied);
    slot.setAttribute('aria-disabled', occupied ? 'true' : 'false');
    const room = $(`#room-${item.id}`);
    if (!placed) stopMotion(room);
    hide(room, !placed);
    if (placed) renderPlaced(item, placed);
  }
  const count = Object.keys(state.placements).length;
  hide($('#board-lines'), count === 0);
  hide($('#progress-outline'), count === 0);
  $('#progress-count').textContent = count;
  $('#progress-fill').setAttribute('width', 243.73*count/ITEMS.length);
  if (!state.placements.towel) stopMotion($('#room-shelf'));
  hide($('#room-shelf'), !state.placements.towel);
  hide($('#intro-speech'), count > 0);
  hide($('#held-item'), !state.held);
  svg.classList.toggle('is-holding', !!state.held);
  $('#held-item').replaceChildren();
  if (state.held) {
    const layout = artLayout(itemById(state.held), state.rotations[state.held]);
    $('#held-item').append(element('g', { class: 'piece-art' }, [
      element('g', { transform: layout.transform }, [use(`art-${state.held}`)])
    ]));
    positionHeld();
  }
  setCompletion(false);
  if (placedId) {
    const rooms = [$(`#room-${placedId}`)];
    if (placedId === 'towel') rooms.push($('#room-shelf'));
    playPlacement($(`[data-placed="${placedId}"]`), rooms).then(() => {
      // A pickup, return or reset during the effect invalidates this completion.
      if (version === renderVersion && isComplete(state)) setCompletion(true);
    });
  } else if (isComplete(state)) setCompletion(true);
}
function activate(target, point) {
  if (target.closest('#next')) {
    setCompletion(false);
    $('#reset').focus();
    return;
  }
  if (completionOpen) return;
  if (target.closest('#reset')) {
    state = createState();
    render();
    return;
  }
  if (state.held) {
    if (target.closest('#inventory')) {
      state = returnHeld(state);
      render();
      return;
    }
    const placedId = state.held;
    const next = placeHeld(state, point.x-LEVEL.x, point.y-LEVEL.y);
    if (next !== state) { state = next; render(placedId); }
    return;
  }
  const piece = target.closest('[data-placed], [data-item]');
  if (!piece) return;
  const id = piece.dataset.placed || piece.dataset.item;
  if (piece.dataset.item && state.placements[id]) return;
  state = pickUp(state, id);
  render();
}
svg.addEventListener('click', event => {
  trackPointer(event);
  activate(event.target, svgPoint(event.clientX, event.clientY));
});
window.addEventListener('pointermove', trackPointer);
window.addEventListener('resize', positionHeld);
document.addEventListener('contextmenu', event => {
  if (!state.held || completionOpen) return;
  event.preventDefault();
  trackPointer(event);
  state = rotateHeld(state);
  render();
});
svg.addEventListener('keydown', event => {
  if (completionOpen && event.key === 'Tab') {
    event.preventDefault();
    $('#next').focus();
  }
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target.closest('[role="button"]');
  if (!target) return;
  event.preventDefault();
  const box = target.getBoundingClientRect();
  if (!state.held) pointer = { clientX: box.x+box.width/2, clientY: box.y+box.height/2 };
  const point = pointer ? svgPoint(pointer.clientX, pointer.clientY) : svgPoint(box.x+box.width/2, box.y+box.height/2);
  activate(target, point);
});
render();

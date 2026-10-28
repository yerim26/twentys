import { ITEMS, LEVEL, itemById } from './level.js';
import { createState, pickUp, rotateHeld, returnHeld, placeHeld, footprint, artLayout, isComplete } from './game.js';
import { popSpeech, settlePiece, stopMotion } from './motion.js';

const svg = document.querySelector('#game-svg');
const $ = selector => svg.querySelector(selector);
const ns = 'http://www.w3.org/2000/svg';
function element(tag, attributes = {}, children = []) {
  const node = document.createElementNS(ns, tag);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}
const use = id => element('use', { href: `#${id}` });
function artwork(item, rotation, className = '') {
  const layout = artLayout(item, rotation);
  const content = layout.parts
    ? layout.parts.map(part => element('g', { 'data-art-part':part.id, transform:part.transform }, [use(part.id)]))
    : [use(`art-${item.id}`)];
  return element('g', { class:className, transform:layout.transform }, content);
}
const hide = (node, hidden) => node.toggleAttribute('hidden', hidden);
let state = createState();
let pointer = null;
let lastDialogue = 'start';
let revision = 0;
let endingTimer;
let completionTimer;
let completionOpen = false;
const savedTabIndexes = new Map();

function setCompletion(open) {
  completionOpen = open;
  hide($('#completion'), !open);
  if (open) {
    for (const control of svg.querySelectorAll('[role="button"]')) {
      if (control.closest('#completion')) continue;
      savedTabIndexes.set(control, control.getAttribute('tabindex'));
      control.setAttribute('tabindex', '-1');
    }
    $('#completion-next').focus();
  } else {
    for (const [control, value] of savedTabIndexes) {
      if (value === null) control.removeAttribute('tabindex');
      else control.setAttribute('tabindex', value);
    }
    savedTabIndexes.clear();
  }
}

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

for (const item of ITEMS) {
  const clip = element('clipPath', { id: `texture-clip-${item.id}`, clipPathUnits: 'userSpaceOnUse' });
  for (const [col,row] of item.cells) clip.append(element('rect', {
    x: col*LEVEL.cellWidth, y: row*LEVEL.cellHeight, width: LEVEL.cellWidth, height: LEVEL.cellHeight
  }));
  $('defs').append(clip);
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
  $('#board-textures').append(element('g', { 'data-texture': item.id, transform: origin }, [
    element('g', { transform: textureTransform(item, placed.rotation) }, [
      element('g', { 'clip-path': `url(#texture-clip-${item.id})` }, [use(`photo-${item.id}`)])
    ])
  ]));
  const piece = element('g', { 'data-placed': item.id, transform: origin, role: 'button', tabindex: 0, 'aria-label': item.name });
  for (const [col,row] of footprint(item, placed.rotation).cells) piece.append(element('rect', {
    x: col*LEVEL.cellWidth, y: row*LEVEL.cellHeight, width: LEVEL.cellWidth, height: LEVEL.cellHeight, fill: 'transparent'
  }));
  piece.append(element('g', { class: 'piece-depth' }, [
    artwork(item, placed.rotation)
  ]));
  $('#placed-items').append(piece);
}
function showDialogue(id, animate = false) {
  lastDialogue = id;
  stopMotion($('#speech'));
  $('#speech-content').replaceChildren(use(`dialogue-${id}`));
  $('#speech').dataset.dialogue = id;
  if (animate) popSpeech($('#speech'));
}
function render(placedId = null) {
  const version = ++revision;
  clearTimeout(endingTimer);
  clearTimeout(completionTimer);
  setCompletion(false);
  stopMotion($('#placed-items'));
  $('#board-textures').replaceChildren();
  $('#placed-items').replaceChildren();
  for (const item of ITEMS) {
    const slot = $(`[data-item="${item.id}"]`);
    const occupied = !!state.placements[item.id] || state.held === item.id;
    hide(slot, item.available === false);
    hide(slot.querySelector('.tray-original'), occupied);
    hide(slot.querySelector('.tray-ghost'), !occupied);
    slot.setAttribute('aria-disabled', occupied ? 'true' : 'false');
    slot.setAttribute('tabindex', occupied ? '-1' : '0');
    if (state.placements[item.id]) renderPlaced(item, state.placements[item.id]);
  }
  const count = Object.keys(state.placements).length;
  // The original checkerboard stays visible beneath every unoccupied cell.
  // Picking up, rotating, and returning a piece never changes its background.
  hide($('#active-board'), count === 0);
  $('#progress-count tspan').textContent = `${count}/${ITEMS.length}`;
  const progressFill = $('#progress-fill');
  progressFill.setAttribute('width', Number(progressFill.dataset.fullWidth)*count/ITEMS.length);
  hide($('#progress-outline'), count === 0);
  hide($('#held-item'), !state.held);
  svg.classList.toggle('is-holding', !!state.held);
  $('#held-item').replaceChildren();
  if (state.held) {
    $('#held-item').append(artwork(itemById(state.held), state.rotations[state.held], 'held-art'));
    positionHeld();
  }
  if (placedId) {
    showDialogue($(`#dialogue-${placedId}`) ? placedId : 'start', true);
    settlePiece($(`[data-placed="${placedId}"]`));
    if (isComplete(state)) {
      // Let the final piece's line be read before the original ending line.
      endingTimer = setTimeout(() => {
        if (version !== revision || !isComplete(state)) return;
        showDialogue('finish', true);
        // Give the ending line three seconds before showing the source card.
        completionTimer = setTimeout(() => {
          if (version === revision && isComplete(state)) setCompletion(true);
        }, 3000);
      }, 1800);
    }
  } else if (lastDialogue === 'finish' && !isComplete(state)) showDialogue('start');
}
function activate(target, point) {
  if (target.closest('#completion-next')) {
    setCompletion(false);
    $('#reset').focus();
    return;
  }
  if (completionOpen) return;
  if (target.closest('#reset')) {
    state = createState();
    showDialogue('start');
    render();
    return;
  }
  if (state.held) {
    if (target.closest('#inventory')) {
      state = returnHeld(state);
      render();
      return;
    }
    const id = state.held;
    const next = placeHeld(state, point.x-LEVEL.x, point.y-LEVEL.y);
    if (next !== state) { state = next; render(id); }
    return;
  }
  const piece = target.closest('[data-placed], [data-item]');
  if (!piece) return;
  const id = piece.dataset.placed || piece.dataset.item;
  if (itemById(id)?.available === false || (piece.dataset.item && state.placements[id])) return;
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
    $('#completion-next').focus();
    return;
  }
  if (completionOpen && event.key === 'Escape') {
    event.preventDefault();
    setCompletion(false);
    $('#reset').focus();
    return;
  }
  if (event.key === 'Escape' && state.held) {
    event.preventDefault(); state = returnHeld(state); render(); return;
  }
  if (event.key.toLowerCase() === 'r' && state.held) {
    event.preventDefault(); state = rotateHeld(state); render(); return;
  }
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target.closest('[role="button"]');
  if (!target) return;
  event.preventDefault();
  const box = target.getBoundingClientRect();
  if (!state.held) pointer = { clientX: box.x+box.width/2, clientY: box.y+box.height/2 };
  activate(target, svgPoint(pointer.clientX, pointer.clientY));
});
render();

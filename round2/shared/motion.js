// Placement feedback is isolated from game rules and source SVG transforms.
// Durations and keyframes match the original Round 2 placement animation.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function stopPlacementMotion(root) {
  if (!root) return;
  for (const animation of root.getAnimations({ subtree: true })) animation.cancel();
}

function roomMotionTarget(room) {
  let target = [...room.children].find(child => child.hasAttribute('data-placement-pop'));
  if (!target) {
    target = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    target.setAttribute('data-placement-pop', '');
    // Keep the original SVG translation on the parent. Animating that parent
    // would override its source transform and make furniture jump offscreen.
    target.append(...room.childNodes);
    room.append(target);
    target.style.transformBox = 'fill-box';
    target.style.transformOrigin = 'center bottom';
  }
  return target;
}

export function playPlacement(piece, rooms) {
  if (reducedMotion.matches) return Promise.resolve();
  const animations = [];
  for (const room of rooms) {
    stopPlacementMotion(room);
    animations.push(roomMotionTarget(room).animate([
      { transform: 'translateY(5px) scale(0.78)', opacity: 0.5 },
      { transform: 'translateY(-1px) scale(1.055)', opacity: 1, offset: 0.64 },
      { transform: 'translateY(0) scale(1)', opacity: 1 }
    ], { duration: 300, easing: 'cubic-bezier(.2,.75,.3,1)' }));
  }
  const art = piece?.querySelector('.placed-art');
  if (art) {
    stopPlacementMotion(art);
    art.style.transformBox = 'fill-box';
    art.style.transformOrigin = 'center';
    animations.push(art.animate([
      { transform: 'translateY(-8px) scale(1.025)' },
      { transform: 'translateY(1px) scale(0.995)', offset: 0.7 },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)' }));
  }
  // Placed pieces intentionally keep no pickup shadow or outline.
  return Promise.allSettled(animations.map(animation => animation.finished));
}

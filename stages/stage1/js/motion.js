// Interaction effects are isolated from placement rules and source artwork.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function stopMotion(root) {
  for (const animation of root.getAnimations({ subtree: true })) animation.cancel();
}

export function playPlacement(piece, rooms) {
  if (reducedMotion.matches) return Promise.resolve();
  for (const room of rooms) stopMotion(room);
  const animations = [
    ...rooms.map(room => room.animate([
      { transform: 'translateY(5px) scale(0.78)', opacity: 0.5 },
      { transform: 'translateY(-1px) scale(1.055)', opacity: 1, offset: 0.64 },
      { transform: 'translateY(0) scale(1)', opacity: 1 }
    ], { duration: 300, easing: 'cubic-bezier(.2,.75,.3,1)' })),
    piece.querySelector('.piece-depth').animate([
      { transform: 'translateY(-8px) scale(1.025)' },
      { transform: 'translateY(1px) scale(0.995)', offset: 0.7 },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)' }),
    piece.querySelector('.piece-art').animate([
      { filter: 'drop-shadow(0px 9px 5px rgba(53,30,40,0.22))' },
      { filter: 'drop-shadow(0px 2px 1px rgba(53,30,40,0.16))' }
    ], { duration: 200, easing: 'ease-out' })
  ];
  return Promise.allSettled(animations.map(animation => animation.finished));
}

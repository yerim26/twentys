const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export function stopMotion(root) {
  for (const animation of root.getAnimations({ subtree: true })) animation.cancel();
}
export function popSpeech(bubble) {
  if (reducedMotion.matches) return;
  // Fixed SVG position. Only scale changes, anchored at the character's head.
  return bubble.animate([
    { transform: 'scale(.78, .02)', opacity: 0 },
    { transform: 'scale(1.035, 1.055)', opacity: 1, offset: .7 },
    { transform: 'scale(1, 1)', opacity: 1 }
  ], { duration: 1020, easing: 'cubic-bezier(.2,.75,.3,1)' });
}
export function settlePiece(piece) {
  if (reducedMotion.matches) return;
  return piece.querySelector('.piece-depth').animate([
    { transform: 'translateY(-7px) scale(1.02)' },
    { transform: 'translateY(1px) scale(.997)', offset: .72 },
    { transform: 'translateY(0) scale(1)' }
  ], { duration: 190, easing: 'cubic-bezier(.2,.7,.3,1)' });
}

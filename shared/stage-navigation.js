// Connect the existing completion button without editing the original round.
export function installStageNavigation(doc, onNext) {
  const next = doc.querySelector('#next');
  const completion = doc.querySelector('#completion');
  if (!next || !completion) return;
  const advance = event => {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (completion.hasAttribute('hidden')) return;
    event.preventDefault();
    event.stopPropagation();
    onNext();
  };
  next.addEventListener('click', advance);
  next.addEventListener('keydown', advance);
}

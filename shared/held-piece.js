// Shared pickup treatment. Installed by the stage host so Stage 1 source stays intact.
export function installHeldPieceAppearance(doc) {
  const svg = doc.querySelector('#game-svg');
  if (!svg || doc.querySelector('#held-piece-paper')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const node = (tag, attrs, children = []) => {
    const element = doc.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    element.append(...children);
    return element;
  };
  const paperRadius = 8;
  // Follow the silhouette in every direction instead of growing a square
  // around it. The small seed joins thin strokes; circular offsets keep the
  // paper gap even and turn sharp tips into gentle, rounded corners.
  const roundedMask = (radius, result) => {
    const offsets = Array.from({ length:24 }, (_, index) => {
      const angle = index*Math.PI/12;
      return node('feOffset', {
        in:'outline-seed', dx:((radius-1)*Math.cos(angle)).toFixed(4),
        dy:((radius-1)*Math.sin(angle)).toFixed(4), result:`${result}-${index}`
      });
    });
    return [...offsets,
      node('feMerge', { result:`${result}-joined` }, [
        node('feMergeNode', { in:'outline-seed' }),
        ...offsets.map((_,index)=>node('feMergeNode', { in:`${result}-${index}` }))
      ]),
      node('feGaussianBlur', { in:`${result}-joined`, stdDeviation:.4, result })
    ];
  };
  const filter = node('filter', {
    id: 'held-piece-paper', x: '-50%', y: '-100%', width: '200%', height: '300%',
    'color-interpolation-filters': 'sRGB', primitiveUnits:'userSpaceOnUse'
  }, [
    node('feMorphology', { in:'SourceAlpha', operator:'dilate', radius:1, result:'outline-seed' }),
    ...roundedMask(9.25, 'edge'),
    ...roundedMask(paperRadius, 'paper'),
    node('feFlood', { 'flood-color': '#000', result: 'ink' }),
    node('feComposite', { in: 'ink', in2: 'edge', operator: 'in', result: 'outline' }),
    node('feFlood', { 'flood-color': '#fff', result: 'white' }),
    node('feComposite', { in: 'white', in2: 'paper', operator: 'in', result: 'background' }),
    node('feMerge', {}, ['outline', 'background', 'SourceGraphic'].map(input => node('feMergeNode', { in: input }))),
    node('feDropShadow', { dx: 0, dy: 4, stdDeviation: 3, 'flood-color': '#351e28', 'flood-opacity': .18 })
  ]);
  svg.querySelector('defs').append(filter);
  const style = doc.createElement('style');
  style.textContent = '#held-item .piece-art, #held-item .held-art { filter: url(#held-piece-paper); }';
  doc.head.append(style);

  // Read the original artwork instead of imposing one border on both stages.
  // Convert its stroke into the filtered group's coordinates so the small
  // source normalization scale and pickup rotations are accounted for too.
  const held = doc.querySelector('#held-item');
  const matchArtworkStroke = () => {
    const art = held.querySelector('.piece-art, .held-art');
    const use = art?.querySelector('use');
    const source = doc.querySelector(use?.getAttribute('href') || ':not(*)');
    if (!source) return;
    const shape = [...source.querySelectorAll('path, rect, polygon, polyline, line, circle, ellipse')]
      .find(element => doc.defaultView.getComputedStyle(element).stroke !== 'none');
    if (!shape) return;
    const stroke = doc.defaultView.getComputedStyle(shape);
    const transform = art.getCTM().inverse().multiply(use.getCTM())
      .multiply(svg.getCTM().inverse()).multiply(shape.getCTM());
    const scale = Math.sqrt(Math.abs(transform.a*transform.d-transform.b*transform.c));
    const width = parseFloat(stroke.strokeWidth)*scale;
    filter.querySelector('[result="ink"]').setAttribute('flood-color', stroke.stroke);
    filter.querySelectorAll('feOffset[result^="edge-"]').forEach((offset, index) => {
      const angle = index*Math.PI/12;
      offset.setAttribute('dx', ((paperRadius+width-1)*Math.cos(angle)).toFixed(4));
      offset.setAttribute('dy', ((paperRadius+width-1)*Math.sin(angle)).toFixed(4));
    });
  };
  new doc.defaultView.MutationObserver(matchArtworkStroke).observe(held, { childList:true });
  matchArtworkStroke();
}

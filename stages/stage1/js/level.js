// Original reference coordinates are for rendering/comparison, never a placement rule.
export const LEVEL = Object.freeze({ columns: 6, rows: 4, x: 717.63, y: 798,
  width: 1057.05, height: 646.2, cellWidth: 1057.05 / 6, cellHeight: 646.2 / 4, snapTolerance: 0.65 });
export const ITEMS = [
  { id: 'towel', name: '수건', initialRotation: 270, width: 2, height: 3,
    cells: [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]], reference: [4,1],
    art: [54.49,40.68,242.74,410.65], texture: [-10.4248,-19.1165,371.1648,659.6244] },
  { id: 'toothpaste', name: '치약', initialRotation: 270, width: 1, height: 3,
    cells: [[0,0],[0,1],[0,2]], reference: [1,1],
    art: [26.18,91.61,123.82,320.19], texture: [-233.3402,-140.8531,528.192,660.24] },
  { id: 'basket', name: '바구니', initialRotation: 0, width: 2, height: 2,
    cells: [[0,0],[1,0],[0,1],[1,1]], reference: [2,2],
    art: [68.36,49.87,215.62,223.37], texture: [-171.4426,-15.4148,549.066,595.206] },
  { id: 'toothbrush', name: '칫솔', initialRotation: 270, width: 1, height: 3,
    cells: [[0,0],[0,1],[0,2]], reference: [0,1],
    art: [57.64,40.27,71.64,404.87], texture: [-131.1271,-538.1644,774.5664,1549.1328] },
  { id: 'soap', name: '비누', initialRotation: 270, width: 2, height: 1,
    cells: [[0,0],[1,0]], reference: [4,0],
    art: [61.33,24.26,229.54,89.82], texture: [-222.5343,-465.9224,774.5664,1376.5392] },
  { id: 'shower', name: '샤워헤드', initialRotation: 180, width: 4, height: 2,
    cells: [[0,0],[1,0],[2,0],[3,0],[2,1],[3,1]], reference: [0,0],
    art: [38.68,25.55,624.75,258.51], texture: [-24.6442,-276.2739,753.96,1130.94] }
];
export const itemById = id => ITEMS.find(item => item.id === id);

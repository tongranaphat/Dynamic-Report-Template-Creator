const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src', 'composables', 'useCanvas.js');
const dest = path.join(__dirname, 'src', 'composables', 'useCanvasLegacy.js');
const txt = fs.readFileSync(src, 'utf8');
const replaced = txt.replace('export function useCanvas() {', 'export function useCanvasLegacy() {');
fs.writeFileSync(dest, replaced);
console.log('Successfully copied and renamed to useCanvasLegacy.js');

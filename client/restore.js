const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync('git', ['show', 'HEAD:client/src/composables/useCanvas.js'], {
    cwd: path.resolve(__dirname, '..'), // Must be in root for "client/" path to exist in git tree
    encoding: 'utf8'
});

if (result.error) {
    console.error("Spawn Error:", result.error);
    process.exit(1);
}

if (result.status !== 0) {
    console.error("Git Error:", result.stderr);
    process.exit(1);
}

const content = result.stdout;

// Rename the export safely
const replaced = content.replace('export function useCanvas() {', 'export function useCanvasLegacy() {');

// Write out to useCanvasLegacy.js
fs.writeFileSync(path.join(__dirname, 'src', 'composables', 'useCanvasLegacy.js'), replaced);

console.log('Restored perfectly to useCanvasLegacy.js. Byte length:', replaced.length);

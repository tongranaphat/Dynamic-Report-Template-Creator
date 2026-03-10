const fs = require('fs');
const path = require('path');

const outFiles = [];
function walk(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
        if (f.name.startsWith('.') || f.name === 'node_modules' || f.name === 'dist') continue;
        const p = path.join(dir, f.name);
        if (f.isDirectory()) {
            walk(p);
        } else {
            outFiles.push(p.replace(/\\/g, '/'));
        }
    }
}

walk('.');
fs.writeFileSync('file_list.txt', outFiles.join('\n'));

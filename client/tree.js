const fs = require('fs');
const path = require('path');

function readDir(dir, level = 0) {
    const indent = '  '.repeat(level);
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const f of files) {
        if (f.name.startsWith('.') || f.name === 'node_modules' || f.name === 'dist') continue;
        console.log(indent + f.name);
        if (f.isDirectory() && level < 4) {
            readDir(path.join(dir, f.name), level + 1);
        }
    }
}

console.log('client/');
readDir('./');

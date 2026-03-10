const fs = require('fs');
const path = require('path');
const out = [];
function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        if (file === 'node_modules' || file === 'dist' || file.startsWith('.')) continue;
        const p = path.join(dir, file);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) walk(p);
        else out.push(p.replace(/\\/g, '/'));
    }
}
try {
    walk('.');
    fs.writeFileSync('output_files.txt', out.join('\n'));
    console.log('DONE');
    process.exit(0);
} catch (e) {
    console.error(e);
    process.exit(1);
}

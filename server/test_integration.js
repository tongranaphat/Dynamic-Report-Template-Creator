const fs = require('fs');
const path = require('path');

async function runTest() {
    try {
        console.log('Building payload...');
        const filePath = path.join(__dirname, 'dummy.png');
        const buf = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da636000020000050001e9fa650a0000000049454e44ae426082', 'hex');
        fs.writeFileSync(filePath, buf);

        const form = new FormData();
        form.append('file', new Blob([buf], { type: 'image/png' }), 'dummy.png');

        console.log('Fetching POST...');
        const res = await fetch('http://localhost:3000/api/upload-asset', {
            method: 'POST',
            body: form
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response body:', text);

        fs.unlinkSync(filePath);
    } catch (err) {
        console.error("Test failed:", err);
    }
}

runTest();

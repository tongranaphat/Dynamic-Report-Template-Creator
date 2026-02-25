const fs = require('fs');
const path = require('path');

async function runTest() {
    try {
        console.log('Creating a dummy image file...');
        const filePath = path.join(__dirname, 'dummy.png');
        // generate a tiny transparent 1x1 png array buffer
        const buf = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da636000020000050001e9fa650a0000000049454e44ae426082', 'hex');
        fs.writeFileSync(filePath, buf);

        const form = new FormData();
        form.append('file', new Blob([buf], { type: 'image/png' }), 'dummy.png');

        console.log('Sending POST request to /api/upload-asset...');
        const res = await fetch('http://localhost:3000/api/upload-asset', {
            method: 'POST',
            body: form
        });

        const data = await res.json();
        console.log('Upload response:', data);
        const url = data.url;
        if (!url || !url.includes('/api/assets/')) {
            throw new Error('Invalid URL in response');
        }

        console.log(`Sending GET request to ${url}...`);
        const getRes = await fetch(url);
        const downloadedBuf = await getRes.arrayBuffer();

        console.log(`Downloaded size: ${downloadedBuf.byteLength} bytes`);
        console.log('Content-Type:', getRes.headers.get('content-type'));

        if (downloadedBuf.byteLength === buf.length) {
            console.log('✅ Success: Upload and Download are working through DB!');
        } else {
            console.log('❌ Failure: Downloaded size does not match original.');
            console.log(buf.length);
        }

        // Cleanup
        fs.unlinkSync(filePath);
    } catch (e) {
        console.error('Test failed:', e);
    }
}

runTest();

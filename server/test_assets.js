const fs = require('fs');
const path = require('path');

async function testAssetsAPI() {
    try {
        console.log('1. Fetching all assets...');
        const res1 = await fetch('http://localhost:3000/api/assets');
        const assetsBefore = await res1.json();
        console.log(`Currently ${assetsBefore.length} assets in DB.`);

        console.log('2. Creating a dummy asset...');
        const filePath = path.join(__dirname, 'dummy2.png');
        const buf = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da636000020000050001e9fa650a0000000049454e44ae426082', 'hex');
        fs.writeFileSync(filePath, buf);

        const form = new FormData();
        form.append('file', new Blob([buf], { type: 'image/png' }), 'dummy2.png');

        const res2 = await fetch('http://localhost:3000/api/upload-asset', {
            method: 'POST',
            body: form
        });
        const uploadData = await res2.json();
        console.log('Upload response:', uploadData);
        fs.unlinkSync(filePath);

        const newId = uploadData.id;
        if (!newId) throw new Error("No ID returned from upload");

        console.log('3. Fetching all assets again to check if it appeared...');
        const res3 = await fetch('http://localhost:3000/api/assets');
        const assetsAfter = await res3.json();
        if (assetsAfter.length === assetsBefore.length + 1) {
            console.log("✅ Asset successfully added to list.");
        } else {
            console.log("❌ Asset NOT added to list.");
        }

        console.log(`4. Deleting asset ${newId}...`);
        const res4 = await fetch(`http://localhost:3000/api/assets/${newId}`, { method: 'DELETE' });
        const delRes = await res4.json();
        console.log('Delete response:', delRes);

        console.log('5. Fetching all assets one last time...');
        const res5 = await fetch('http://localhost:3000/api/assets');
        const assetsFinal = await res5.json();
        if (assetsFinal.length === assetsBefore.length) {
            console.log("✅ Asset successfully removed from list!");
        } else {
            console.log("❌ Asset NOT removed from list properly.");
        }

        process.exit(0);
    } catch (err) {
        console.error("Test failed:", err);
        process.exit(1);
    }
}

testAssetsAPI();

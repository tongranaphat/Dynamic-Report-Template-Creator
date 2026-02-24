const fs = require('fs');
const https = require('https');
const path = require('path');

const libsDir = path.join(__dirname, 'client', 'public', 'libs');

if (!fs.existsSync(libsDir)) {
    fs.mkdirSync(libsDir, { recursive: true });
}

const files = [
    { url: 'https://unpkg.com/pdf-lib/dist/pdf-lib.min.js', name: 'pdf-lib.min.js' },
    { url: 'https://unpkg.com/@pdf-lib/fontkit/dist/fontkit.umd.min.js', name: 'fontkit.umd.min.js' }
];

files.forEach(file => {
    const filePath = path.join(libsDir, file.name);
    const fileStream = fs.createWriteStream(filePath);
    https.get(file.url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
            https.get(response.headers.location, (redirectResponse) => {
                redirectResponse.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`Downloaded ${file.name}`);
                });
            });
        } else {
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Downloaded ${file.name}`);
            });
        }
    }).on('error', (err) => {
        console.error(`Error downloading ${file.name}: ${err.message}`);
    });
});

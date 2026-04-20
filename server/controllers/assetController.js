const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { asyncHandler } = require('../utils/errorHandler');
const prisma = require('../prismaClient');

const assetsDir = path.join(__dirname, '../uploads/assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, assetsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const uploadAsset = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadBackground = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filepath = `/uploads/assets/${req.file.filename}`;
    const fileUrl = `${req.protocol}://${req.get('host')}${filepath}`;

    const asset = await prisma.asset.create({
        data: {
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            filepath: filepath,
            url: fileUrl
        }
    });

    res.json({ url: fileUrl, id: asset.id });
});

const getAllAssets = asyncHandler(async (req, res) => {
    const assets = await prisma.asset.findMany({
        select: { id: true, filename: true, url: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
    });

    const formattedAssets = assets.map((asset) => ({
        url: asset.url,
        name: asset.filename,
        id: asset.id
    }));

    res.json(formattedAssets);
});

const deleteAssetFromDb = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existingAsset = await prisma.asset.findUnique({ where: { id } });

    if (!existingAsset) return res.status(404).json({ error: 'Asset not found' });

    try {
        const absolutePath = path.join(__dirname, '..', existingAsset.filepath);
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }
    } catch (err) {
        console.error('Error deleting physical file:', err);
    }

    await prisma.asset.delete({ where: { id } });
    res.json({ message: 'Asset deleted successfully' });
});

module.exports = {
    uploadAsset,
    uploadBackground,
    getAllAssets,
    deleteAssetFromDb
};

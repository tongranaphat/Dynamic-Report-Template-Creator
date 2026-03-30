const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { asyncHandler } = require('../utils/errorHandler');
const prisma = require('../prismaClient');

const assetStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../uploads/assets');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const uploadAsset = multer({ storage: assetStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const uploadBackground = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileData = req.file.buffer || fs.readFileSync(req.file.path);

    const asset = await prisma.asset.create({
        data: {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            data: fileData
        }
    });

    const fileUrl = `${req.protocol}://${req.get('host')}/api/assets/${asset.id}`;
    res.json({ url: fileUrl, id: asset.id });
});

const getAssetFromDb = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({ where: { id } });

    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    res.set({
        'Content-Type': asset.mimetype,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    res.end(asset.data);
});

const getAllAssets = asyncHandler(async (req, res) => {
    const assets = await prisma.asset.findMany({
        select: { id: true, filename: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
    });

    const formattedAssets = assets.map(asset => ({
        url: `${req.protocol}://${req.get('host')}/api/assets/${asset.id}`,
        name: asset.filename,
        id: asset.id
    }));

    res.json(formattedAssets);
});

const deleteAssetFromDb = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existingAsset = await prisma.asset.findUnique({ where: { id } });

    if (!existingAsset) return res.status(404).json({ error: 'Asset not found' });

    await prisma.asset.delete({ where: { id } });
    res.json({ message: 'Asset deleted successfully' });
});

module.exports = {
    uploadAsset,
    uploadBackground,
    getAssetFromDb,
    getAllAssets,
    deleteAssetFromDb
};
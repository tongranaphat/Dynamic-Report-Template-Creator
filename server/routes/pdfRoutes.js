const express = require('express');
const router = express.Router();

const {
    uploadBackground,
    generatePDF,
    upload,
    checkPdfType,
    getAssetFromDb,
    getAllAssets,
    deleteAssetFromDb,
    importPdfUrl,
    uploadPdf,
    getPdfById
} = require('../controllers/pdfController');

const { asyncHandler } = require('../utils/errorHandler');

router.post('/upload-bg', upload.single('file'), asyncHandler(uploadBackground));
router.post('/upload-asset', upload.single('file'), asyncHandler(uploadBackground));
router.post('/generate-pdf', asyncHandler(generatePDF));
router.post('/check-pdf-type', upload.single('image'), asyncHandler(checkPdfType));
router.get('/assets', asyncHandler(getAllAssets));
router.get('/assets/:id', asyncHandler(getAssetFromDb));
router.delete('/assets/:id', asyncHandler(deleteAssetFromDb));
router.post('/pdf/import-url', asyncHandler(importPdfUrl));

router.post('/pdf/upload', upload.single('file'), asyncHandler(uploadPdf));
router.get('/pdf/cache/:id', asyncHandler(getPdfById));

module.exports = router;
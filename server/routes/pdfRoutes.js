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
    autoImportUniversal,
    deletePdf,
    uploadPdf,
    getPdfById,
    savePdfState,
    importLocalPath
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
router.post('/pdf/auto-import', asyncHandler(autoImportUniversal));

router.post('/pdf/upload', upload.single('file'), asyncHandler(uploadPdf));
router.get('/pdf/cache/:id', asyncHandler(getPdfById));
router.delete('/pdf/cache/:id', asyncHandler(deletePdf));
router.post('/pdf/save-state', asyncHandler(savePdfState));
router.post('/pdf/import-local', asyncHandler(importLocalPath));

module.exports = router;
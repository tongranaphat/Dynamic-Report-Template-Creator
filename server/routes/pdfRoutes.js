const express = require('express');
const router = express.Router();
const { uploadBackground, generatePDF, upload, checkPdfType, getAssetFromDb, getAllAssets, deleteAssetFromDb } = require('../controllers/pdfController');
const { asyncHandler } = require('../utils/errorHandler');

// PDF and file upload routes
router.post('/upload-bg', upload.single('file'), asyncHandler(uploadBackground));
router.post('/upload-asset', upload.single('file'), asyncHandler(uploadBackground)); // Reuse logic for now
router.post('/generate-pdf', asyncHandler(generatePDF));
router.post('/check-pdf-type', upload.single('image'), asyncHandler(checkPdfType));
router.get('/assets', asyncHandler(getAllAssets));
router.get('/assets/:id', asyncHandler(getAssetFromDb));
router.delete('/assets/:id', asyncHandler(deleteAssetFromDb));

module.exports = router;

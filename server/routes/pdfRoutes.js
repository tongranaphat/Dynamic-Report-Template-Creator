const express = require('express');
const router = express.Router();

const {
    upload,
    generatePDF,
    checkPdfType,
    importPdfUrl,
    autoImportUniversal,
    deletePdf,
    uploadPdf,
    getPdfById,
    savePdfState,
    importLocalPath,
    saveGeneratedPdfState,
    prepareWorkspace,
    resetToOriginal,
    cleanupTempFile
} = require('../controllers/pdfController');

const { asyncHandler } = require('../utils/errorHandler');

router.get('/pdf/workspace/:id', asyncHandler(prepareWorkspace));
router.post('/pdf/reset/:id', asyncHandler(resetToOriginal));
router.post('/pdf/save-state', upload.single('pdfFile'), asyncHandler(savePdfState));

router.post('/generate-pdf', asyncHandler(generatePDF));
router.post('/check-pdf-type', upload.single('image'), asyncHandler(checkPdfType));
router.post('/pdf/import-url', asyncHandler(importPdfUrl));
router.post('/pdf/auto-import', asyncHandler(autoImportUniversal));

router.post('/pdf/upload', upload.single('file'), asyncHandler(uploadPdf));
router.get('/pdf/cache/:id', asyncHandler(getPdfById));
router.delete('/pdf/cache/:id', asyncHandler(deletePdf));
router.post('/pdf/import-local', asyncHandler(importLocalPath));
router.post('/pdf/save-generated-state', upload.single('pdfFile'), saveGeneratedPdfState);
router.post('/pdf/cleanup-temp/:id', asyncHandler(cleanupTempFile));
router.delete('/pdf/cleanup-temp/:id', asyncHandler(cleanupTempFile));
module.exports = router;

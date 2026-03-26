const express = require('express');
const router = express.Router();
const { saveReport, getReportById, getAllReports, deleteReport } = require('../controllers/reportInstanceController');
const { asyncHandler } = require('../utils/errorHandler');
const prisma = require('../prismaClient');

router.post('/report-instances', asyncHandler(saveReport));
router.get('/report-instances', asyncHandler(getAllReports));
router.get('/report-instances/:id', asyncHandler(getReportById));
router.put('/report-instances/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, pages, templateId, status } = req.body;

    const existing = await prisma.reportInstance.findUnique({ where: { id } });
    if (!existing) {
        res.status(404);
        throw new Error('Report instance not found');
    }

    const report = await prisma.reportInstance.update({
        where: { id },
        data: {
            name: name || existing.name,
            pages: pages || existing.pages,
            templateId: templateId !== undefined ? templateId : existing.templateId,
            status: status || existing.status,
            updatedAt: new Date()
        }
    });

    res.json(report);
}));
router.delete('/report-instances/:id', asyncHandler(deleteReport));

router.post('/save-report', asyncHandler(saveReport));

router.post('/reports', asyncHandler(saveReport));

router.get('/reports/:id', asyncHandler(getReportById));

router.get('/reports', asyncHandler(getAllReports));

router.delete('/reports/:id', asyncHandler(deleteReport));

module.exports = router;
const express = require('express');
const router = express.Router();
const { saveReport, getReportById, getAllReports, deleteReport } = require('../controllers/reportInstanceController');
const { asyncHandler } = require('../utils/errorHandler');
const prisma = require('../prismaClient');

// RESTful ReportInstance endpoints
// POST /api/report-instances - Create new report instance
router.post('/report-instances', asyncHandler(saveReport));

// GET /api/report-instances - Get all report instances
router.get('/report-instances', asyncHandler(getAllReports));

// GET /api/report-instances/:id - Get report instance by ID
router.get('/report-instances/:id', asyncHandler(getReportById));

// PUT /api/report-instances/:id - Update report instance
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

// DELETE /api/report-instances/:id - Delete report instance
router.delete('/report-instances/:id', asyncHandler(deleteReport));

// Legacy endpoints for backward compatibility
// Route สำหรับบันทึกงาน (Project) - ใช้กับปุ่ม "Save Project" และ Auto-save ก่อน Gen PDF
// POST /api/save-report
router.post('/save-report', asyncHandler(saveReport));

// Route สำหรับดึงข้อมูลงานตาม ID - ใช้ตอน Import PDF ที่เป็น Report กลับมาแก้
// Route สำหรับดึงข้อมูลงานตาม ID - ใช้ตอน Import PDF ที่เป็น Report กลับมาแก้
// GET /api/reports/:id
router.get('/reports/:id', asyncHandler(getReportById));

// Route สำหรับดึงข้อมูลงานทั้งหมด
// GET /api/reports
router.get('/reports', asyncHandler(getAllReports));

// Route สำหรับลบงาน (เผื่อไว้ใช้ในอนาคต)
// DELETE /api/reports/:id
router.delete('/reports/:id', asyncHandler(deleteReport));

module.exports = router;

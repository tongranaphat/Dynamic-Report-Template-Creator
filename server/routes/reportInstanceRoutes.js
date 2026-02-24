const express = require('express');
const router = express.Router();
const { saveReport, getReportById, getAllReports, deleteReport } = require('../controllers/reportInstanceController');
const { asyncHandler } = require('../utils/errorHandler');

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

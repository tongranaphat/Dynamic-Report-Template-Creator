// BUG-005 fix: all handlers wrapped with asyncHandler to prevent unhandled promise rejections
// BUG-019 fix: use shared prismaClient instead of creating new PrismaClient per-controller
const prisma = require('../prismaClient');
const { asyncHandler } = require('../utils/errorHandler');
const { saveValidTextContent, deleteTextFile } = require('../utils/textSaver');

// Save or Create Report Instance
const saveReport = asyncHandler(async (req, res) => {
    const { id, name, pages, templateId, status, projectData, filePath } = req.body;

    let report;

    // Extract data from projectData if available
    const finalName = name || (projectData?.name) || 'Untitled Report';
    const finalPages = pages || (projectData?.pages) || [];
    const finalTemplateId = templateId || (projectData?.templateId) || null;

    if (id) {
        // === CASE 1: มี ID ส่งมา = UPDATE งานเดิม ===
        const existing = await prisma.reportInstance.findUnique({ where: { id } });

        if (existing) {
            report = await prisma.reportInstance.update({
                where: { id },
                data: {
                    name: finalName,
                    pages: finalPages,
                    templateId: finalTemplateId,
                    status: status || 'DRAFT',
                    updatedAt: new Date()
                }
            });
        } else {
            report = await prisma.reportInstance.create({
                data: {
                    id: id,
                    name: finalName,
                    pages: finalPages,
                    templateId: finalTemplateId,
                    status: 'DRAFT'
                }
            });
        }
    } else {
        // === CASE 2: ไม่มี ID ส่งมา = CREATE งานใหม่ ===
        report = await prisma.reportInstance.create({
            data: {
                name: finalName,
                pages: finalPages,
                templateId: finalTemplateId,
                status: 'DRAFT'
            }
        });
    }

    if (report) {
        let bgUrl = null;
        if (report.templateId) {
            const tmpl = await prisma.template.findUnique({ where: { id: report.templateId } });
            if (tmpl) bgUrl = tmpl.background;
        }
        await saveValidTextContent(report.pages, 'report', report.id, report.name, bgUrl);
    }

    res.json(report);
});

// Get Report by ID
const getReportById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const report = await prisma.reportInstance.findUnique({
        where: { id },
        include: {
            template: {
                select: { name: true }
            }
        }
    });

    if (!report) {
        res.status(404);
        throw new Error('Report project not found');
    }

    res.json(report);
});

// Get All Reports
const getAllReports = asyncHandler(async (req, res) => {
    const reports = await prisma.reportInstance.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
            template: {
                select: { name: true }
            }
        }
    });
    res.json(reports);
});

// Delete Report
const deleteReport = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.reportInstance.findUnique({ where: { id } });
    if (!existing) {
        res.status(404);
        throw new Error('Report not found');
    }

    console.log(`[ReportController] Deleting report: ${id}, Name: ${existing.name}`);

    await prisma.reportInstance.delete({ where: { id } });

    console.log(`[ReportController] Triggering text file cleanup...`);
    await deleteTextFile('report', id, existing.name);

    res.json({ message: 'Report project deleted successfully', id });
});

module.exports = { saveReport, getReportById, getAllReports, deleteReport };

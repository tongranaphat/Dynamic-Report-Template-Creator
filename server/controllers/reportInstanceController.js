const prisma = require('../prismaClient');
const { asyncHandler } = require('../utils/errorHandler');

const saveReport = asyncHandler(async (req, res) => {
    const { id, name, pages, templateId, status, projectData, filePath, data, pdfUrl } = req.body;

    let report;

    const finalName = name || projectData?.name || 'Untitled Report';
    const finalPages = pages || projectData?.pages || [];
    const finalTemplateId = templateId || projectData?.templateId || null;

    if (id) {
        const existing = await prisma.reportInstance.findUnique({ where: { id } });

        if (existing) {
            report = await prisma.reportInstance.update({
                where: { id },
                data: {
                    name: finalName,
                    pages: finalPages,
                    templateId: finalTemplateId,
                    status: status || 'DRAFT',
                    data: data || undefined,
                    pdfUrl: pdfUrl || undefined,
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
                    status: 'DRAFT',
                    data: data || undefined,
                    pdfUrl: pdfUrl || undefined
                }
            });
        }
    } else {
        report = await prisma.reportInstance.create({
            data: {
                name: finalName,
                pages: finalPages,
                templateId: finalTemplateId,
                status: 'DRAFT',
                data: data || undefined,
                pdfUrl: pdfUrl || undefined
            }
        });
    }

    res.json(report);
});

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

const deleteReport = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.reportInstance.findUnique({ where: { id } });
    if (!existing) {
        res.status(404);
        throw new Error('Report not found');
    }

    const fs = require('fs');
    const pathMod = require('path');

    if (existing.pdfUrl) {
        const pdfAbsPath = pathMod.join(__dirname, '..', existing.pdfUrl);
        try {
            fs.unlinkSync(pdfAbsPath);
        } catch (e) {
            console.warn(`[deleteReport] Could not unlink pdfUrl ${pdfAbsPath}:`, e.message);
        }
    }

    await prisma.reportInstance.delete({ where: { id } });

    res.json({ message: 'Report project deleted successfully', id });
});

module.exports = { saveReport, getReportById, getAllReports, deleteReport };

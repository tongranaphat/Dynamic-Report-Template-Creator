const prisma = require('../prismaClient');
const { asyncHandler } = require('../utils/errorHandler');

const { saveValidTextContent, deleteTextFile } = require('../utils/textSaver');

const logger = {
    info: (message, ...args) => {
        console.info(`[TEMPLATE] ${new Date().toISOString()} - ${message}`, ...args);
    },
    error: (message, error) => {
        console.error(`[TEMPLATE ERROR] ${new Date().toISOString()} - ${message}`);
        if (error) {
            console.error('Error details:', error.message || error);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
    },
    warn: (message, ...args) => {
        console.warn(`[TEMPLATE WARN] ${new Date().toISOString()} - ${message}`, ...args);
    },
    success: (message, ...args) => {
        console.info(`[TEMPLATE] ${new Date().toISOString()} - ${message}`, ...args);
    }
};

const formatTemplate = (t) => {
    return {
        _id: t.id,
        id: t.id,
        name: t.name,
        background: t.background,
        pages: t.pages || [],
        isMaster: t.isMaster,
        ownerId: t.ownerId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
    };
};

const ensureUserExists = async (userId) => {
    if (!userId) return null;
    const user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            username: userId,
            password: 'REDACTED_CREDENTIAL'
        }
    });
    return user ? user.id : null;
};

const getVariables = asyncHandler(async (req, res) => {
    logger.info('Fetching variables');

    const variables = await prisma.variable.findMany({
        where: {
            OR: [{ scope: 'GLOBAL' }, { scope: 'USER' }]
        },
        orderBy: [
            { label: 'asc' }
        ]
    });

    if (variables.length === 0) {
        const mockVariables = [
            { id: '1', key: 'school_name', label: 'ชื่อโรงเรียน', scope: 'GLOBAL' },
            { id: '2', key: 'school_year', label: 'ปีการศึกษา', scope: 'GLOBAL' },
            { id: '3', key: 'student_name', label: 'ชื่อนักเรียน', scope: 'GLOBAL' },
            { id: '4', key: 'student_id', label: 'รหัสนักเรียน', scope: 'GLOBAL' },
            { id: '5', key: 'student_class', label: 'ชั้นเรียน', scope: 'GLOBAL' },
            { id: '6', key: 'teacher_name', label: 'ชื่อครู', scope: 'GLOBAL' },
            { id: '7', key: 'teacher_id', label: 'รหัสครู', scope: 'GLOBAL' },
            { id: '8', key: 'school_address', label: 'ที่อยู่โรงเรียน', scope: 'GLOBAL' },
            { id: '9', key: 'school_phone', label: 'เบอร์โทรศัพท์', scope: 'GLOBAL' },
            { id: '10', key: 'report_date', label: 'วันที่รายงาน', scope: 'GLOBAL' },
            { id: '11', key: 'report_title', label: 'ชื่อรายงาน', scope: 'GLOBAL' },
            { id: '12', key: 'semester', label: 'ภาคการศึกษา', scope: 'GLOBAL' },
            { id: '13', key: 'grade_level', label: 'ระดับชั้น', scope: 'GLOBAL' }
        ];

        const categorizedMockVariables = mockVariables.map(v => {
            let category = 'GENERAL';
            if (v.key.includes('student') || v.key.includes('school_year') || v.key.includes('student_class')) {
                category = 'STUDENT INFO';
            } else if (v.key.includes('teacher')) {
                category = 'TEACHER INFO';
            } else if (v.key.includes('school')) {
                category = 'SCHOOL INFO';
            } else if (v.key.includes('report')) {
                category = 'REPORT INFO';
            } else if (v.key.includes('semester') || v.key.includes('grade')) {
                category = 'ACADEMIC INFO';
            }
            return { ...v, category };
        });

        return res.json(categorizedMockVariables);
    }

    const categorizedVariables = variables.map(v => {
        let category = 'GENERAL';
        if (v.key.includes('student') || v.key.includes('school_year') || v.key.includes('student_class')) {
            category = 'STUDENT INFO';
        } else if (v.key.includes('teacher')) {
            category = 'TEACHER INFO';
        } else if (v.key.includes('school')) {
            category = 'SCHOOL INFO';
        } else if (v.key.includes('report')) {
            category = 'REPORT INFO';
        } else if (v.key.includes('semester') || v.key.includes('grade')) {
            category = 'ACADEMIC INFO';
        }
        return { ...v, category };
    });

    logger.success(`Retrieved ${categorizedVariables.length} variables`);
    res.json(categorizedVariables);
});

const getTemplates = asyncHandler(async (req, res) => {
    logger.info('Fetching templates');
    const { userId } = req.query;

    const whereCondition = {};
    if (userId) {
        whereCondition.OR = [{ ownerId: userId }, { ownerId: null }];
    }

    const templates = await prisma.template.findMany({
        where: whereCondition,
        orderBy: { updatedAt: 'desc' }
    });

    const formatted = templates.map(formatTemplate);
    logger.success(`Retrieved ${formatted.length} templates`);
    res.json(formatted);
});

const getTemplateById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const template = await prisma.template.findUnique({ where: { id } });

    if (!template) {
        res.status(404);
        throw new Error('Template not found');
    }

    res.json(formatTemplate(template));
});

const saveTemplate = asyncHandler(async (req, res) => {
    const { name, background, pages, userId } = req.body;

    logger.info(`Saving new template: ${name}`);

    let ownerId = null;
    if (userId) {
        ownerId = await ensureUserExists(userId);
    }

    const newTemplate = await prisma.template.create({
        data: {
            name: name,
            background: background,
            pages: pages,
            ownerId: ownerId,
            isMaster: true
        }
    });

    logger.success(`Template saved with ID: ${newTemplate.id}`);

    await saveValidTextContent(pages, 'template', newTemplate.id, name, background);

    res.send({ status: 'ok', id: newTemplate.id });
});

const updateTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, background, pages } = req.body;

    logger.info(`Updating template: ${id}`);

    const updated = await prisma.template.update({
        where: { id },
        data: {
            name,
            background,
            pages,
            updatedAt: new Date()
        }
    });

    logger.success(`Template updated: ${updated.id}`);

    await saveValidTextContent(pages, 'template', updated.id, name, background);

    res.json({ status: 'ok', id: updated.id });
});

const cloneTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;
    logger.info(`Cloning template: ${id}`);

    const original = await prisma.template.findUnique({ where: { id } });
    if (!original) {
        res.status(404);
        throw new Error('Template not found');
    }

    const newTemplate = await prisma.template.create({
        data: {
            name: `${original.name} (Copy)`,
            background: original.background,
            pages: original.pages,
            originTemplateId: original.id,
            ownerId: original.ownerId
        }
    });

    logger.success(`Template cloned: ${newTemplate.id}`);
    res.json({ status: 'ok', id: newTemplate.id });
});

const deleteTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const template = await prisma.template.findUnique({ where: { id } });

    if (!template) {
        res.status(404);
        throw new Error('Template not found');
    }

    const fs = require('fs');
    const pathMod = require('path');

    const safeName = (template.name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const textFilePath = pathMod.join(__dirname, '../uploads/texts/templates', `${safeName}_${id}.txt`);
    try {
        fs.unlinkSync(textFilePath);
    } catch (e) {
        console.warn(`[deleteTemplate] Could not unlink text file ${textFilePath}:`, e.message);
    }

    if (template.preview) {
        const previewPath = pathMod.join(__dirname, '..', template.preview);
        try {
            fs.unlinkSync(previewPath);
        } catch (e) {
            console.warn(`[deleteTemplate] Could not unlink preview ${previewPath}:`, e.message);
        }
    }

    await prisma.template.delete({ where: { id } });
    logger.success(`Template deleted: ${id}`);

    await deleteTextFile('template', id, template.name);

    res.json({ status: 'ok' });
});

const addVariable = asyncHandler(async (req, res) => {
    const { key, label } = req.body;
    const newVar = await prisma.variable.create({
        data: { key, label, scope: 'USER' }
    });
    res.json(newVar);
});

const seedDatabase = asyncHandler(async (req, res) => {
    try {
        logger.info('Checking database seed status...');
        const count = await prisma.variable.count();

        if (count === 0) {
            logger.info('Seeding default variables...');
            await prisma.variable.createMany({
                data: [
                    { key: 'school_name', label: 'ชื่อโรงเรียน', scope: 'GLOBAL' },
                    { key: 'school_year', label: 'ปีการศึกษา', scope: 'GLOBAL' },
                    { key: 'student_name', label: 'ชื่อนักเรียน', scope: 'GLOBAL' },
                    { key: 'student_id', label: 'รหัสนักเรียน', scope: 'GLOBAL' },
                    { key: 'class_level', label: 'ระดับชั้น', scope: 'GLOBAL' },
                    { key: 'gpa', label: 'เกรดเฉลี่ย', scope: 'GLOBAL' },
                    { key: 'teacher_name', label: 'ชื่อครูประจำชั้น', scope: 'GLOBAL' },
                    { key: 'date', label: 'วันที่ออกรายงาน', scope: 'GLOBAL' }
                ]
            });
            logger.success('Variables seeded successfully');
        } else {
            logger.info('Variables already exist. Skipping seed.');
        }
        res.json({ status: 'ok', message: 'Database seeded or already populated' });
    } catch (error) {
        logger.error('Seed database failed:', error);
        throw error;
    }
});

module.exports = {
    getVariables,
    getTemplates,
    getTemplateById,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    cloneTemplate,
    addVariable,
    seedDatabase
};

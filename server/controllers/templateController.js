// BUG-019 fix: use shared singleton to avoid connection pool exhaustion
const prisma = require('../prismaClient');
const { asyncHandler } = require('../utils/errorHandler');

const { saveValidTextContent, deleteTextFile } = require('../utils/textSaver');

// Enhanced logging utility
const logger = {
    info: (message, ...args) => {
        console.log(`[TEMPLATE] ${new Date().toISOString()} - ${message}`, ...args);
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
        console.log(`✅ [TEMPLATE] ${new Date().toISOString()} - ${message}`, ...args);
    }
};

// --- Helper: Format data for frontend ---
// แปลงข้อมูลจาก DB ให้ตรงกับที่ Frontend ต้องการ
const formatTemplate = (t) => {
    return {
        _id: t.id,
        id: t.id,
        name: t.name,
        background: t.background, // [Updated] ใช้ background ตาม Schema ใหม่
        pages: t.pages || [], // [Updated] ใช้ pages ตาม Schema ใหม่
        isMaster: t.isMaster,
        ownerId: t.ownerId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
    };
};

// BUG-012 fix: use upsert to eliminate race condition where two concurrent requests
// both pass the findUnique check before either creates the user, causing a unique constraint error.
const ensureUserExists = async (userId) => {
    if (!userId) return null;
    const user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            username: userId,
            password: 'auto-generated-password'
        }
    });
    return user ? user.id : null;
};

// 1. GET Variables
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

    // ถ้า DB ว่าง (รันครั้งแรก) ให้ส่ง Mock กลับไปก่อน
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

        // Add categories dynamically to mock variables
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

    // Add categories dynamically to database variables
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

// 2. GET Templates
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

// 3. GET Template By ID
const getTemplateById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const template = await prisma.template.findUnique({ where: { id } });

    if (!template) {
        res.status(404);
        throw new Error('Template not found');
    }

    res.json(formatTemplate(template));
});

// 4. SAVE Template (Create Master)
const saveTemplate = asyncHandler(async (req, res) => {
    // [Updated] Validated by Zod Middleware
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

    // Save text content as file
    // Save text content as file
    await saveValidTextContent(pages, 'template', newTemplate.id, name, background);

    res.send({ status: 'ok', id: newTemplate.id });
});

// 5. UPDATE Template
const updateTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;
    // [Updated] Validated by Zod Middleware
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

    // Save text content as file
    // Save text content as file
    await saveValidTextContent(pages, 'template', updated.id, name, background);

    res.json({ status: 'ok', id: updated.id });
});

// 6. CLONE Template
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

// 7. DELETE Template
const deleteTemplate = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Find before delete to get name for file cleanup
    const template = await prisma.template.findUnique({ where: { id } });

    if (!template) {
        res.status(404);
        throw new Error('Template not found');
    }

    await prisma.template.delete({ where: { id } });
    logger.success(`Template deleted: ${id}`);

    // Cleanup text file
    await deleteTextFile('template', id, template.name);

    res.json({ status: 'ok' });
});

// 8. ADD Variable
const addVariable = asyncHandler(async (req, res) => {
    const { key, label } = req.body;
    const newVar = await prisma.variable.create({
        data: { key, label, scope: 'USER' }
    });
    res.json(newVar);
});

// 9. Seed Database
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

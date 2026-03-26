const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get Variables
const getVariables = async (req, res) => {
    try {
        // ดึงตัวแปรทั้งหมด (หรือจะ filter ตาม user ก็ได้)
        const variables = await prisma.variable.findMany();

        // ถ้า Database ว่างเปล่า ให้ส่ง Default กลับไปก่อน (Frontend จะได้ไม่โล่ง)
        if (variables.length === 0) {
            return res.json([
                { key: 'school_name', label: 'ชื่อโรงเรียน', scope: 'GLOBAL', category: 'General' },
                { key: 'student_name', label: 'ชื่อนักเรียน', scope: 'GLOBAL', category: 'General' },
                { key: 'student_id', label: 'รหัสนักเรียน', scope: 'GLOBAL', category: 'General' },
                { key: 'year', label: 'ปีการศึกษา', scope: 'GLOBAL', category: 'General' }
            ]);
        }

        res.json(variables);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch variables' });
    }
};

// Add Variable
const addVariable = async (req, res) => {
    try {
        const { key, label, category } = req.body;
        const newVar = await prisma.variable.create({
            data: {
                key,
                label,
                scope: 'USER' // หรือรับค่า category มาใส่ถ้าใน schema มี field
            }
        });
        res.json(newVar);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add variable' });
    }
};

module.exports = { getVariables, addVariable };

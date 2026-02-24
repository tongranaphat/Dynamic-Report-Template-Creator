/**
 * Unified Seed File for Dynamic Report Creator
 * (Corrected for Schema Mismatches)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting Database Seeding...\n');

    try {
        // --------------------------------------------------------
        // 1. สร้าง/อัปเดต Global Variables
        // --------------------------------------------------------
        console.log('🌍 Seeding Global Variables...');
        const globalDefaults = [
            { key: 'school_name', label: 'ชื่อโรงเรียน' },
            { key: 'school_year', label: 'ปีการศึกษา' },
            { key: 'student_name', label: 'ชื่อนักเรียน' },
            { key: 'student_id', label: 'รหัสนักเรียน' },
            { key: 'class_level', label: 'ระดับชั้น' },
            { key: 'gpa', label: 'เกรดเฉลี่ย' },
            { key: 'teacher_name', label: 'ชื่อครูประจำชั้น' },
            { key: 'date', label: 'วันที่ออกรายงาน' }
        ];

        for (const v of globalDefaults) {
            const existing = await prisma.variable.findFirst({
                where: { key: v.key, scope: 'GLOBAL' }
            });

            if (!existing) {
                await prisma.variable.create({
                    data: {
                        key: v.key,
                        label: v.label,
                        scope: 'GLOBAL'
                    }
                });
            }
        }
        console.log('✅ Global variables processed.');

        // --------------------------------------------------------
        // 2. สร้าง Users
        // --------------------------------------------------------
        console.log('\n👤 Seeding Users...');

        const upsertUser = async (username, password) => {
            return await prisma.user.upsert({
                where: { username },
                update: {},
                create: { username, password }
            });
        };

        const adminUser = await upsertUser('admin', 'admin123');
        const teacherUser = await upsertUser('teacher1', 'teacher123');
        const studentUser = await upsertUser('student1', 'student123');

        console.log(`✅ Users ready: admin, teacher1, student1`);

        // --------------------------------------------------------
        // 3. สร้าง Templates (จุดที่เคย Error)
        // --------------------------------------------------------
        console.log('\n📄 Seeding Templates...');

        // ลบ Template เก่าที่เป็น Master (เพื่อป้องกันข้อมูลซ้ำตอน Dev)
        // await prisma.template.deleteMany({ where: { isMaster: true } });

        const templates = [];

        // Template 1: ใบรายงานผลการเรียน
        const gradeReport = await prisma.template.create({
            data: {
                name: 'ใบรายงานผลการเรียน (Master)',
                background: '/uploads/report-bg.jpg', // [CORRECTED] เปลี่ยนจาก backgroundUrl
                isMaster: true,
                ownerId: adminUser.id,
                // [CORRECTED] เปลี่ยนจาก layoutData เป็น pages ตาม Schema
                pages: {
                    objects: [
                        {
                            type: 'text',
                            left: 100,
                            top: 50,
                            text: 'ใบรายงานผลการเรียน',
                            fontSize: 24,
                            fontWeight: 'bold'
                        },
                        { type: 'text', left: 100, top: 120, text: 'ชื่อโรงเรียน: {{school_name}}', fontSize: 16 },
                        { type: 'text', left: 100, top: 150, text: 'ปีการศึกษา: {{school_year}}', fontSize: 16 },
                        { type: 'text', left: 100, top: 180, text: 'ชื่อนักเรียน: {{student_name}}', fontSize: 16 },
                        { type: 'text', left: 100, top: 210, text: 'รหัสนักเรียน: {{student_id}}', fontSize: 16 }
                    ]
                }
            }
        });
        templates.push(gradeReport);

        // Template 2: ใบคำร้องขอลาหยุด
        const leaveRequest = await prisma.template.create({
            data: {
                name: 'ใบคำร้องขอลาหยุด (Master)',
                background: '/uploads/leave-bg.jpg', // [CORRECTED]
                isMaster: true,
                ownerId: adminUser.id,
                pages: {
                    // [CORRECTED]
                    objects: [
                        {
                            type: 'text',
                            left: 150,
                            top: 80,
                            text: 'ใบคำร้องขอลาหยุด',
                            fontSize: 20,
                            fontWeight: 'bold'
                        },
                        { type: 'text', left: 100, top: 140, text: 'เรียน คุณครูผู้สอน', fontSize: 14 },
                        { type: 'text', left: 100, top: 170, text: 'ชื่อ: {{student_name}}', fontSize: 14 },
                        { type: 'text', left: 100, top: 200, text: 'รหัส: {{student_id}}', fontSize: 14 }
                    ]
                }
            }
        });
        templates.push(leaveRequest);

        // Template 3: ใบประกาศ
        const announcement = await prisma.template.create({
            data: {
                name: 'ใบประกาศ (Teacher Draft)',
                background: '/uploads/announcement-bg.jpg', // [CORRECTED]
                isMaster: false,
                ownerId: teacherUser.id,
                pages: {
                    // [CORRECTED]
                    objects: [
                        { type: 'text', left: 200, top: 100, text: 'ใบประกาศ', fontSize: 22, fontWeight: 'bold' },
                        { type: 'text', left: 100, top: 160, text: 'โรงเรียน: {{school_name}}', fontSize: 16 },
                        { type: 'text', left: 100, top: 190, text: 'ปีการศึกษา: {{school_year}}', fontSize: 16 }
                    ]
                }
            }
        });
        templates.push(announcement);

        console.log(`✅ Created ${templates.length} templates.`);

        // --------------------------------------------------------
        // 4. สร้าง Report Instances
        // --------------------------------------------------------
        console.log('\n📊 Seeding Report Instances...');

        await prisma.reportInstance.create({
            data: {
                name: 'ตัวอย่างรายงาน 1',
                templateId: gradeReport.id,
                // ownerId: studentUser.id, // Schema คุณไม่มี ownerId ใน ReportInstance (เช็คจากไฟล์ล่าสุด)
                status: 'COMPLETED',
                pdfUrl: '/uploads/reports/report-sample-64001.pdf',
                variableSnapshot: {
                    school_name: 'โรงเรียนตัวอย่าง',
                    school_year: '2567',
                    student_name: 'นายสมชาย ใจดี',
                    student_id: '64001'
                },
                pages: gradeReport.pages // [CORRECTED] ใช้ field 'pages' แทน dataJson
            }
        });
        console.log(`✅ Created sample report instances.`);

        // --------------------------------------------------------
        // 5. สร้าง User-specific Variables
        // --------------------------------------------------------
        console.log('\n🏷️ Seeding User-specific Variables...');

        const userVars = [
            { key: 'my_signature', label: 'ลายเซ็นของฉัน', ownerId: teacherUser.id },
            { key: 'classroom_room', label: 'เลขห้องเรียน', ownerId: teacherUser.id },
            { key: 'grade_level', label: 'ระดับชั้นที่ดูแล', ownerId: teacherUser.id }
        ];

        for (const v of userVars) {
            const existing = await prisma.variable.findFirst({
                where: { key: v.key, scope: 'USER', ownerId: v.ownerId }
            });

            if (!existing) {
                await prisma.variable.create({
                    data: {
                        key: v.key,
                        label: v.label,
                        scope: 'USER',
                        ownerId: v.ownerId
                    }
                });
            }
        }
        console.log(`✅ Created user-specific variables for ${teacherUser.username}.`);

        console.log('\n🎉 Seeding completed successfully!');
    } catch (error) {
        console.error('❌ Error during seeding:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();

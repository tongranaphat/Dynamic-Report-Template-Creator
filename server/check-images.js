const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findTemplatesWithMissingImages() {
    const templates = await prisma.template.findMany();
    templates.forEach(t => {
        let jsonStr = JSON.stringify(t);
        if (jsonStr.includes('1771390485327.png') || jsonStr.includes('1771390442018.gif')) {
            console.log(`Template ID: ${t.id}, Name: ${t.name} contains missing images.`);
        }
    });

    const reports = await prisma.reportInstance.findMany();
    reports.forEach(r => {
        let jsonStr = JSON.stringify(r);
        if (jsonStr.includes('1771390485327.png') || jsonStr.includes('1771390442018.gif')) {
            console.log(`ReportInstance ID: ${r.id}, Name: ${r.name} contains missing images.`);
        }
    });

    console.log('Finished checking database.');
}

findTemplatesWithMissingImages()
    .then(() => prisma.$disconnect())
    .catch(e => {
        console.error(e);
        prisma.$disconnect();
    });

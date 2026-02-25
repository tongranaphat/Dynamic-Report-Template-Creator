const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssetModel() {
    try {
        console.log("Checking Prisma Models Available:");
        const models = Object.keys(prisma).filter(k => !k.startsWith('_'));
        console.log("Models:", models);

        if (prisma.asset) {
            console.log("✅ SUCCESS: prisma.asset is DEFINED");
        } else {
            console.log("❌ ERROR: prisma.asset is UNDEFINED");
        }
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

checkAssetModel();

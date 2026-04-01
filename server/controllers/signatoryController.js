const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');

exports.getSignatories = async (req, res) => {
    try {
        const signatories = await prisma.signatory.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(signatories);
    } catch (error) {
        logger.error('Error fetching signatories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

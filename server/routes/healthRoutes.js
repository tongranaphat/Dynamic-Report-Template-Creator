const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/errorHandler');

router.get(
    '/health',
    asyncHandler(async (req, res) => {
        const healthCheck = {
            uptime: process.uptime(),
            message: 'OK',
            timestamp: Date.now(),
            environment: process.env.NODE_ENV || 'development',
            memory: process.memoryUsage(),
            version: process.version
        };

        try {
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            await prisma.$queryRaw`SELECT 1`;
            await prisma.$disconnect();
            healthCheck.database = 'connected';
        } catch (error) {
            healthCheck.database = 'disconnected';
            healthCheck.databaseError = error.message;
        }

        const statusCode = healthCheck.database === 'connected' ? 200 : 503;
        res.status(statusCode).json(healthCheck);
    })
);

router.get(
    '/info',
    asyncHandler(async (req, res) => {
        const systemInfo = {
            server: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid
            },
            environment: {
                NODE_ENV: process.env.NODE_ENV || 'development',
                PORT: process.env.PORT || 4010,
                CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173'
            },
            timestamp: new Date().toISOString()
        };

        res.json(systemInfo);
    })
);

module.exports = router;

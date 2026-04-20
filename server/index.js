const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const fs = require('fs');

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const templateRoutes = require('./routes/templateRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const reportInstanceRoutes = require('./routes/reportInstanceRoutes');
const healthRoutes = require('./routes/healthRoutes');
const assetRoutes = require('./routes/assetRoutes');
const signatoryRoutes = require('./routes/signatoryRoutes');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

app.use(
    cors({
        origin: function (origin, callback) {
            callback(null, true);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Machine-ID', 'Accept', 'Origin', 'X-Requested-With'],
        credentials: true,
        optionsSuccessStatus: 200
    })
);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(
    '/uploads',
    (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        next();
    },
    express.static(uploadsDir)
);

app.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Dynamic Report API is running perfectly! 🚀',
        endpoints: '/api'
    });
});

app.use('/api', healthRoutes);
app.use('/api', templateRoutes);
app.use('/api', pdfRoutes);
app.use('/api', reportInstanceRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api', signatoryRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
    try {
        await prisma.$connect();
        logger.success('Connected to Database');

        const PORT = process.env.PORT || 4010;

        server.listen(PORT, () => {
            logger.success(`Server running on port ${PORT}`);
            logger.info(`API Documentation: http://localhost:${PORT}/api`);
        });

        const shutdown = async () => {
            logger.info('Shutting down server...');
            await prisma.$disconnect();
            server.close(() => {
                logger.success('Server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

module.exports = { app, server };

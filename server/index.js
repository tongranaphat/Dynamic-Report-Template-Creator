const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
require('dotenv').config();

// Import Routes
const templateRoutes = require('./routes/templateRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const reportInstanceRoutes = require('./routes/reportInstanceRoutes'); // [เพิ่มใหม่]
const healthRoutes = require('./routes/healthRoutes');

// Initialize
const app = express();
const prisma = new PrismaClient();
const server = http.createServer(app); // สร้าง HTTP Server เพื่อใช้กับ Socket.io

// Setup Socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // อนุญาตทุก Origin (ปรับได้ตามความเหมาะสมใน Production)
        methods: ['GET', 'POST']
    }
});

// Logger Utility
const logger = require('./utils/logger');
const socketHandler = require('./sockets/socketHandler');

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) === -1) {
                const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                return callback(new Error(msg), false);
            }
            return callback(null, true);
        },
        credentials: true
    })
);
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve Static Files (สำหรับไฟล์ PDF ที่ Gen แล้ว)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
// Serve Static Files — with explicit CORS headers so fabric.Image.fromURL(crossOrigin:'anonymous')
// does not taint the canvas. Without this, canvas.toDataURL() throws SecurityError and images
// are completely blank in exported PDFs.
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(uploadsDir));


// Register Routes
app.use('/api', healthRoutes);
app.use('/api', templateRoutes);
app.use('/api', pdfRoutes);
app.use('/api', reportInstanceRoutes); // [ลงทะเบียน Route นี้]

// Error Handling Middleware
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io Logic (Real-time Collaboration)
socketHandler(io);

// Start Server Function
const startServer = async () => {
    try {
        // Test Database Connection
        await prisma.$connect();
        logger.success('Connected to Database');

        const PORT = process.env.PORT || 3000;

        // ใช้ server.listen แทน app.listen เพื่อให้ Socket.io ทำงานได้
        server.listen(PORT, () => {
            logger.success(`Server running on port ${PORT}`);
            logger.info(`API Documentation: http://localhost:${PORT}/api`);
        });

        // Graceful Shutdown
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

// Only start if run directly
if (require.main === module) {
    startServer();
}

module.exports = { app, server, prisma }; // Export for testing
// Rebooting dev server in LINE tab

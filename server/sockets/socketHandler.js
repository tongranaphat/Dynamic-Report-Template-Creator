const logger = require('../utils/logger');

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        logger.info(`User connected: ${socket.id}`);

        socket.on('join-room', (roomId) => {
            socket.join(roomId);
            logger.info(`Socket ${socket.id} joined room ${roomId}`);
        });

        socket.on('update-canvas', ({ roomId, data }) => {
            socket.to(roomId).emit('canvas-updated', data);
        });

        socket.on('disconnect', () => {
            logger.info(`User disconnected: ${socket.id}`);
        });
    });
};

module.exports = socketHandler;

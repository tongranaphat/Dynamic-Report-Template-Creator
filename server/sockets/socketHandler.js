const logger = require('../utils/logger');

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        logger.info(`User connected: ${socket.id}`);

        // Join room by ID (Template ID or Report ID)
        socket.on('join-room', (roomId) => {
            socket.join(roomId);
            logger.info(`Socket ${socket.id} joined room ${roomId}`);
        });

        // Receive update from Client and broadcast to others in the room
        socket.on('update-canvas', ({ roomId, data }) => {
            socket.to(roomId).emit('canvas-updated', data);
        });

        socket.on('disconnect', () => {
            logger.info(`User disconnected: ${socket.id}`);
        });
    });
};

module.exports = socketHandler;

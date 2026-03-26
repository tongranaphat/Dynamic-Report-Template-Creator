const { PrismaClient } = require('@prisma/client');

// Removing globalThis caching so that nodemon restarts pick up schema changes
const prisma = new PrismaClient();

module.exports = prisma;

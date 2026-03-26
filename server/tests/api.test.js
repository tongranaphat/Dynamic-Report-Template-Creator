const request = require('supertest');
const { app, prisma } = require('../index');

describe('API Integration Tests', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('GET /api/variables', () => {
        it('should return 200 and a list of variables', async () => {
            const res = await request(app).get('/api/variables');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /api/templates', () => {
        it('should return 200 and a list of templates', async () => {
            const res = await request(app).get('/api/templates');
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('POST /api/templates', () => {
        it('should reject invalid template (400) due to Zod validation', async () => {
            const res = await request(app).post('/api/templates').send({ background: 'no-name' });

            expect(res.statusCode).toBe(400);
            expect(res.body.status).toBe('error');
        });

        it('should create a valid template (200)', async () => {
            const res = await request(app).post('/api/templates').send({
                name: 'Integration Test Template',
                pages: []
            });

            expect(res.statusCode).toBe(200);
            expect(res.body.id).toBeDefined();

            if (res.body.id) {
                await request(app).delete(`/api/templates/${res.body.id}`);
            }
        });
    });
});

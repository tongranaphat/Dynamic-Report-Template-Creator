const express = require('express');
const router = express.Router();
const {
    getTemplates,
    getTemplateById,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    cloneTemplate,
    getVariables,
    addVariable,
    seedDatabase
} = require('../controllers/templateController');

// Validation Middleware
const { validate, Schemas } = require('../middleware/validationMiddleware');

// Variables
router.get('/variables', getVariables);
router.post('/variables', validate(Schemas.Variable), addVariable);

// Templates
router.get('/templates', getTemplates);
router.get('/templates/:id', getTemplateById);
router.post('/templates', validate(Schemas.Template), saveTemplate);
router.put('/templates/:id', validate(Schemas.UpdateTemplate), updateTemplate);
router.post('/templates/:id/clone', cloneTemplate);
router.delete('/templates/:id', deleteTemplate);

// Seed (Dev only - should probably be protected or removed in prod)
router.post('/seed', seedDatabase);

module.exports = router;

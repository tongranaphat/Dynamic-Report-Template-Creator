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

const { validate, Schemas } = require('../middleware/validationMiddleware');

router.get('/variables', getVariables);
router.post('/variables', validate(Schemas.Variable), addVariable);

router.get('/templates', getTemplates);
router.get('/templates/:id', getTemplateById);
router.post('/templates', validate(Schemas.Template), saveTemplate);
router.put('/templates/:id', validate(Schemas.UpdateTemplate), updateTemplate);
router.post('/templates/:id/clone', cloneTemplate);
router.delete('/templates/:id', deleteTemplate);

router.post('/seed', seedDatabase);

module.exports = router;

const express = require('express');
const router = express.Router();
const signatoryController = require('../controllers/signatoryController');

router.get('/signatories', signatoryController.getSignatories);

module.exports = router;

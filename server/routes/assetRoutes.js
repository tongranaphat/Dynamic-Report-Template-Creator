const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');

router.post('/upload', assetController.uploadAsset.single('file'), assetController.uploadBackground);
router.get('/', assetController.getAllAssets);
router.delete('/:id', assetController.deleteAssetFromDb);

module.exports = router;
const express = require('express');
const router = express.Router();
const masterDataController = require('../controllers/masterDataController');

router.get('/stores', masterDataController.getStores);
router.post('/stores', masterDataController.createStore);
router.put('/stores/:id', masterDataController.updateStore);
router.delete('/stores/:id', masterDataController.deleteStore);

router.get('/materials', masterDataController.getMaterials);
router.post('/materials', masterDataController.createMaterial);
router.put('/materials/:id', masterDataController.updateMaterial);
router.delete('/materials/:id', masterDataController.deleteMaterial);
router.get('/suppliers', masterDataController.getSuppliers);

module.exports = router;

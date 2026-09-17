const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Transaction Routes
router.post('/stock-in', inventoryController.recordStockIn);
router.post('/stock-out', inventoryController.recordStockOut);
router.post('/return', inventoryController.recordReturn);
router.post('/adjustment', inventoryController.recordAdjustment);

// Query Routes
router.get('/stock', inventoryController.getStoreStock);
router.get('/transactions', inventoryController.getTransactionHistory);

router.delete('/:id', inventoryController.deleteInventory);

module.exports = router;

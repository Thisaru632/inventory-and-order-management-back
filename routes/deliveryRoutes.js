const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

router.post('/', deliveryController.createDelivery);
router.get('/', deliveryController.getDeliveries);
router.put('/:id/status', deliveryController.updateDeliveryStatus);
router.delete('/:id', deliveryController.deleteDelivery);

module.exports = router;

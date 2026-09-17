const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const InventoryTransaction = require('../models/InventoryTransaction');
const Inventory = require('../models/Inventory');
const Material = require('../models/Material');
const Store = require('../models/Store');
const { convertToBaseUnit } = require('../utils/unitConverter');

exports.createDelivery = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerShopName, customerAddress, storeId, materialId, quantity, unit, notes, status } = req.body;

    if (!customerShopName || !storeId || !materialId || !quantity || !unit) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const store = await Store.findById(storeId).session(session);
    if (!store) throw new Error('Store not found');

    const material = await Material.findById(materialId).session(session);
    if (!material) throw new Error('Material not found');

    let convertedQuantity;
    try {
      convertedQuantity = convertToBaseUnit(material, unit, quantity);
    } catch (err) {
      throw new Error(err.message);
    }

    let inventory = await Inventory.findOne({ store: storeId, material: materialId }).session(session);
    if (!inventory || inventory.availableQuantity < convertedQuantity) {
      throw new Error('Insufficient stock available for delivery');
    }

    const delivery = new Delivery({
      customerShopName,
      customerAddress,
      store: storeId,
      material: materialId,
      quantity,
      unit,
      status: status || 'PENDING',
      notes
    });

    await delivery.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, message: 'Delivery created successfully', data: delivery });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getDeliveries = async (req, res) => {
  try {
    const { warehouseName } = req.query;
    let query = {};

    if (warehouseName) {
      const storeDoc = await Store.findOne({ name: warehouseName });
      if (storeDoc) {
        query.store = storeDoc._id;
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const deliveries = await Delivery.find(query)
      .populate('store')
      .populate('material')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.updateDeliveryStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { status, scheduledDate } = req.body;

    const delivery = await Delivery.findById(id).session(session);
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (status === 'DISPATCHED' && delivery.status === 'PENDING') {
      const material = await Material.findById(delivery.material).session(session);
      const convertedQuantity = convertToBaseUnit(material, delivery.unit, delivery.quantity);
      
      let inventory = await Inventory.findOne({ store: delivery.store, material: delivery.material }).session(session);
      if (!inventory || inventory.availableQuantity < convertedQuantity) {
        throw new Error('Insufficient stock available for dispatch');
      }

      const previousBalance = inventory.quantityInBaseUnit;
      const newBalance = previousBalance - convertedQuantity;
      inventory.quantityInBaseUnit = newBalance;
      await inventory.save({ session });

      const transaction = new InventoryTransaction({
        type: 'STOCK_OUT',
        store: delivery.store,
        material: delivery.material,
        quantity: delivery.quantity,
        unit: delivery.unit,
        convertedBaseQuantity: convertedQuantity,
        previousBalance,
        newBalance,
        reason: `Delivery Dispatch to ${delivery.customerShopName}`,
        referenceNumber: `DEL-${Date.now()}`
      });
      await transaction.save({ session });
      delivery.transactionRef = transaction._id;
    }

    delivery.status = status;
    if (scheduledDate) {
      delivery.scheduledDate = scheduledDate;
    }
    await delivery.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Status updated', data: delivery });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.deleteDelivery = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const delivery = await Delivery.findById(id).session(session);
    
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (delivery.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Delivery is already cancelled' });
    }

    // Revert stock only if it was dispatched
    if (delivery.status !== 'PENDING') {
      const material = await Material.findById(delivery.material).session(session);
      let convertedQuantity = convertToBaseUnit(material, delivery.unit, delivery.quantity);

      let inventory = await Inventory.findOne({ store: delivery.store, material: delivery.material }).session(session);
      if (inventory) {
        const previousBalance = inventory.quantityInBaseUnit;
        inventory.quantityInBaseUnit += convertedQuantity;
        await inventory.save({ session });

        const transaction = new InventoryTransaction({
          type: 'RETURN_IN',
          store: delivery.store,
          material: delivery.material,
          quantity: delivery.quantity,
          unit: delivery.unit,
          convertedBaseQuantity: convertedQuantity,
          previousBalance,
          newBalance: inventory.quantityInBaseUnit,
          reason: `Delivery Cancelled: ${delivery.customerShopName}`,
        });
        await transaction.save({ session });
      }
    }

    delivery.status = 'CANCELLED';
    await delivery.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Delivery cancelled and stock reverted' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

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
    const { customerShopName, customerAddress, items, storeId, materialId, quantity, unit, notes, status, scheduledDate } = req.body;

    if (!customerShopName) {
      return res.status(400).json({ success: false, message: 'Missing customer name' });
    }

    // Support multiple items: creates ONE single delivery order containing all items!
    if (items && Array.isArray(items) && items.length > 0) {
      const deliveryItems = [];
      let primaryStoreId = storeId || items[0].storeId;

      for (const item of items) {
        const iStoreId = item.storeId || primaryStoreId;
        const iMaterialId = item.materialId;
        const iQuantity = Number(item.quantity);
        const iUnit = item.unit;

        if (!iStoreId || !iMaterialId || !iQuantity || !iUnit) {
          throw new Error('Each item must specify store, material, quantity and unit');
        }

        const store = await Store.findById(iStoreId).session(session);
        if (!store) throw new Error('Store not found for selected item');

        const material = await Material.findById(iMaterialId).session(session);
        if (!material) throw new Error('Material not found for selected item');

        let convertedQuantity;
        try {
          convertedQuantity = convertToBaseUnit(material, iUnit, iQuantity);
        } catch (err) {
          throw new Error(err.message);
        }

        let inventory = await Inventory.findOne({ store: iStoreId, material: iMaterialId }).session(session);
        if (!inventory || inventory.availableQuantity < convertedQuantity) {
          throw new Error(`Insufficient stock for ${material.name} (Available: ${inventory ? inventory.availableQuantity : 0} ${material.baseUnit})`);
        }

        deliveryItems.push({
          material: iMaterialId,
          store: iStoreId,
          quantity: iQuantity,
          unit: iUnit,
          price: Number(item.price) || 0
        });
      }

      // Create ONE delivery document representing the whole multi-item order!
      const delivery = new Delivery({
        customerShopName,
        customerAddress,
        store: primaryStoreId,
        material: deliveryItems[0].material,
        quantity: deliveryItems[0].quantity,
        unit: deliveryItems[0].unit,
        items: deliveryItems,
        status: status || 'PENDING',
        scheduledDate: scheduledDate || undefined,
        notes: notes || 'Ordered via Customer Portal (Cart)'
      });

      await delivery.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({ 
        success: true, 
        message: 'Order placed successfully', 
        data: delivery 
      });
    }

    // Single item fallback
    if (!storeId || !materialId || !quantity || !unit) {
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
      items: [{
        material: materialId,
        store: storeId,
        quantity,
        unit,
        price: Number(req.body.price) || 0
      }],
      status: status || 'PENDING',
      scheduledDate: scheduledDate || undefined,
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
      const escaped = warehouseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const firstWord = escaped.split(' ')[0];
      const storeDoc = await Store.findOne({
        $or: [
          { name: warehouseName },
          { name: { $regex: new RegExp(`^${escaped}$`, 'i') } },
          { name: { $regex: new RegExp(firstWord, 'i') } }
        ]
      });
      if (storeDoc) {
        query.$or = [
          { store: storeDoc._id },
          { 'items.store': storeDoc._id }
        ];
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const deliveries = await Delivery.find(query)
      .populate('store')
      .populate('material')
      .populate('items.material')
      .populate('items.store')
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
    const { status, scheduledDate, feedback } = req.body;

    const delivery = await Delivery.findById(id).session(session);
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (status === 'DISPATCHED' && delivery.status === 'PENDING') {
      const itemsToDispatch = delivery.items && delivery.items.length > 0
        ? delivery.items
        : [{ material: delivery.material, store: delivery.store, quantity: delivery.quantity, unit: delivery.unit }];

      for (const item of itemsToDispatch) {
        const material = await Material.findById(item.material).session(session);
        const convertedQuantity = convertToBaseUnit(material, item.unit, item.quantity);
        
        let inventory = await Inventory.findOne({ store: item.store || delivery.store, material: item.material }).session(session);
        const available = inventory ? inventory.availableQuantity : 0;
        if (!inventory || available < convertedQuantity) {
          throw new Error(`Insufficient stock available for ${material?.name || 'item'} dispatch. Required: ${convertedQuantity} ${material?.baseUnit || item.unit}, Available: ${available} ${material?.baseUnit || item.unit}`);
        }

        const previousBalance = inventory.quantityInBaseUnit;
        const newBalance = previousBalance - convertedQuantity;
        inventory.quantityInBaseUnit = newBalance;
        await inventory.save({ session });

        const transaction = new InventoryTransaction({
          type: 'STOCK_OUT',
          store: item.store || delivery.store,
          material: item.material,
          quantity: item.quantity,
          unit: item.unit,
          convertedBaseQuantity: convertedQuantity,
          previousBalance,
          newBalance,
          reason: `Delivery Dispatch to ${delivery.customerShopName}`,
          referenceNumber: `DEL-${Date.now()}`
        });
        await transaction.save({ session });
        if (!delivery.transactionRef) {
          delivery.transactionRef = transaction._id;
        }
      }
    }

    if (status) {
      delivery.status = status;
    }
    if (scheduledDate) {
      delivery.scheduledDate = scheduledDate;
    }
    if (feedback) {
      delivery.feedback = {
        productRating: Number(feedback.productRating) || 0,
        sellerRating: Number(feedback.sellerRating) || 0,
        comment: feedback.comment || '',
        submittedAt: new Date()
      };
    }
    await delivery.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Status updated', data: delivery });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message || 'Server Error', error: error.message });
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
      const itemsToRevert = delivery.items && delivery.items.length > 0
        ? delivery.items
        : [{ material: delivery.material, store: delivery.store, quantity: delivery.quantity, unit: delivery.unit }];

      for (const item of itemsToRevert) {
        const material = await Material.findById(item.material).session(session);
        let convertedQuantity = convertToBaseUnit(material, item.unit, item.quantity);

        let inventory = await Inventory.findOne({ store: item.store || delivery.store, material: item.material }).session(session);
        if (inventory) {
          const previousBalance = inventory.quantityInBaseUnit;
          inventory.quantityInBaseUnit += convertedQuantity;
          await inventory.save({ session });

          const transaction = new InventoryTransaction({
            type: 'RETURN_IN',
            store: item.store || delivery.store,
            material: item.material,
            quantity: item.quantity,
            unit: item.unit,
            convertedBaseQuantity: convertedQuantity,
            previousBalance,
            newBalance: inventory.quantityInBaseUnit,
            reason: `Delivery Cancelled: ${delivery.customerShopName}`,
          });
          await transaction.save({ session });
        }
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

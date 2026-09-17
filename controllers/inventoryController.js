const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Material = require('../models/Material');
const Store = require('../models/Store');
const Supplier = require('../models/Supplier');
const { convertToBaseUnit } = require('../utils/unitConverter');

const processTransaction = async (req, res, transactionType) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { storeId, materialId, supplierId, quantity, unit, reason, referenceNumber, unitCost, unitSellingPrice, imageUrl } = req.body;

    // Validate inputs
    if (!storeId || !materialId || quantity === undefined || !unit) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const store = await Store.findById(storeId).session(session);
    if (!store) {
      throw new Error('Store not found');
    }

    const material = await Material.findById(materialId).session(session);
    if (!material) {
      throw new Error('Material not found');
    }

    let supplier = null;
    if (supplierId) {
      supplier = await Supplier.findById(supplierId).session(session);
      if (!supplier && (transactionType === 'STOCK_IN' || transactionType === 'RETURN_OUT')) {
         throw new Error('Supplier not found');
      }
    }

    // Convert quantity to base unit
    let convertedQuantity;
    try {
      convertedQuantity = convertToBaseUnit(material, unit, quantity);
    } catch (err) {
      throw new Error(err.message);
    }

    // Get current inventory
    let inventory = await Inventory.findOne({ store: storeId, material: materialId }).session(session);
    if (!inventory) {
      inventory = new Inventory({
        store: storeId,
        material: materialId,
        quantityInBaseUnit: 0,
        reservedQuantity: 0,
        availableQuantity: 0
      });
    }

    const previousBalance = inventory.quantityInBaseUnit;
    let newBalance = previousBalance;

    // Update balance based on transaction type
    if (transactionType === 'STOCK_IN' || transactionType === 'RETURN_IN') {
      newBalance += convertedQuantity;
    } else if (transactionType === 'STOCK_OUT' || transactionType === 'RETURN_OUT') {
      if (inventory.availableQuantity < convertedQuantity) {
        throw new Error('Insufficient stock available');
      }
      newBalance -= convertedQuantity;
    } else if (transactionType === 'ADJUSTMENT') {
       // adjustment quantity can be positive or negative
       newBalance += convertedQuantity; 
       if (newBalance < 0) {
          throw new Error('Adjustment would result in negative stock');
       }
    } else {
        throw new Error('Invalid transaction type');
    }

    // Save updated inventory
    inventory.quantityInBaseUnit = newBalance;
    if (unitCost !== undefined && unitCost !== '') inventory.unitCost = Number(unitCost);
    if (unitSellingPrice !== undefined && unitSellingPrice !== '') inventory.unitSellingPrice = Number(unitSellingPrice);
    if (imageUrl) inventory.imageUrl = imageUrl;
    await inventory.save({ session });

    // Record Transaction
    const transaction = new InventoryTransaction({
      type: transactionType,
      store: storeId,
      material: materialId,
      supplier: supplierId || null,
      quantity,
      unit,
      convertedBaseQuantity: convertedQuantity,
      previousBalance,
      newBalance,
      unitCost: unitCost !== undefined && unitCost !== '' ? Number(unitCost) : undefined,
      unitSellingPrice: unitSellingPrice !== undefined && unitSellingPrice !== '' ? Number(unitSellingPrice) : undefined,
      reason,
      referenceNumber
    });
    
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Transaction recorded successfully', data: transaction });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.recordStockIn = (req, res) => processTransaction(req, res, 'STOCK_IN');
exports.recordStockOut = (req, res) => processTransaction(req, res, 'STOCK_OUT');
exports.recordReturn = (req, res) => {
    // Assuming positive quantity for RETURN_IN, negative logic handled in client or separate routes. 
    // Here we'll expect req.body.returnType to be either 'RETURN_IN' or 'RETURN_OUT'
    const type = req.body.returnType || 'RETURN_IN';
    processTransaction(req, res, type);
};
exports.recordAdjustment = (req, res) => processTransaction(req, res, 'ADJUSTMENT');

exports.getStoreStock = async (req, res) => {
  try {
    const { storeId, materialId, lowStock, warehouseName } = req.query;
    let query = {};
    
    if (storeId) query.store = storeId;
    if (warehouseName) {
      const storeDoc = await Store.findOne({ name: warehouseName });
      if (storeDoc) {
        query.store = storeDoc._id;
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    }
    if (materialId) query.material = materialId;
    
    let inventory = await Inventory.find(query).populate('store').populate('material');

    if (lowStock === 'true') {
      inventory = inventory.filter(item => item.quantityInBaseUnit <= item.material.minStockAlert);
    }

    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const { storeId, type, startDate, endDate, page = 1, limit = 10, warehouseName } = req.query;
    let query = {};

    if (storeId) query.store = storeId;
    if (warehouseName) {
      const storeDoc = await Store.findOne({ name: warehouseName });
      if (storeDoc) {
        query.store = storeDoc._id;
      } else {
        return res.status(200).json({ success: true, data: [], pagination: { total: 0, page: 1, pages: 0 } });
      }
    }
    if (type) query.type = type;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await InventoryTransaction.find(query)
      .populate('store')
      .populate('material')
      .populate('supplier')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
      
    const total = await InventoryTransaction.countDocuments(query);

    res.status(200).json({ 
      success: true, 
      data: transactions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const inventoryItem = await Inventory.findByIdAndDelete(id);
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }
    res.status(200).json({ success: true, message: 'Inventory record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

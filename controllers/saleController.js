const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Material = require('../models/Material');
const Store = require('../models/Store');
const { convertToBaseUnit } = require('../utils/unitConverter');

exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      storeId, 
      items, 
      customerName, 
      customerPhone, 
      paymentMethod, 
      amountPaid, 
      changeGiven, 
      notes, 
      cashierId, 
      cashierName 
    } = req.body;

    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Store and at least one item are required for billing' });
    }

    const store = await Store.findById(storeId).session(session);
    if (!store) {
      throw new Error('Store / Warehouse not found');
    }

    // Generate unique invoice number: INV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${randStr}`;

    const processedItems = [];
    let grandTotal = 0;

    for (const item of items) {
      const { materialId, quantity, unit, unitPrice } = item;
      
      if (!materialId || !quantity || Number(quantity) <= 0 || !unit) {
        throw new Error('Each item must have a valid material, positive quantity, and unit');
      }

      const material = await Material.findById(materialId).session(session);
      if (!material) {
        throw new Error(`Material with ID ${materialId} not found`);
      }

      // Convert quantity to base unit
      let convertedBaseQty;
      try {
        convertedBaseQty = convertToBaseUnit(material, unit, Number(quantity));
      } catch (err) {
        throw new Error(`Unit conversion error for ${material.name}: ${err.message}`);
      }

      // Find store inventory record
      let inventory = await Inventory.findOne({ store: storeId, material: materialId }).session(session);
      const available = inventory ? inventory.availableQuantity : 0;

      if (!inventory || available < convertedBaseQty) {
        throw new Error(
          `Insufficient stock for "${material.name}". Required: ${convertedBaseQty} ${material.baseUnit}, Available: ${available} ${material.baseUnit}`
        );
      }

      // Deduct inventory physical stock
      const previousBalance = inventory.quantityInBaseUnit;
      const newBalance = previousBalance - convertedBaseQty;
      inventory.quantityInBaseUnit = newBalance;
      await inventory.save({ session });

      const price = Number(unitPrice) >= 0 ? Number(unitPrice) : (inventory.unitSellingPrice || 0);
      const subtotal = Number(quantity) * price;
      grandTotal += subtotal;

      // Create immutable STOCK_OUT transaction audit entry
      const transaction = new InventoryTransaction({
        type: 'STOCK_OUT',
        store: storeId,
        material: materialId,
        quantity: Number(quantity),
        unit,
        convertedBaseQuantity: convertedBaseQty,
        previousBalance,
        newBalance,
        unitSellingPrice: price,
        reason: `Cashier Sale: ${customerName || 'Walk-in Customer'}`,
        referenceNumber: invoiceNumber,
        createdBy: cashierId || undefined
      });
      await transaction.save({ session });

      processedItems.push({
        material: materialId,
        materialName: material.name,
        sku: material.sku,
        quantity: Number(quantity),
        unit,
        convertedBaseQuantity: convertedBaseQty,
        unitPrice: price,
        subtotal
      });
    }

    const sale = new Sale({
      invoiceNumber,
      store: storeId,
      cashier: cashierId || undefined,
      cashierName: cashierName || 'Cashier',
      customerName: customerName ? customerName.trim() : 'Walk-in Customer',
      customerPhone: customerPhone ? customerPhone.trim() : '',
      items: processedItems,
      totalAmount: grandTotal,
      paymentMethod: paymentMethod || 'Cash',
      amountPaid: amountPaid ? Number(amountPaid) : grandTotal,
      changeGiven: changeGiven ? Number(changeGiven) : 0,
      notes: notes || '',
      status: 'COMPLETED'
    });

    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate and return
    const populatedSale = await Sale.findById(sale._id)
      .populate('store', 'name code address')
      .populate('cashier', 'name email');

    res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      data: populatedSale
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create Sale Error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to complete sale' });
  }
};

exports.getSales = async (req, res) => {
  try {
    const { 
      warehouseName, 
      storeId, 
      cashierId, 
      search, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20 
    } = req.query;

    let query = {};

    if (storeId) {
      query.store = storeId;
    } else if (warehouseName && warehouseName !== 'All Warehouses') {
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
        query.store = storeDoc._id;
      } else {
        return res.status(200).json({ 
          success: true, 
          data: [], 
          pagination: { total: 0, page: 1, pages: 0 } 
        });
      }
    }

    if (cashierId) {
      query.cashier = cashierId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      const s = search.trim();
      query.$or = [
        { invoiceNumber: { $regex: s, $options: 'i' } },
        { customerName: { $regex: s, $options: 'i' } },
        { customerPhone: { $regex: s, $options: 'i' } },
        { cashierName: { $regex: s, $options: 'i' } }
      ];
    }

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('store', 'name code address')
      .populate('cashier', 'name email')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: sales,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get Sales Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching sales', error: error.message });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id)
      .populate('store', 'name code address manager phone')
      .populate('cashier', 'name email phone');

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale record not found' });
    }

    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

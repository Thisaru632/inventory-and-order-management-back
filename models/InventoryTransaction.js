const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['STOCK_IN', 'STOCK_OUT', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT'],
    required: true
  },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }, // Optional, mostly for STOCK_IN or RETURN_OUT
  quantity: { type: Number, required: true }, // in input unit
  unit: { type: String, required: true }, // unit used in transaction
  convertedBaseQuantity: { type: Number, required: true }, // calculated quantity in base units
  previousBalance: { type: Number, default: 0 }, // in base units
  newBalance: { type: Number, default: 0 }, // in base units
  unitCost: { type: Number },
  unitSellingPrice: { type: Number },
  reason: { type: String },
  referenceNumber: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Assuming a User model might exist later
}, { timestamps: true });

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);

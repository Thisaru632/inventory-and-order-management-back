const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  category: { type: String },
  baseUnit: { type: String, required: true }, // e.g., 'kg'
  conversions: [{
    unit: { type: String, required: true },
    multiplier: { type: Number, required: true } // e.g., unit: 'ton', multiplier: 1000 means 1 ton = 1000 baseUnits (kg)
  }],
  minStockAlert: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema);

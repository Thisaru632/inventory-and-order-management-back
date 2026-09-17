const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  quantityInBaseUnit: { type: Number, default: 0 },
  reservedQuantity: { type: Number, default: 0 },
  availableQuantity: { type: Number, default: 0 },
  unitCost: { type: Number, default: 0 },
  unitSellingPrice: { type: Number, default: 0 },
  imageUrl: { type: String }
}, { timestamps: true });

// Composite index to ensure a material has only one inventory record per store
inventorySchema.index({ store: 1, material: 1 }, { unique: true });

// Middleware to calculate available quantity
inventorySchema.pre('save', function () {
  this.availableQuantity = this.quantityInBaseUnit - this.reservedQuantity;
});

module.exports = mongoose.model('Inventory', inventorySchema);

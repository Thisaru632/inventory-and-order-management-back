const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  customerShopName: { type: String, required: true },
  customerAddress: { type: String },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'], default: 'PENDING' },
  scheduledDate: { type: Date },
  transactionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryTransaction' },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Delivery', deliverySchema);

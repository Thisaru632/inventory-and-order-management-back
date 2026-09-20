const mongoose = require('mongoose');

const deliveryItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  price: { type: Number, default: 0 }
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  customerShopName: { type: String, required: true },
  customerAddress: { type: String },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  // Single-item fallback fields for backward compatibility
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
  quantity: { type: Number },
  unit: { type: String },
  // Multi-item order items array
  items: [deliveryItemSchema],
  status: { type: String, enum: ['PENDING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'], default: 'PENDING' },
  scheduledDate: { type: Date },
  feedback: {
    productRating: { type: Number, min: 1, max: 5 },
    sellerRating: { type: Number, min: 1, max: 5 },
    comment: { type: String, default: '' },
    submittedAt: { type: Date }
  },
  transactionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryTransaction' },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Delivery', deliverySchema);


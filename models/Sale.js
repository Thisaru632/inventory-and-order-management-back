const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  materialName: { type: String, required: true },
  sku: { type: String },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  convertedBaseQuantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  subtotal: { type: Number, required: true }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cashierName: { type: String, default: 'Cashier' },
  customerName: { type: String, default: 'Walk-in Customer' },
  customerPhone: { type: String, default: '' },
  items: [saleItemSchema],
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['Cash', 'Card', 'Bank Transfer', 'Other'], default: 'Cash' },
  amountPaid: { type: Number, default: 0 },
  changeGiven: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['COMPLETED', 'REFUNDED', 'CANCELLED'], default: 'COMPLETED' }
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);

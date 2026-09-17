const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'System User' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'Staff' },
  warehouse: { type: String, default: 'All Warehouses' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  permissions: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

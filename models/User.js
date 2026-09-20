const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'System User' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  role: { type: String, default: 'Admin' },
  warehouse: { type: String, default: 'All Warehouses' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  permissions: [{ type: String }]
}, { timestamps: true });

// Pre-save hook: Hash password if modified
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  // If already hashed with bcrypt, do not re-hash
  if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare candidate password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return await bcrypt.compare(candidatePassword, this.password);
  }
  return candidatePassword === this.password;
};

module.exports = mongoose.model('User', userSchema);


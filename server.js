require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const inventoryRoutes = require('./routes/inventoryRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const authRoutes = require('./routes/authRoutes');
const User = require('./models/User');

const app = express();

// Connect Database
connectDB();

// Seed superadmin user
const seedSuperAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ email: 'superadmin@gmail.com' });
    if (!existingAdmin) {
      await User.create({ email: 'superadmin@gmail.com', password: '123456', role: 'superadmin' });
      console.log('Super admin seeded successfully');
    }
  } catch (err) {
    console.error('Failed to seed admin', err);
  }
};
seedSuperAdmin();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/master-data', require('./routes/masterDataRoutes'));
app.use('/api/auth', authRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server Error', error: err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

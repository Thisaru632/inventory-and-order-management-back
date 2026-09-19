require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const inventoryRoutes = require('./routes/inventoryRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const authRoutes = require('./routes/authRoutes');
const User = require('./models/User');

const app = express();

// Seed superadmin user
const seedSuperAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ email: 'superadmin@gmail.com' });
    if (!existingAdmin) {
      await User.create({ email: 'superadmin@gmail.com', password: '123456', role: 'Super Admin' });
      console.log('Super admin seeded successfully');
    }
  } catch (err) {
    console.error('Failed to seed admin', err);
  }
};

// Connect Database initially
connectDB().then(() => {
  seedSuperAdmin();
}).catch((err) => {
  console.error('Initial DB connection error:', err.message);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serverless DB connection middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed. Please ensure MONGODB_URI is set in Vercel environment variables and MongoDB Atlas allows 0.0.0.0/0.', 
      error: err.message 
    });
  }
});

// Root Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Tool Link Inventory Backend API is live' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Tool Link Inventory Backend API is live' });
});

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

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const inventoryRoutes = require('./routes/inventoryRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const authRoutes = require('./routes/authRoutes');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const app = express();

// Migrate existing unencrypted passwords in database
const migrateExistingPasswords = async () => {
  try {
    const users = await User.find({});
    const toMigrate = users.filter(u => u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$'));

    if (toMigrate.length > 0) {
      console.log(`Migrating ${toMigrate.length} user password(s) to encrypted format...`);
      for (const u of toMigrate) {
        const salt = await bcrypt.genSalt(10);
        u.password = await bcrypt.hash(u.password, salt);
        await u.save();
      }
      console.log('All existing passwords migrated successfully to encrypted format.');
    }
  } catch (err) {
    console.error('Password migration error:', err.message);
  }
};

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

let isMigrated = false;
const runMigrations = async () => {
  if (isMigrated) return;
  await migrateExistingPasswords();
  await seedSuperAdmin();
  isMigrated = true;
};

// Connect Database initially
connectDB().then(() => {
  runMigrations();
}).catch((err) => {
  console.error('Initial DB connection error:', err.message);
});

// Middleware
app.use(cors());

// Normalize URL if Vercel ever rewrites to /server.js
app.use((req, res, next) => {
  if (req.url.startsWith('/server.js')) {
    const rawPath = req.headers['x-forwarded-url'] || req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'];
    if (rawPath) {
      req.url = rawPath;
    }
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serverless DB connection middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    if (!isMigrated) {
      await runMigrations();
    }
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
app.use('/api/sales', require('./routes/saleRoutes'));

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

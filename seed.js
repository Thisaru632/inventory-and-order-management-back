const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Store = require('./models/Store');
const Material = require('./models/Material');
const Supplier = require('./models/Supplier');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'inventory_db' });
    console.log('MongoDB Connected for seeding');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedData = async () => {
  await connectDB();
  
  try {
    // Clear existing
    await Store.deleteMany();
    await Material.deleteMany();
    await Supplier.deleteMany();
    
    console.log('Data cleared');
    
    // Create Stores
    const stores = await Store.insertMany([
      { name: 'Main Warehouse', code: 'WH-01', address: '123 Main St' },
      { name: 'Site B Storage', code: 'SB-02', address: '456 Side Ave' }
    ]);
    
    // Create Materials
    const materials = await Material.insertMany([
      { name: 'Steel Beams', sku: 'STL-BM-001', category: 'Metals', baseUnit: 'ton', conversions: [{unit: 'kg', multiplier: 0.001}], minStockAlert: 10 },
      { name: 'Cement Bags', sku: 'CMT-BG-050', category: 'Building', baseUnit: 'kg', conversions: [{unit: 'ton', multiplier: 1000}], minStockAlert: 1000 },
      { name: 'Copper Wiring', sku: 'CPR-WR-100', category: 'Electrical', baseUnit: 'm', conversions: [], minStockAlert: 500 }
    ]);
    
    // Create Suppliers
    const suppliers = await Supplier.insertMany([
      { name: 'Acme Corp', contactPerson: 'John Doe', phone: '555-1234', email: 'john@acme.com', address: '789 Acme Blvd' },
      { name: 'Global Supplies', contactPerson: 'Jane Smith', phone: '555-5678', email: 'jane@globalsupplies.com', address: '101 Global Way' }
    ]);
    
    console.log('Seed data imported successfully');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedData();

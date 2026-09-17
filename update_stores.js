const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Store = require('./models/Store');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'inventory_db' });
    console.log('MongoDB Connected for store update');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const updateStores = async () => {
  await connectDB();
  
  try {
    // Delete all existing stores
    await Store.deleteMany({});
    console.log('Existing stores cleared');
    
    // Insert the three required locations
    await Store.insertMany([
      { name: 'Mahiyanganaya', code: 'LOC-MAH' },
      { name: 'Anuradhapura', code: 'LOC-ANU' },
      { name: 'Kurunagala', code: 'LOC-KUR' }
    ]);
    
    console.log('New locations successfully saved to the database');
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

updateStores();

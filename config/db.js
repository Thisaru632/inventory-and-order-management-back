const mongoose = require('mongoose');
const dns = require('dns');

// Fix for Node.js querySrv EBADRESP when ISP/local DNS fails on MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Continue with default DNS if custom DNS cannot be set
}

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('Error: MONGODB_URI is not defined. Please configure it in your .env file.');
      process.exit(1);
    }
    if (uri.includes('<db_password>')) {
      console.error('Error: Please replace "<db_password>" in your .env file with your actual MongoDB database password.');
      process.exit(1);
    }

    const conn = await mongoose.connect(uri, {
      dbName: 'inventory_db', // Provide a dbName to avoid writing to default 'test'
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

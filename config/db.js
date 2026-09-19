const mongoose = require('mongoose');
const dns = require('dns');

// Fix for Node.js querySrv EBADRESP on local ISP/Windows machines
// (Do NOT override DNS on Vercel, as AWS Lambda blocks external UDP port 53)
if (!process.env.VERCEL) {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  } catch (e) {
    // Continue with default DNS if custom DNS cannot be set
  }
}

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined. Please configure it in your environment variables.');
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  if (uri.includes('<db_password>')) {
    console.error('Error: Please replace "<db_password>" with your actual MongoDB database password.');
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw new Error('MongoDB password placeholder <db_password> must be replaced');
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: 'inventory_db',
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;

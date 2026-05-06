const mongoose = require('mongoose');

const connectDB = () => {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    return;
  }

  const options = {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    retryWrites: true,
    maxPoolSize: 10,
  };

  mongoose.connect(mongoUri, options)
    .then(() => {
      console.log('✅ Connected to MongoDB');
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
      console.log(`📝 MongoDB URI: ${mongoUri.replace(/:[^:]*@/, ':****@')}`);
      console.log('⏳ Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    setTimeout(connectDB, 5000);
  });
};

module.exports = connectDB;

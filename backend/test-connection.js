require('dotenv').config();
const mongoose = require('mongoose');

console.log('Connecting to:', process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 40) + '...' : 'NO URI');

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  .then(() => {
    console.log('CONNECTED OK');
    process.exit(0);
  })
  .catch(e => {
    console.error('FAIL:', e.message);
    process.exit(1);
  });

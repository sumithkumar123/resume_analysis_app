const mongoose = require('mongoose');

// Get MongoDB URI from command line argument or environment variable
const mongoURI = process.argv[2] || process.env.MONGODB_URI;

if (!mongoURI) {
    console.error('MongoDB URI must be provided either as a command line argument or in .env file');
    process.exit(1);
}

console.log('Using MongoDB URI:', mongoURI);


async function testConnection() {
    try {
        console.log('Attempting to connect with URI:', process.env.MONGODB_URI);
        await mongoose.connect(mongoURI);


        console.log('Successfully connected to MongoDB!');
        process.exit(0);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

testConnection();

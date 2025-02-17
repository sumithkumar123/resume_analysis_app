require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resume');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Parse JSON request bodies

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => {
      console.error('Could not connect to MongoDB:', err);
      process.exit(1); // Exit if cannot connect to DB
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);

// Basic 404 error handling (for unhandled routes)
app.use((req, res, next) => {
    res.status(404).send("Sorry, can't find that!");
});

// General error handling middleware (for catching other errors)
app.use((err, req, res, next) => {
    console.error(err.stack); // Log error stack trace to console
    res.status(500).send('Something broke!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

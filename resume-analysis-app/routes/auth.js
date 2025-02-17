const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
require('dotenv').config(); // Load .env in this file too

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Missing username or password' });
    }

    // Hardcoded credentials (for this assignment ONLY)
    if (username === 'naval.ravikant' && password === '05111974') {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ JWT: token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

module.exports = router;
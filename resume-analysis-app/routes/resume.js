// routes/resume.js
const express = require('express');
const router = express.Router();
const Applicant = require('../models/Applicant');
const authenticateToken = require('../utils/authMiddleware');
const { encryptData, decryptData } = require('../utils/encryption');
const { processResumeWithGemini } = require('../services/geminiService');

// #2. Resume Data Enrichment API
router.post('/enrich', authenticateToken, async (req, res) => {
    try {
        const { url, raw_text } = req.body;

        if (!raw_text) {
            return res.status(400).json({ error: 'Missing raw_text in request body' });
        }

        console.log("raw_text received in /enrich:", raw_text); // Log the raw text

        let geminiData;
        try {
            geminiData = await processResumeWithGemini(raw_text);
        } catch (geminiError) {
            // Gemini API error or parsing error
            return res.status(502).json({ error: 'Error processing resume with Gemini', details: geminiError.message }); // 502 Bad Gateway
        }

        if (!geminiData || Object.keys(geminiData).length === 0) {
            return res.status(404).json({ error: 'No data extracted from raw text' });
        }

        // The database schema now enforces name and email.  No need for extra validation *here*.

        const newApplicant = new Applicant(geminiData);
        await newApplicant.save();
        res.status(200).json({ message: 'Applicant data saved successfully' });

    } catch (error) {
        // Handle database errors and other unexpected errors
        console.error("Error in /enrich:", error);
        if (error.name === 'ValidationError') {
            // Mongoose validation error (e.g., missing required fields)
            return res.status(400).json({ error: 'Validation Error', details: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// #3. Resume Search API
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const encryptedName = req.body.name;
        if (!encryptedName) {
            return res.status(400).json({ error: 'Missing name in request body' });
        }
        const name = decryptData(encryptedName);

        // Use a regular expression for case-insensitive and token-agnostic search
        const applicants = await Applicant.find({ name: { $regex: new RegExp(name, 'i') } }).exec();

        if (!applicants || applicants.length === 0) {
            return res.status(404).json({ error: 'No matching records found' });
        }

        // Encrypt the name and email in the response
        const encryptedApplicants = applicants.map(applicant => {
            const { name, email, ...rest } = applicant.toObject(); // Destructure and get rest of fields
            return {
                ...rest, // Include other fields from the applicant
                name: encryptData(name),
                email: encryptData(email)
            };
        });
        res.status(200).json(encryptedApplicants);

    } catch (error) {
        console.error("Error in /search:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
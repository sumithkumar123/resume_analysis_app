


const express = require('express');
const router = express.Router();
const Applicant = require('../models/Applicant');
const authenticateToken = require('../utils/authMiddleware');
const { encryptData, decryptData } = require('../utils/encryption');

const { processResumeWithGemini } = require('../services/geminiService');

router.post('/enrich', authenticateToken, async (req, res) => {
    try {
        const { url, raw_text } = req.body;

        if (!raw_text) {
            return res.status(400).json({ error: 'Missing raw_text in request body' });
        }

        console.log("raw_text received in /enrich:", raw_text);

        let geminiData;
        try {
            geminiData = await processResumeWithGemini(raw_text);
        } catch (geminiError) {
            return res.status(502).json({ error: 'Error processing resume with Gemini', details: geminiError.message });
        }

        if (!geminiData || Object.keys(geminiData).length === 0) {
            return res.status(404).json({ error: 'No data extracted from raw text' });
        }


        const newApplicant = new Applicant(geminiData);
        await newApplicant.save();
        res.status(200).json({ message: 'Applicant data saved successfully' });

    } catch (error) {
        console.error("Error in /enrich:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: 'Validation Error', details: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/search', authenticateToken, async (req, res) => {
    try {
        const name = req.query.name;

        if (!name) {
            return res.status(400).json({ error: 'Missing name in query parameter' });
        }

        const applicants = await Applicant.find({ name: { $regex: new RegExp(name, 'i') } }).exec();

        if (!applicants || applicants.length === 0) {
            return res.status(404).json({ error: 'No matching records found' });
        }

        res.status(200).json(applicants);


    } catch (error) {
        console.error("Error in /search:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

const axios = require('axios');
const { RateLimiter } = require('limiter');

const limiter = new RateLimiter({ tokensPerInterval: 60, interval: 'minute' });

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + geminiApiKey;

// Helper for rate limiting and retries
async function makeRateLimitedRequest(requestFn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await limiter.removeTokens(1);
            return await requestFn();
        } catch (error) {
            if (error.response?.status === 429 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Rate limited. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}

async function processResumeWithGemini(rawText) {
    try {
        const prompt = `Extract the following information from the provided resume text and return it as a pure JSON object:
        {
            "name": "",
            "email": "",
            "education": {
                "degree": "",
                "branch": "",
                "institution": "",
                "year": null
            },
            "experience": {
                "job_title": "",
                "company": ""
            },
            "skills": [],
            "summary": ""
        }

        Resume Text:
        ${rawText}

        Return ONLY a valid JSON object, and nothing else.  Do not include any surrounding text. Do not include any markdown. Do not include any explanations.  Do not include any introductory phrases. If any information is not found, leave the corresponding field blank or null, as appropriate.  The summary should be a short description of the candidate's profile, generated based on the resume data.`;

        const response = await makeRateLimitedRequest(() => {
            return axios.post(geminiUrl, {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });
        });

        if (response.data.error) {
            console.error("Gemini API Error:", response.data.error);
            throw new Error("Error from Gemini API: " + response.data.error.message);
        }

        let generatedText;
        try {
            generatedText = response.data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error("Error extracting text from Gemini response:", error);
            console.log("Full Gemini response:", response.data);
            throw new Error("Failed to extract text from Gemini API response.");
        }

        console.log("Original Gemini response text:", generatedText);

         // --- Robust JSON Cleaning and Extraction ---
        let cleanedText = generatedText
            .replace(/`json|`/gi, '')  // Remove markdown (case-insensitive)
            .trim();                    // Remove leading/trailing whitespace

        // Remove all leading chars that are not { or [
        cleanedText = cleanedText.replace(/^[^\{\[]*/, '');

        // Remove trailing non-JSON characters.
        cleanedText = cleanedText.replace(/[^\]}]+$/, '');

        console.log("Cleaned text (before manual fix):", cleanedText);


        try {
            const parsedData = JSON.parse(cleanedText);
            return parsedData;
        } catch (parseError) {
            console.error("Failed to parse cleaned JSON, attempting manual fix:", parseError);

            let fixedText;
            try {
                // Extract substring between FIRST { and LAST }
                const firstBrace = cleanedText.indexOf('{');
                const lastBrace = cleanedText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                  fixedText = cleanedText.substring(firstBrace, lastBrace + 1);
                  console.log("Extracted JSON substring:", fixedText);
                }
                 else {
                    fixedText = ""; // Set to empty string if extraction fails
                    console.log("Could not extract valid JSON substring.");
                    return {}; // Return empty object
                }

                fixedText = fixedText
                    .replace(/(\w+):/g, '"$1":')  // Quote unquoted keys
                    .replace(/'/g, '"')          // Single quotes to double quotes
                    .replace(/,(\s*[\]}])/g, '$1') // Remove trailing commas
                    .replace(/^[^a-zA-Z0-9{\[]*/, "")// Remove leading non-JSON
                    .replace(/[^a-zA-Z0-9}\]]*$/, ""); // Remove trailing non-JSON

                console.log("Fixed text (before final parse):", fixedText);
                const parsedData = JSON.parse(fixedText);
                return parsedData;

            } catch (finalError) {
                console.error("Failed to parse even after manual fixes:", finalError);
                console.error("Fixed Text:", fixedText);
                // Return empty object.
                return {};
            }
        }
    } catch (error) {
        console.error("Error calling or processing Gemini API:", error);
        throw error; // Re-throw for consistent error handling in route
    }
}

module.exports = { processResumeWithGemini };
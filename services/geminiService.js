const axios = require('axios');
const { RateLimiter } = require('limiter');

const limiter = new RateLimiter({ tokensPerInterval: 60, interval: 'minute' });

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + geminiApiKey;

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

        let cleanedText = generatedText
            .replace(/`json|`/gi, '')  
            .trim();                   

        cleanedText = cleanedText.replace(/^[^\{\[]*/, '');

        cleanedText = cleanedText.replace(/[^\]}]+$/, '');

        console.log("Cleaned text (before manual fix):", cleanedText);


        try {
            const parsedData = JSON.parse(cleanedText);
            return parsedData;
        } catch (parseError) {
            console.error("Failed to parse cleaned JSON, attempting manual fix:", parseError);

            let fixedText;
            try {
                const firstBrace = cleanedText.indexOf('{');
                const lastBrace = cleanedText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                  fixedText = cleanedText.substring(firstBrace, lastBrace + 1);
                  console.log("Extracted JSON substring:", fixedText);
                }
                 else {
                    fixedText = ""; 
                    console.log("Could not extract valid JSON substring.");
                    return {}; 
                }

                fixedText = fixedText
                    .replace(/(\w+):/g, '"$1":') 
                    .replace(/'/g, '"')        
                    .replace(/,(\s*[\]}])/g, '$1')
                    .replace(/^[^a-zA-Z0-9{\[]*/, "")
                    .replace(/[^a-zA-Z0-9}\]]*$/, ""); 
                console.log("Fixed text (before final parse):", fixedText);
                const parsedData = JSON.parse(fixedText);
                return parsedData;

            } catch (finalError) {
                console.error("Failed to parse even after manual fixes:", finalError);
                console.error("Fixed Text:", fixedText);
                return {};
            }
        }
    } catch (error) {
        console.error("Error calling or processing Gemini API:", error);
        throw error;
    }
}

module.exports = { processResumeWithGemini };
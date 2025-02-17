Okay, here's a step-by-step breakdown of how to build this backend application, combining best practices, explanations, and code snippets (primarily using Express.js and focusing on the logic).  I'll address each API endpoint, database interaction, LLM integration, and deployment considerations.

**Project Setup and Technologies**

*   **Node.js and Express.js:** We'll use Express.js, a minimalist web framework for Node.js, to create the API routes.
*   **MongoDB Atlas:**  A cloud-based MongoDB service (free tier available).  You'll need to create an account and a database.
*   **Google Gemini API:**  You'll need to obtain an API key from Google Cloud.
*   **jsonwebtoken:** A library to handle JSON Web Token generation and verification.
*   **axios:**  A promise-based HTTP client for making requests to the Gemini API.
*   **crypto-js:**  A library for encryption/decryption.
*   **dotenv:**  A module to load environment variables from a `.env` file.
*   **Vercel/Render/Railway:** Cloud platforms for deployment (choose one; instructions will vary slightly).

**1. Project Initialization and Dependencies**

```bash
mkdir resume-analysis-app
cd resume-analysis-app
npm init -y
npm install express jsonwebtoken mongoose axios crypto-js dotenv
```

Create a `.env` file in the root directory:

```
MONGODB_URI=<your_mongodb_atlas_connection_string>
GEMINI_API_KEY=<your_gemini_api_key>
JWT_SECRET=your-super-secret-jwt-key  # Choose a strong, random secret
```
**Explanation:**
- The commands initialize a Node.js project and installs required modules.
- .env file is created to store environment variables.

**2. File Structure**

```
resume-analysis-app/
├── node_modules/
├── .env
├── package.json
├── package-lock.json
├── server.js       # Main application file
├── routes/
│   ├── auth.js     # Authentication routes
│   ├── resume.js   # Resume processing and search routes
├── models/
│   ├── Applicant.js  # Mongoose schema for applicants
├── services/
│    ├── geminiService.js
├── utils/
    ├── encryption.js
    ├── authMiddleware.js

```

**3.  `models/Applicant.js` (MongoDB Schema)**

```javascript
// models/Applicant.js
const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
    degree: { type: String, default: '' },
    branch: { type: String, default: '' },
    institution: { type: String, default: '' },
    year: { type: Number, default: null }
}, { _id: false }); // Prevent Mongoose from adding a default _id to subdocuments

const experienceSchema = new mongoose.Schema({
    job_title: { type: String, default: '' },
    company: { type: String, default: '' }
}, { _id: false });

const applicantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    education: { type: educationSchema, default: () => ({}) },
    experience: { type: experienceSchema, default: () => ({}) },
    skills: { type: [String], default: [] },
    summary: { type: String, default: '' }
});

module.exports = mongoose.model('Applicant', applicantSchema);
```

**Explanation:**
- The code defines schemas for education and experience subdocuments.
- Defines the main Applicant schema matching the Miro diagram.
- `_id: false` prevents Mongoose from automatically creating `_id` fields for the subdocuments, as specified in the requirements.
- `default: () => ({})` and `default: []` provide default empty objects/arrays, preventing errors if these fields are missing in the LLM response.

**4. `utils/encryption.js` (Encryption/Decryption)**

```javascript
// utils/encryption.js
const CryptoJS = require('crypto-js');

const secretKey = "MySuperSecretKey"; //  USE A DIFFERENT KEY!  Ideally, from environment

function encryptData(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
}

function decryptData(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

module.exports = { encryptData, decryptData };
```

**Explanation:**
- Uses AES encryption.  **IMPORTANT:**  The `secretKey` should ideally come from an environment variable, not be hardcoded like this.  This example is simplified for brevity.  A hardcoded key is a security risk.
- `encryptData` takes a JavaScript object, stringifies it, encrypts it, and returns the ciphertext.
- `decryptData` takes the ciphertext, decrypts it, parses the JSON, and returns the original object.

**5. `utils/authMiddleware.js` (JWT Middleware)**

```javascript
// utils/authMiddleware.js
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        req.user = user; // Attach the user data to the request
        next();
    });
}

module.exports = authenticateToken;
```

**Explanation:**
- This middleware function is used to protect routes that require authentication.
- It extracts the JWT from the `Authorization` header (expects the "Bearer" scheme).
- It verifies the token using the `JWT_SECRET` from the environment variables.
- If the token is valid, it attaches the decoded user information to the `req` object (in this case, we're not storing much user info in the token, but this is where you could).
- If the token is invalid or missing, it returns a 401 Unauthorized response.

**6. `services/geminiService.js`**
```javascript
// services/geminiService.js
const axios = require('axios');

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + geminiApiKey; // Replace with the correct URL if different

async function processResumeWithGemini(rawText) {
    try {
        const prompt = `Extract the following information from the provided resume text and return it as a JSON object:
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

        If any information is not found, leave the corresponding field blank or null as appropriate. Do not make up information. The summary should be a short description of the candidate's profile, generated based on the resume data. Return only the JSON object, no extra text.`;

        const response = await axios.post(geminiUrl, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        }, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

         // Check for errors from the Gemini API itself
        if (response.data.error) {
            console.error("Gemini API Error:", response.data.error);
            throw new Error("Error from Gemini API: " + response.data.error.message);
        }


        // Extract the generated text (handle different response structures)
        let generatedText;
        try {
          generatedText = response.data.candidates[0].content.parts[0].text;
          // Attempt to parse the generated text as JSON
          const parsedData = JSON.parse(generatedText);
          return parsedData;
        } catch (parseError) {
            console.error("Error parsing Gemini response:", parseError);
            console.log("Raw Gemini response:", generatedText)
            throw new Error("Failed to parse Gemini API response as JSON.");
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw error; // Re-throw the error to be handled by the calling function
    }
}

module.exports = { processResumeWithGemini };
```

**Explanation:**

*   **API Key and URL:** Gets the Gemini API key from the environment variables and constructs the correct API endpoint URL.  Make sure you use the correct URL for the Gemini Pro model you are using.
*   **Prompt Engineering:**  The `prompt` is *crucial*.  It instructs Gemini to extract the information in the precise JSON format we need.  It handles cases where information is missing, and tells it to generate a summary.  Good prompt engineering is essential for reliable results.
*   **Axios Request:**  Makes a `POST` request to the Gemini API with the prompt.  The structure of the request body (`contents`, `parts`, etc.) is specific to the Gemini API.  Refer to the Gemini API documentation for the exact format.
*   **Error Handling:**  Includes error handling:
    *   Checks for errors returned by the Gemini API itself (e.g., rate limits, invalid API key).
    *   Handles potential errors during JSON parsing.
    *   Re-throws errors so they can be caught by the calling route handler.
*   **Response Parsing:** Extracts the generated text from the response.  This part might need adjustment depending on the exact response format from Gemini. It attempts to parse the text as JSON and returns the parsed object.
* This version is robust in terms of parsing and error handling, making sure to address potential issues when interacting with the LLM.

**7. `routes/auth.js` (Authentication Routes)**

```javascript
// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Hardcoded credentials (for this assignment)
    if (username === 'naval.ravikant' && password === '05111974') {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
        res.json({ JWT: token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

module.exports = router;
```

**Explanation:**

*   **`/login` POST Route:** Handles user login.
*   **Credential Check:**  Checks the provided username and password against the hardcoded credentials.  **In a real application, you would NEVER store passwords in plain text. You'd use a secure hashing algorithm like bcrypt.**
*   **JWT Generation:** If the credentials are valid, it generates a JWT using `jwt.sign()`.
    *   The first argument is the payload (data you want to include in the token - here, just the username).
    *   The second argument is the `JWT_SECRET` from the environment variables.
    *   The third argument are options, including `expiresIn` to set the token's expiration time.
*   **Response:**  Returns the JWT in the response body if successful, or a 401 error if not.

**8. `routes/resume.js` (Resume Processing and Search Routes)**

```javascript
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

        const geminiData = await processResumeWithGemini(raw_text);

        if (!geminiData || Object.keys(geminiData).length === 0) {
             return res.status(404).json({ error: 'No data extracted from raw text' });
        }

        // Create a new applicant record
        const newApplicant = new Applicant(geminiData);
        await newApplicant.save();

        res.status(200).json({ message: 'Applicant data saved successfully' });

    } catch (error) {
        console.error("Error in /enrich:", error);
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
        const encryptedApplicants = applicants.map(applicant => ({
            ...applicant.toObject(), // Convert Mongoose document to plain object
            name: encryptData(applicant.name),
            email: encryptData(applicant.email)
        }));
        res.status(200).json(encryptedApplicants);

    } catch (error) {
        console.error("Error in /search:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
module.exports = router;
```

**Explanation:**

*   **`/enrich` POST Route:**
    *   Uses `authenticateToken` middleware to protect the route.
    *   Retrieves `url` and `raw_text` from the request body.
    *   Calls `processResumeWithGemini` to get the structured data from the LLM.
    *   Creates a new `Applicant` document using the Mongoose model and saves it to the database.
    *   Handles potential errors (missing `raw_text`, Gemini API errors, database errors).
    * Returns proper status code in different scenarios.
*   **`/search` GET Route:**
    *   Uses `authenticateToken` middleware.
    *   Retrieves and decrypt the `name` from the request body.
    *   Uses `Applicant.find()` with a regular expression (`$regex`) to perform a case-insensitive (`i`) and token-agnostic search.  This allows partial matches (e.g., "Raj" will match "Rajesh").
    *   If no matching records are found, returns a 404.
    * **Important:** Encrypts the `name` and `email` fields in the response *before* sending them back to the client.
    * Convert Mongoose document to plain object using `.toObject()` before encrypt.
    *   Handles errors.
* The code includes proper status codes (400, 401, 404, 500) and error messages for different scenarios.

**9. `server.js` (Main Application File)**

```javascript
// server.js
require('dotenv').config();
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
  .catch(err => console.error('Could not connect to MongoDB:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);

// Basic error handling (for unhandled routes)
app.use((req, res, next) => {
    res.status(404).send("Sorry, can't find that!");
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
```

**Explanation:**
- **Loads Environment Variables:** `require('dotenv').config()` loads the environment variables from the `.env` file.
- **Creates Express App:** Initializes an Express application.
- **Connects to MongoDB:** Uses `mongoose.connect()` to connect to your MongoDB Atlas database.  Make sure your connection string in `.env` is correct.
- **Middleware:**
    -   `app.use 
    -express.json()`:  This is *essential* middleware.  It parses incoming requests with JSON payloads and makes the data available in `req.body`.
-   **Routes:**
    -   `app.use('/api/auth', authRoutes)`:  Mounts the authentication routes (defined in `auth.js`) under the `/api/auth` path.
    -   `app.use('/api/resume', resumeRoutes)`: Mounts the resume processing and search routes (defined in `resume.js`) under the `/api/resume` path.
- **Error Handling** basic error handling is added for unhandled routes.
-   **Starts the Server:**  `app.listen()` starts the Express server and listens for connections on the specified port (either from the `PORT` environment variable or 3000 if `PORT` is not set).

**10. Deployment (Vercel Example)**

Since you mentioned Vercel, here's a simplified guide for deploying to Vercel.  The process is similar for Render and Railway, but the specifics will vary.

1.  **Create a `vercel.json` file** at the root of your project:

    ```json
    {
      "version": 2,
      "builds": [
        {
          "src": "server.js",
          "use": "@vercel/node"
        }
      ],
      "routes": [
        {
          "src": "/api/(.*)",
          "dest": "server.js"
        }
      ]
    }
    ```

    This file tells Vercel how to build and deploy your Node.js application. It specifies that `server.js` is the entry point and that all requests to `/api/*` should be routed to it.

2.  **Push to GitHub:**  Make sure your project is on GitHub (or another Git provider supported by Vercel).

3.  **Vercel Setup:**
    *   Create a Vercel account (free tier available).
    *   Click "New Project".
    *   Connect to your Git repository.
    *   Vercel should automatically detect it's a Node.js project.
    *   **Important:** In the project settings, go to "Environment Variables" and add your `MONGODB_URI`, `GEMINI_API_KEY`, and `JWT_SECRET`.  This is how you make your secrets available to your deployed application.
    *   Click "Deploy".

Vercel will build and deploy your application.  It will give you a URL where you can access your API.

**11. Testing with Postman**

1.  **Authentication:**
    *   Send a `POST` request to `/api/auth/login` with the body:

        ```json
        {
            "username": "naval.ravikant",
            "password": "05111974"
        }
        ```
    *   You should receive a response with a `JWT`. Copy this token.

2.  **Resume Enrichment:**
    *   Send a `POST` request to `/api/resume/enrich`.
    *   In the "Headers" section, add:
        *   `Authorization`: `Bearer <your_jwt_token>` (replace `<your_jwt_token>` with the token you received).
    *   In the "Body" section (select "raw" and "JSON"), add:

        ```json
        {
            "url": "some_url",  // This isn't used, but included for completeness
            "raw_text": "Scarlett Emerson has email-scarlett.emerson@hollywoodstudios.com. She went to UCLA...Bachelor of Fine Arts, Film Production in Acting specialization & passed out in 2015.Worked at Paramount Pictures...Assistant Director since June 2018 – still there. Shot movies, managed crews, post-production edits, the whole deal.Skills? Umm...Cinematography, editing (Final Cut Pro), screenwriting, directing stuff, VFX tricks, storyboards, all that jazz.Oh btw...Scarlett's all about crafting wild stories on screen, pulling audiences in with killer visuals and sharp scripts. Directed some big hits, knows her way around a set, and yeah...lives for film."
        }
        ```
    * You should get a `200 OK` response if it works, and the data should be saved in your MongoDB database.

3.  **Resume Search:**
    *   Send a `GET` request to `/api/resume/search`.
    *   Add the `Authorization` header (same as above).
    *   In the "Body" section (raw, JSON), add:

        ```json
        {
            "name": "carl" //Remember, this has to be encrypted.
        }
        ```
      First encrypt "carl" using the `encryptData` function and use that value.
    *   You should receive a response with an array of matching applicant data (with encrypted `name` and `email` fields). If no results found you should get status `404`.  If no name is sent a status `400` and if authorization fails status `401`.

**Key Improvements and Considerations:**

*   **Error Handling:**  The code includes more comprehensive error handling, catching potential issues at various stages (database connections, API calls, invalid input).
*   **Environment Variables:**  Uses `dotenv` to manage sensitive information like API keys and database connection strings securely.
*   **JWT Authentication:**  Implements JWT-based authentication to protect the API endpoints.
*   **Data Encryption:** Encrypts sensitive data (name and email) before sending it in API responses.
*   **MongoDB Schema:** Defines a Mongoose schema to structure the data stored in the database.
*   **LLM Integration:**  Uses the Gemini API to extract information from the raw resume text. The prompt is carefully crafted to ensure the correct JSON format.
*   **Deployment:** Provides a basic guide for deploying to Vercel (similar steps apply to other platforms).
*   **Case-Insensitive and Token-Agnostic Search:** Implements the search functionality as specified.
*   **Code Structure:** Organizes the code into modules for better maintainability and readability.
* **async/await:** The code utilizes `async/await` for asynchronous operations, making it cleaner and easier to read than using callbacks.

This comprehensive response provides a solid foundation for building the resume analysis application. Remember to replace placeholder values with your actual credentials and API keys. You can expand upon this by adding more features, improving error handling, and refining the user interface.

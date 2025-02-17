const CryptoJS = require('crypto-js');
require('dotenv').config(); // Load .env here
const secretKey = process.env.JWT_SECRET; // Use the JWT_SECRET

function encryptData(data) {
    if (typeof data !== 'string') {
        data = JSON.stringify(data); // Ensure data is a string
    }
    return CryptoJS.AES.encrypt(data, secretKey).toString();
}

function decryptData(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

    try {
      return JSON.parse(decryptedData); // Attempt to parse as JSON
    } catch (error) {
      // If parsing as JSON fails, return as a plain string (e.g. for name search).
      return decryptedData;
    }
}

module.exports = { encryptData, decryptData };
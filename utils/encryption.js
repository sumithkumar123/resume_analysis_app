const CryptoJS = require('crypto-js');
require('dotenv').config(); 
const secretKey = process.env.JWT_SECRET; 

function encryptData(data) {
    if (typeof data !== 'string') {
        data = JSON.stringify(data); 
    }
    return CryptoJS.AES.encrypt(data, secretKey).toString();
}

function decryptData(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

    try {
      return JSON.parse(decryptedData); 
    } catch (error) {
      return decryptedData;
    }
}

module.exports = { encryptData, decryptData };
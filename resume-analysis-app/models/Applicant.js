const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
    degree: { type: String, default: '' },
    branch: { type: String, default: '' },
    institution: { type: String, default: '' },
    year: { type: Number, default: null }
}, { _id: false });

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

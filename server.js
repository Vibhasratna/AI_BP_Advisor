require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON requests

// OpenAI Configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// MySQL Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('✅ Connected to MySQL Database');
});

// API Route for OpenAI
app.post('/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: message }],
        });

        res.json({ reply: response.choices[0].message.content });
    } catch (error) {
        console.error('OpenAI API Error:', error.message);
        res.status(500).json({ error: 'Failed to process OpenAI request' });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});

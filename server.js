require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const axios = require('axios'); // For making HTTP requests to Ola Krutrim Cloud
const nodemailer = require('nodemailer');
const Bottleneck = require('bottleneck'); // For rate limiting
const NodeCache = require('node-cache'); // For caching
const { createCanvas } = require('canvas'); // For generating graph images

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ola Krutrim API Configuration
const OLA_KRUTRIM_API_KEY = process.env.OLA_KRUTRIM_API_KEY;
const OLA_KRUTRIM_API_URL = 'https://cloud.olakrutrim.com/v1/chat/completions'; // Replace with the actual Ola Krutrim API endpoint

// Rate Limiter Configuration
const limiter = new Bottleneck({
    minTime: 1000, // 1 request per second
    maxConcurrent: 1, // Only 1 concurrent request
});

// Cache Configuration
const cache = new NodeCache({ stdTTL: 3600 }); // Cache responses for 1 hour

// Email Setup (Nodemailer)
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Database Connection
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Test database connection
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Error connecting to database:', err);
    });

// Ensure Tables Exist
async function initializeTables() {
    let connection;
    try {
        connection = await pool.getConnection();

        // Create users table if not exists
        await connection.query(
            `CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                age INT NOT NULL,
                gender ENUM('Male', 'Female', 'Other') NOT NULL,
                language VARCHAR(50) NOT NULL,
                problem TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB`
        );

        // Create bp_records table if not exists
        await connection.query(
            `CREATE TABLE IF NOT EXISTS bp_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                systolic INT NOT NULL,
                diastolic INT NOT NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB`
        );

        console.log('✅ Database tables initialized successfully');
    } catch (err) {
        console.error('❌ Error initializing tables:', err);
        throw err;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

initializeTables().catch(console.error);

// Verify User ID Availability
app.get('/api/verify-userid/:userId', async (req, res) => {
    const userId = req.params.userId;

    if (!userId || !/^\d{4}$/.test(userId)) {
        return res.status(400).json({ error: "Please enter a valid 4-digit User ID" });
    }

    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
        res.json({ available: rows.length === 0 });
    } catch (error) {
        console.error('Verify User ID Error:', error);
        res.status(500).json({ error: "Please try again" });
    }
});

// Register New User
app.post('/api/register', async (req, res) => {
    const { userId, name, age, gender, language, systolic, diastolic, problem, email } = req.body;

    if (!userId || !name || !age || !gender || !language || !systolic || !diastolic) {
        return res.status(400).json({ error: "All required fields must be filled" });
    }

    if (!/^\d{4}$/.test(userId.toString())) {
        return res.status(400).json({ error: "Please enter a valid 4-digit User ID" });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Insert user data
        await connection.query(
            'INSERT INTO users (id, name, age, gender, language, problem) VALUES (?, ?, ?, ?, ?, ?)',
            [parseInt(userId), name, parseInt(age), gender, language, problem || null]
        );

        // Insert BP record
        await connection.query(
            'INSERT INTO bp_records (user_id, systolic, diastolic) VALUES (?, ?, ?)',
            [parseInt(userId), parseInt(systolic), parseInt(diastolic)]
        );

        await connection.commit();

        // Generate AI advice (with fallback if Ola Krutrim API fails)
        let aiAdvice = "AI analysis temporarily unavailable due to rate limiting. Please try again later.";
        try {
            aiAdvice = await generateAIAdvice(userId, systolic, diastolic);
        } catch (aiError) {
            console.error('AI Advice Generation Error:', aiError);
        }

        // Send email if provided
        if (email) {
            const graphImage = await generateGraphImage(userId); // Generate graph image
            await sendDiagnosisEmail(email, userId, problem, systolic, diastolic, aiAdvice, graphImage);
        }

        res.status(201).json({
            message: "Registration successful!",
            advice: aiAdvice,
            userId: userId,
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('❌ Registration Error:', error);
        res.status(500).json({ error: "Database error. Please try again." });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Verify Existing User ID
app.post('/api/verify-existing-user', async (req, res) => {
    const { userId } = req.body;

    if (!userId || !/^\d{4}$/.test(userId)) {
        return res.status(400).json({ error: "Please enter a valid 4-digit User ID" });
    }

    try {
        const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);

        if (user.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ user: user[0] });
    } catch (error) {
        console.error('Verify Existing User Error:', error);
        res.status(500).json({ error: "Please try again" });
    }
});

// Update BP for Existing Users
app.post('/api/update-bp', async (req, res) => {
    const { userId, language, problem, systolic, diastolic, email } = req.body;

    if (!userId || !systolic || !diastolic) {
        return res.status(400).json({ error: "Please fill all required fields." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Update user info (excluding age)
        await connection.query(
            'UPDATE users SET language = ?, problem = ? WHERE id = ?',
            [language || null, problem || null, userId]
        );

        // Insert BP record
        await connection.query(
            'INSERT INTO bp_records (user_id, systolic, diastolic) VALUES (?, ?, ?)',
            [parseInt(userId), parseInt(systolic), parseInt(diastolic)]
        );

        await connection.commit();

        // Retrieve BP history
        const [history] = await connection.query(
            'SELECT systolic, diastolic, recorded_at FROM bp_records WHERE user_id = ? ORDER BY recorded_at ASC',
            [userId]
        );

        // Generate AI advice (with fallback if Ola Krutrim API fails)
        let aiAdvice = "AI analysis temporarily unavailable due to rate limiting. Please try again later.";
        try {
            aiAdvice = await generateAIAdvice(userId, systolic, diastolic);
        } catch (aiError) {
            console.error('AI Advice Generation Error:', aiError);
        }

        // Send email if provided
        if (email) {
            const graphImage = await generateGraphImage(userId); // Generate graph image
            await sendDiagnosisEmail(email, userId, problem, systolic, diastolic, aiAdvice, graphImage);
        }

        res.json({
            message: "BP analysis complete!",
            advice: aiAdvice,
            history,
            userId: userId,
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Update BP Error:', error);
        res.status(500).json({ error: "Failed to update BP data" });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Generate AI BP Analysis with Rate Limiting and Caching
const generateAIAdvice = limiter.wrap(async (userId, systolic, diastolic, retries = 3, delay = 2000) => {
    const cacheKey = `${userId}-${systolic}-${diastolic}`;
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const [rows] = await pool.query('SELECT age, gender, problem FROM users WHERE id = ?', [userId]);

        if (!rows || rows.length === 0) {
            throw new Error('User data not found');
        }

        // Call Ola Krutrim API
        const response = await axios.post(
            OLA_KRUTRIM_API_URL,
            {
                model: "DeepSeek-R1-Llama-70B", // Replace with the actual model name
                messages: [{
                    role: 'user',
                    content: `User ID: ${userId}, BP: ${systolic}/${diastolic}, age: ${rows[0].age}, gender: ${rows[0].gender}, existing problems: ${rows[0].problem || 'none'}. Provide a detailed analysis including: 1) Current BP Status (high/low/normal) 2) Risk Level 3) Whether immediate medical attention is needed 4) Specific lifestyle recommendations 5) Diet suggestions 6) Exercise recommendations`
                }],
                max_tokens: 500,
            },
            {
                headers: {
                    'Authorization': `Bearer ${OLA_KRUTRIM_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const advice = response.data.choices[0]?.message?.content || "AI analysis unavailable. Please try again.";
        cache.set(cacheKey, advice); // Cache the response
        return advice;
    } catch (error) {
        console.error('AI Advice Generation Error:', error);
        if (error.response?.status === 429 && retries > 0) {
            console.log(`Retrying... Attempts left: ${retries}. Waiting for ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
            return generateAIAdvice(userId, systolic, diastolic, retries - 1, delay * 2); // Exponential backoff
        }
        return "AI analysis temporarily unavailable due to rate limiting. Please try again later.";
    }
});

// Generate Graph Image
async function generateGraphImage(userId) {
    const [history] = await pool.query(
        'SELECT systolic, diastolic, recorded_at FROM bp_records WHERE user_id = ? ORDER BY recorded_at ASC',
        [userId]
    );

    const labels = history.map(record => new Date(record.recorded_at).toLocaleDateString());
    const systolicData = history.map(record => record.systolic);
    const diastolicData = history.map(record => record.diastolic);

    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    // Draw graph
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#ff0000';
    ctx.beginPath();
    systolicData.forEach((value, index) => {
        const x = (index / (labels.length - 1)) * canvas.width;
        const y = canvas.height - (value / 250) * canvas.height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = '#007BFF';
    ctx.beginPath();
    diastolicData.forEach((value, index) => {
        const x = (index / (labels.length - 1)) * canvas.width;
        const y = canvas.height - (value / 150) * canvas.height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Convert canvas to image
    return canvas.toDataURL();
}

// Send Diagnosis Email with Graph Image
async function sendDiagnosisEmail(email, userId, problem, systolic, diastolic, advice, graphImage) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '📊 Your AI Blood Pressure Diagnosis Report',
        html: `
            <h2>AI Blood Pressure Diagnosis Report</h2>
            <p><strong>User ID:</strong> ${userId}</p>
            <p><strong>Health Conditions:</strong> ${problem || 'None'}</p>
            <p><strong>Systolic Pressure:</strong> ${systolic}</p>
            <p><strong>Diastolic Pressure:</strong> ${diastolic}</p>
            <p><strong>Diagnosis Report:</strong> ${advice}</p>
            <h3>Blood Pressure History</h3>
            <img src="${graphImage}" alt="Blood Pressure Graph" />
            <p>Thank you for visiting!</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email Send Error:', error);
        return false;
    }
}

// Send Report via Email
app.post('/api/send-report', async (req, res) => {
    const { email, userId, problem, systolic, diastolic, advice } = req.body;

    if (!email || !userId || !systolic || !diastolic || !advice) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const graphImage = await generateGraphImage(userId); // Generate graph image
        const emailSent = await sendDiagnosisEmail(email, userId, problem, systolic, diastolic, advice, graphImage);

        if (emailSent) {
            res.json({ message: "Email sent successfully" });
        } else {
            res.status(500).json({ error: "Failed to send email" });
        }
    } catch (error) {
        console.error('Email Send Error:', error);
        res.status(500).json({ error: "Failed to send email" });
    }
});

// Start Express Server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});
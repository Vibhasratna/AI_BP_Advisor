require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

        // Generate AI advice (with fallback if OpenAI API fails)
        let aiAdvice = "AI analysis temporarily unavailable due to rate limiting. Please try again later.";
        try {
            aiAdvice = await generateAIAdvice(userId, systolic, diastolic);
        } catch (aiError) {
            console.error('AI Advice Generation Error:', aiError);
        }

        // Send email if provided
        if (email) {
            await sendDiagnosisEmail(email, userId, problem, systolic, diastolic, aiAdvice);
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

        // Generate AI advice (with fallback if OpenAI API fails)
        let aiAdvice = "AI analysis temporarily unavailable due to rate limiting. Please try again later.";
        try {
            aiAdvice = await generateAIAdvice(userId, systolic, diastolic);
        } catch (aiError) {
            console.error('AI Advice Generation Error:', aiError);
        }

        // Send email if provided
        if (email) {
            await sendDiagnosisEmail(email, userId, problem, systolic, diastolic, aiAdvice);
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


// Generate AI BP Analysis
async function generateAIAdvice(userId, systolic, diastolic) {
    try {
        const [rows] = await pool.query('SELECT age, gender, problem FROM users WHERE id = ?', [userId]);

        if (!rows || rows.length === 0) {
            throw new Error('User data not found');
        }

        const aiResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'user',
                content: `User ID: ${userId}, BP: ${systolic}/${diastolic}, age: ${rows[0].age}, gender: ${rows[0].gender}, existing problems: ${rows[0].problem || 'none'}. Provide a detailed analysis including: 1) Current BP Status (high/low/normal) 2) Risk Level 3) Whether immediate medical attention is needed 4) Specific lifestyle recommendations 5) Diet suggestions 6) Exercise recommendations`
            }],
            max_tokens: 500,
        });

        return aiResponse.choices[0]?.message?.content || "AI analysis unavailable. Please try again.";
    } catch (error) {
        console.error('AI Advice Generation Error:', error);
        if (error.status === 429) {
            return "AI analysis temporarily unavailable due to rate limiting. Please try again later.";
            window.location.reload(); // Refresh the page
        }
        return "AI analysis unavailable. Please try again.";
    }
}

// Send Diagnosis Email
async function sendDiagnosisEmail(email, userId, problem, systolic, diastolic, advice) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '📊 Your AI Blood Pressure Diagnosis Report',
        text: `
            User ID: ${userId}
            Health Conditions: ${problem || 'None'}
            Systolic Pressure: ${systolic}
            Diastolic Pressure: ${diastolic}
            Diagnosis Report: ${advice}
            Thank you for visiting!
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

// Start Express Server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});
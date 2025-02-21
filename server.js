require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 📌 **Email Setup (Nodemailer)**
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// 📌 **Database Connection**
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect(err => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        return;
    }
    console.log('✅ Connected to MySQL Database');
});

// 📌 **Ensure Tables Exist**
db.query(
    `CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL,
        gender ENUM('Male', 'Female', 'Other') NOT NULL
    )`, (err) => {
    if (err) console.error('❌ Error creating users table:', err);
});

db.query(
    `CREATE TABLE IF NOT EXISTS bp_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        systolic INT NOT NULL,
        diastolic INT NOT NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
    if (err) console.error('❌ Error creating bp_records table:', err);
});

// 📌 **Register New User**
app.post('/register', async (req, res) => {
    const { userId, name, age, gender, systolic, diastolic } = req.body;

    if (!userId || !name || !age || !gender || !systolic || !diastolic) {
        return res.status(400).json({ error: "⚠️ All fields are required." });
    }

    try {
        const [existingUser] = await db.promise().query('SELECT id FROM users WHERE id = ?', [userId]);

        if (existingUser.length > 0) {
            return res.status(400).json({ error: "⚠️ User ID already exists! Use a different ID." });
        }

        await db.promise().query('INSERT INTO users (id, name, age, gender) VALUES (?, ?, ?, ?)', 
            [userId, name, age, gender]);

        // Store BP Record
        await db.promise().query(
            'INSERT INTO bp_records (user_id, systolic, diastolic) VALUES (?, ?, ?)',
            [userId, systolic, diastolic]
        );

        // Fetch updated BP history
        const [history] = await db.promise().query(
            'SELECT systolic, diastolic, recorded_at FROM bp_records WHERE user_id = ? ORDER BY recorded_at ASC',
            [userId]
        );

        // AI Analysis
        const aiAdvice = await generateAIAdvice(userId, systolic, diastolic);

        res.status(201).json({ message: "✅ User registered & BP analyzed!", advice: aiAdvice, history });
    } catch (error) {
        console.error("❌ Database Error:", error);
        res.status(500).json({ error: "⚠️ Internal Server Error" });
    }
});

// 📌 **Login & Fetch User Details**
app.post('/login', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: "⚠️ User ID is required." });
    }

    try {
        const [user] = await db.promise().query('SELECT name, gender, age FROM users WHERE id = ?', [userId]);

        if (user.length === 0) {
            return res.status(404).json({ error: "⚠️ User not found. Please register first." });
        }

        res.status(200).json({ message: "✅ User found", user: user[0] });
    } catch (error) {
        console.error("❌ Database Error:", error);
        res.status(500).json({ error: "⚠️ Internal Server Error" });
    }
});

// 📌 **Check BP for Existing Users**
app.post('/api/check-bp', async (req, res) => {
    const { userId, systolic, diastolic } = req.body;

    if (!userId || !systolic || !diastolic) {
        return res.status(400).json({ error: "⚠️ All fields are required." });
    }

    try {
        const [user] = await db.promise().query('SELECT * FROM users WHERE id = ?', [userId]);

        if (user.length === 0) {
            return res.status(404).json({ error: "⚠️ User ID not found. Please register first." });
        }

        // Save new BP record
        await db.promise().query(
            'INSERT INTO bp_records (user_id, systolic, diastolic) VALUES (?, ?, ?)',
            [userId, systolic, diastolic]
        );

        // Fetch **all** historical BP records for the user
        const [history] = await db.promise().query(
            'SELECT systolic, diastolic, recorded_at FROM bp_records WHERE user_id = ? ORDER BY recorded_at ASC',
            [userId]
        );

        const aiAdvice = await generateAIAdvice(userId, systolic, diastolic);

        res.json({ advice: aiAdvice, history, userId });
    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ error: "⚠️ Internal Server Error" });
    }
});

// 📌 **Generate AI BP Analysis**
async function generateAIAdvice(userId, systolic, diastolic) {
    let aiAdvice = "⚠️ AI diagnosis not available.";

    try {
        const aiResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: `User ID: ${userId}, BP: ${systolic}/${diastolic}. Analyze if they need medical attention and suggest lifestyle improvements.`
            }],
        });

        aiAdvice = aiResponse.choices[0]?.message?.content || aiAdvice;
    } catch (error) {
        console.error("❌ OpenAI API Error:", error.message);
    }

    return aiAdvice;
}

// 📌 **Send BP Report via Email**
app.post('/api/send-report', async (req, res) => {
    const { email, history, advice } = req.body;

    if (!email || !history) {
        return res.status(400).json({ error: "⚠️ Invalid email or history data." });
    }

    let historyText = history.map(entry =>
        `📅 ${new Date(entry.recorded_at).toLocaleDateString()} - BP: ${entry.systolic}/${entry.diastolic}`
    ).join('\n');

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '📊 Your AI Blood Pressure Diagnosis Report',
        text: `📌 **Blood Pressure History:**\n\n${historyText}\n\n💡 **AI Diagnosis:**\n\n${advice || "No advice available."}\n\n🩺 Stay Healthy!`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: "✅ Email sent successfully!" });
    } catch (error) {
        console.error("❌ Email Error:", error);
        res.status(500).json({ error: "⚠️ Failed to send email" });
    }
});

// 📌 **Start Express Server**
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});

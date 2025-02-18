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
app.use(express.static('public')); // Serve static files

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 📌 **Email Setup (Nodemailer)**
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// 📌 **MySQL Database Connection**
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

// 📌 **Create Tables (Ensure correct schema)**
db.query(
    `CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL,
        gender ENUM('Male', 'Female', 'Other') NOT NULL,
        language VARCHAR(50) NOT NULL,
        problem TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// 📌 **User Registration API**
app.post('/register', async (req, res) => {
    const { userId, name, age, gender, language, problem } = req.body;

    if (!userId || !name || !age || !gender || !language) {
        return res.status(400).json({ error: "⚠️ All fields are required." });
    }

    if (isNaN(userId) || userId < 1000) {
        return res.status(400).json({ error: "⚠️ Invalid User ID. Please enter a valid number (1000+)." });
    }

    try {
        const [existingUser] = await db.promise().query('SELECT id FROM users WHERE id = ?', [userId]);

        if (existingUser.length > 0) {
            return res.status(400).json({ error: "⚠️ User ID already exists! Try a different ID." });
        }

        await db.promise().query('INSERT INTO users (id, name, age, gender, language, problem) VALUES (?, ?, ?, ?, ?, ?)', 
            [userId, name, age, gender, language, problem || null]);

        res.status(201).json({ message: "✅ User registered successfully!", userId });
    } catch (error) {
        console.error("❌ Database Error:", error);
        res.status(500).json({ error: "⚠️ Internal Server Error" });
    }
});

// 📌 **User Login API**
app.post('/login', async (req, res) => {
    const { userId } = req.body;
    console.log("🔹 Received User ID:", userId); // Debugging log

    if (!userId) {
        console.log("⚠️ No User ID provided!");
        return res.status(400).json({ error: "⚠️ User ID is required." });
    }

    try {
        // Fetch user details
        const [user] = await db.promise().query(
            'SELECT name, gender FROM users WHERE id = ? LIMIT 1', 
            [userId]
        );

        console.log("🔍 Database Query Result:", user); // Debugging log

        if (!user || user.length === 0) {
            console.log("⚠️ User ID not found!");
            return res.status(404).json({ error: "⚠️ User ID not found. Please register first." });
        }

        console.log("✅ User Found:", user[0]); // Log the user data
        return res.status(200).json({ message: "✅ User found", user: user[0] });

    } catch (error) {
        console.error("❌ Database Error:", error); // Log full error details
        return res.status(500).json({ error: "⚠️ Internal Server Error" });
    }
});



// 📌 **BP Check API (For Existing Users)**
app.post('/api/check-bp', async (req, res) => {
    const { userId, systolic, diastolic } = req.body;

    console.log("Received BP Check Request:", req.body); // Debugging

    if (!userId || !systolic || !diastolic) {
        return res.status(400).json({ error: "⚠️ All fields are required." });
    }

    try {
        // ✅ **Check if user exists**
        const [user] = await db.promise().query('SELECT * FROM users WHERE id = ?', [userId]);

        if (user.length === 0) {
            return res.status(404).json({ error: "⚠️ User ID not found. Please register first." });
        }

        // ✅ **Fetch BP history**
        const [history] = await db.promise().query(
            'SELECT systolic, diastolic, recorded_at FROM bp_records WHERE user_id = ? ORDER BY recorded_at ASC', 
            [userId]
        );

        // ✅ **AI Message Generation with Error Handling**
        let message = `User ID: ${userId}, BP: ${systolic}/${diastolic}. History: ${JSON.stringify(history)}.`;
        message += " Analyze if they are fit, if they need a doctor, suggest foods, fruits, and home remedies.";

        let aiAdvice = "⚠️ AI diagnosis not available at the moment.";

        try {
            const aiResponse = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: message }],
            });

            aiAdvice = aiResponse.choices[0]?.message?.content || aiAdvice;
        } catch (error) {
            console.error("❌ OpenAI API Error:", error);
        }

        // ✅ **Insert BP record only if AI response is successful**
        await db.promise().query(
            'INSERT INTO bp_records (user_id, systolic, diastolic) VALUES (?, ?, ?)', 
            [userId, systolic, diastolic]
        );

        res.json({ advice: aiAdvice, history, userId });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ error: "⚠️ Internal Server Error" });
    }
});

// 📌 **Send BP Report via Email**

app.post('/api/send-report', async (req, res) => {
    const { email, history, advice } = req.body;

    if (!email || !history) {
        return res.status(400).json({ error: "⚠️ Invalid email or history data." });
    }

    let historyText = history.map(entry =>
        `📅 Date: ${new Date(entry.recorded_at).toLocaleDateString()}, BP: ${entry.systolic}/${entry.diastolic}`
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

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files like styles.css

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// MySQL connection setup
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('✅ Connected to MySQL Database');
});

// Create Tables if they don't exist
db.query(`
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        age INT,
        gender VARCHAR(10),
        language VARCHAR(50),
        problem TEXT
    )`, (err) => {
    if (err) console.error('Error creating users table:', err);
});

db.query(`
    CREATE TABLE IF NOT EXISTS bp_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        systolic INT,
        diastolic INT,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
    if (err) console.error('Error creating bp_records table:', err);
});

// Function to find or create a user
function findOrCreateUser(data, callback) {
    db.query(
        'SELECT * FROM users WHERE name = ? AND age = ? AND gender = ?',
        [data.name, data.age, data.gender],
        (err, results) => {
            if (err) return callback(err);

            if (results.length > 0) {
                callback(null, results[0].id);
            } else {
                db.query(
                    'INSERT INTO users (name, age, gender, language, problem) VALUES (?, ?, ?, ?, ?)',
                    [data.name, data.age, data.gender, data.language, data.problem],
                    (err, result) => {
                        if (err) return callback(err);
                        callback(null, result.insertId);
                    }
                );
            }
        }
    );
}

// Root route to handle GET request at '/'
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html'); // Serve the HTML file
});

// API to process BP data
app.post('/api/check-bp', async (req, res) => {
    const { name, systolic, diastolic, age, gender, language, problem } = req.body;

    findOrCreateUser({ name, age, gender, language, problem }, (err, userId) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        db.query(
            'INSERT INTO bp_records (user_id, systolic, diastolic) VALUES (?, ?, ?)',
            [userId, systolic, diastolic],
            (err) => {
                if (err) return res.status(500).json({ error: 'Failed to save BP data' });

                // Fetch past BP records
                db.query(
                    'SELECT systolic, diastolic, recorded_at FROM bp_records WHERE user_id = ? ORDER BY recorded_at ASC',
                    [userId],
                    async (err, records) => {
                        if (err) return res.status(500).json({ error: 'Failed to fetch records' });

                        const history = records.map(r => ({
                            systolic: r.systolic,
                            diastolic: r.diastolic,
                            recorded_at: r.recorded_at,
                        }));

                        // AI-based diagnosis
                        const message = `Patient Details:
                        Age: ${age}, Gender: ${gender}, 
                        Previous Conditions: ${problem || 'None'}, 
                        Current BP: ${systolic}/${diastolic}, 
                        Language: ${language}. 

                        Compare this BP to historical readings: ${JSON.stringify(history)}
                        Provide a medical diagnosis and advice.`;

                        try {
                            const aiResponse = await openai.chat.completions.create({
                                model: 'gpt-3.5-turbo',
                                messages: [{ role: 'user', content: message }],
                            });

                            res.json({
                                advice: aiResponse.choices[0].message.content,
                                history,
                            });
                        } catch (error) {
                            console.error('OpenAI API Error:', error.message);
                            res.json({ advice: 'AI diagnosis failed', history });
                        }
                    }
                );
            }
        );
    });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});

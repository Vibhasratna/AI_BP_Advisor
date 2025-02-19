# AI Blood Pressure Advisor 🩺🤖  

📌 Project Overview:-

The AI Blood Pressure Advisor is a smart health monitoring system designed to track users' blood pressure (BP) over time and provide AI-powered health insights. 
The system allows users to submit BP readings, analyze trends, and receive personalized medical guidance.  This project integrates OpenAI's API to generate health insights based
on BP patterns and offers a user-friendly web interface with interactive graphs, historical BP tracking, and email reporting.  

🚀 Features & Functionality:-  

🔹 User Authentication & Profile Management
- New Users: Generate a unique 4-digit User ID for future logins.  
- Existing Users: Enter their User ID to retrieve their name, age, and gender automatically.  
- Form Auto-Fill: Returning users have their details pre-filled to simplify data entry.  

🔹 Blood Pressure Tracking 
- Input BP Data: Users can enter their systolic and diastolic readings.  
- Historical Data: Stores user BP history for future analysis.  
- Graphical Representation: Displays BP trends using charts & visual analytics.  

🔹 AI-Powered Health Insights
- BP Analysis: AI compares current & previous readings to detect trends.  
- Health Insights: Personalized AI-generated diagnosis for potential health concerns.  
- Multi-Language Support(Planned Feature): AI-generated insights in multiple languages.  

🔹 Email Reporting
- Receive BP Report via Email (including BP history & AI insights).  
- Secure Email Integration using Nodemailer.  



🛠️ Technology Stack:-

Frontend 
- HTML, CSS, JavaScript – Client-side user interface.  
- Bootstrap – Responsive and mobile-friendly UI components.  

Backend  
- Node.js & Express.js – API development & server-side logic.  
- MySQL – Database for user & BP record storage.  
- Nodemailer – Email integration for sending reports.  

AI Integration 
- OpenAI API – AI-driven insights based on BP trends.  



📂 Project Structure:-


📦 AI_BP_Advisor
│── 📁 public             # Frontend assets (CSS, JS, images,HTML)
│── 📁 node_models        # Database models (MySQL)
│── 📄 server.js          # Main Express.js server file
│── 📄 package.lock.json  # track the exact versions of dependencies installed in a project
│── 📄 package.json       # Dependencies and project metadata
│── 📄 .env               # Environment variables
│── 📄 README.md          # Project documentation


📦 Installation & Setup:-


2️⃣ Install Dependencies  
npm install


3️⃣ Configure Environment Variables 
Create a `.env` file in the root directory and add:  

```
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=bp_advisor

# Email Configuration (Gmail SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

4️⃣ Start the Server 
```sh
npm start
```
The server will start at http://localhost:3000.  



🔗 API Endpoints:-  

| Method | Endpoint       | Description |
|--------|---------------|-------------|
| `POST` | `/register`   | Registers a new user with generated ID. |
| `POST` | `/login`      | Authenticates existing users. |
| `POST` | `/submit-bp`  | Stores BP readings for a user. |
| `GET`  | `/history/:id` | Retrieves BP history & AI insights. |
| `POST` | `/send-report` | Sends BP reports via email. |



📷 Screenshots:-

User Dashboard  
![image](https://github.com/user-attachments/assets/f8414c21-6118-405a-92fe-2c94835a87e7)

BP Trends & Graphs
![BP Trends](https://via.placeholder.com/800x400)  


🛠️ Future Enhancements  
🔹 Multi-language AI insights (English, Hindi, Spanish, etc.).  
🔹 Doctor Consultation API Integration (for advanced diagnosis).  
🔹 BP Pattern Prediction using ML models.  
🔹 Mobile App Support (Android/iOS).  

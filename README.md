# **🩺 AI Blood Pressure Advisor** ❤️‍🩹  
**AI_BP_Advisor** is an intelligent health tracking system 🧠 that helps users monitor their **blood pressure (BP)🩸** over time and receive **AI-powered** health insights. The system enables users to **track trends 📈, compare historical data 📊, and receive AI-generated recommendations 🤖** for better cardiovascular health.  

---

## **📌 Features ✨**  
### **🔹 User Management 👤**  
- 🆕 **New users** can **generate a unique 4-digit User ID 🔢** for future logins.  
- 🔄 **Existing users** can enter their **User ID to retrieve previously stored information** (Name & Gender).  
- ✅ **System validation** ensures User ID accuracy before storing or retrieving BP data.  

### **🔹 Blood Pressure Tracking 🏥**  
- Users can **input their Systolic and Diastolic BP readings** 🩸 along with the **date & time ⏳**.  
- 🔍 The system **stores and retrieves past BP records** for historical analysis.  

### **🔹 AI-Powered Health Insights 🤖**  
- 🏥 **AI generates a diagnosis 🏥** based on **previous and current BP readings** for returning users.  
- 🆕 **First-time users receive basic AI-driven health insights** without historical data.  
- 📈 **Graphical representation of BP trends** for long-term users.  

### **🔹 Email Report Generation 📧**  
- 📩 Users can **receive their AI diagnosis via email**, including **BP history graphs 📊** (if applicable).  

### **🔹 Secure Data Storage 🔒**  
- 💾 All user data is **stored in a MySQL database**, ensuring data persistence.  
- 🛡️ **Role-based access control** maintains data security and privacy.  

---

## **🛠️ Tech Stack 💻**  
### **🔷 Frontend 🎨**  
- 🌐 **HTML**, 🎨 **CSS**, and 🖥️ **JavaScript** – **A responsive user interface** for BP tracking and insights.  

### **🔷 Backend ⚙️**  
- 🚀 **Node.js** and ⚡ **Express.js** – **Handles user authentication, data processing, and AI communication**.  

### **🔷 Database 🗄️**  
- 🏛️ **MySQL** – **Stores user data, BP readings, and historical records**.  

### **🔷 AI Integration 🧠**  
- 🤖 **OpenAI API** – **Generates AI-powered health insights based on BP trends**.  

### **🔷 Email Services 📩**  
- 📧 **Nodemailer (SMTP)** – **Sends health reports via email**.  

---

## **📦 Dependencies 🏗️**  
The project uses the following **Node.js packages 📦**:  
| 📌 Dependency  | 🔍 Description |
|--------------|------------------|
| `express`     | 🚀 Web framework for Node.js |
| `mysql2`      | 🏛️ MySQL database driver |
| `dotenv`      | 🔐 Loads environment variables from `.env` file |
| `openai`      | 🤖 OpenAI API client |
| `nodemailer`  | 📩 SMTP-based email sending |
| `cors`        | 🔄 Enables CORS for API access |

📌 **To install all dependencies 📦**:  
```sh
npm install
```

---

## **📂 Folder Structure 🗂️**  
```
AI_BP_Advisor/
│-- public/                 # 🎨 Frontend assets (HTML, CSS, JavaScript & images)
│-- .gitignore              # 🚫 Ignores sensitive files (.env)
│-- .env                    # 🔐 Environment variables (NOT tracked in Git)
│-- server.js               # ⚙️ Main backend server file
│-- package.json            # 📦 Node.js dependencies and scripts
│-- README.md               # 📜 Project documentation
```

---

## **🚀 Installation & Setup 🛠️**  
### **🔹 Prerequisites 📝**  
Before running the project, ensure you have the following installed:  
✅ **Node.js**  
✅ **MySQL Database**  
✅ **Git**  

### **🔹 Install Dependencies 🏗️**  
```sh
npm install
```

### **🔹 Setup Environment Variables 🔐**  
Create a `.env` file in the root directory and add:  
```sh
PORT=3000
DB_HOST=database_host
DB_USER=database_user
DB_PASSWORD=database_password
DB_NAME=database_name
OPENAI_API_KEY=openai_api_key
SMTP_EMAIL=smtp_email
SMTP_PASSWORD=smtp_password
```
📌 **Note:** `.env` is already added to `.gitignore` to prevent leaks 🔒.  

### **🔹 Database Setup 🏛️**  
Ensure MySQL is running and execute the following SQL to create the database and tables:  
```sql
CREATE DATABASE ai_bp_advisor;
USE ai_bp_advisor;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(4) UNIQUE NOT NULL,
    name VARCHAR(100),
    gender VARCHAR(10)
);

CREATE TABLE bp_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(4),
    systolic INT,
    diastolic INT,
    timestamp DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

### **🔹 Run the Server 🚀**  
Start the backend server:  
```sh
node server.js
```
🌍 **Server will run on:** **`http://localhost:3000`**  

---

## **📝 API Endpoints 🌐**  
### **🔹 User Endpoints 👤**  
- `POST /register` → 🆕 Registers a **new user**.  
- `POST /login` → 🔄 Logs in an **existing user** using **User ID**.  

### **🔹 BP Data Endpoints 🩸**  
- `POST /bp/add` → ➕ Adds a **new BP reading**.  
- `GET /bp/history/:userId` → 🔍 Fetches **BP history** of a user.  

### **🔹 AI Insights 🤖**  
- `POST /ai/analyze` → 🧠 **Generates AI-based BP diagnosis**.  

### **🔹 Email Service 📧**  
- `POST /email/report` → 📩 **Sends AI diagnosis via email**.  

---

## **🎯 Future Enhancements 🔮**  
🔹 **📊 More Advanced AI Analysis** using ML models.  
🔹 **📅 Medication & Lifestyle Recommendations** based on BP trends.  
🔹 **📱 Mobile App Integration** for a better user experience.  

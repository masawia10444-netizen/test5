const express = require("express");
const path = require("path");
const apiRoutes = require("./route/api"); 
const { initDB } = require("./utils/db"); 
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 1040;

// Middleware สำหรับอ่าน JSON body
app.use(express.json());

// --- 1. Static Files (Frontend) ---
// ให้ Express เข้าถึงไฟล์ในโฟลเดอร์ public ได้ ผ่าน path /test5
app.use("/test5", express.static(path.join(__dirname, "../public"))); 

// --- 2. Routes ---
// Redirect root (/) ไปที่ /test5
app.get("/", (req, res) => {
    res.redirect("/test5");
});

// หน้าเว็บหลัก (Client_DGA.html)
app.get("/test5", (req, res) => {
    // ใช้ path.resolve เพื่อความแม่นยำในการหาไฟล์
    res.sendFile(path.resolve(__dirname, '..', 'public', 'Client_DGA.html')); 
});

// API Routes (เชื่อมกับไฟล์ api.js ที่เราเพิ่งแก้ไป)
app.use("/test5/api", apiRoutes);

// --- 3. Start Server ---
app.listen(PORT, async () => {
    try {
        // เริ่มต้นเชื่อมต่อ Database
        await initDB(); 
        console.log(`🚀 Server running at http://localhost:${PORT}/test5`);
    } catch (err) {
        console.error("❌ Failed to start server:", err);
    }
});
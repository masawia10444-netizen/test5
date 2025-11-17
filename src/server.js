const express = require("express");
const path = require("path");

// ✅ นำเข้า Express Router สำหรับ API
const apiRoutes = require("./route/api"); 

// ✅ นำเข้าฟังก์ชันเชื่อมต่อฐานข้อมูล MongoDB
const { initDB } = require("./utils/db"); 

// ✅ นำเข้าและตั้งค่า dotenv เพื่อโหลดตัวแปรจากไฟล์ .env
require("dotenv").config();

const app = express();
// ดึงค่า PORT จาก .env หรือใช้ค่า default 1040
const PORT = process.env.PORT || 1040;

// Middleware สำหรับการจัดการ JSON request body
app.use(express.json());

// Middleware สำหรับเสิร์ฟไฟล์ Static (public/test5.html, style.css, ฯลฯ)
// นี่คือ Fallback ในกรณีที่ Nginx ไม่ได้ทำหน้าที่เสิร์ฟไฟล์ Static
app.use(express.static(path.join(__dirname, "../public")));

// --- การกำหนด Routes ---

// ✅ Redirect root / ไปยัง /test5 อัตโนมัติ
app.get("/", (req, res) => {
    res.redirect("/test5");
});

// ✅ หน้า test5 (Frontend App)
app.get("/test5", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/test5.html"));
});

// ✅ หน้า home (ถ้ามี index.html)
app.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ✅ ใช้งาน API routes
// ต้องมั่นใจว่า Path นี้ตรงกับที่ Nginx Proxy Manager ชี้เข้ามา (http://Host:1040/test5/api)
app.use("/test5/api", apiRoutes);

// ✅ Start server และเริ่มต้นฐานข้อมูล
app.listen(PORT, async () => {
    // เรียกใช้ initDB เพื่อเชื่อมต่อฐานข้อมูล MongoDB Atlas
    await initDB(); 
    console.log(`🚀 Server running at http://localhost:${PORT}/test5`);
});
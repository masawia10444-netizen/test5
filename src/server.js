const express = require("express");
const path = require("path");

// ✅ นำเข้า Express Router สำหรับ API
const apiRoutes = require("./api"); 

// ✅ นำเข้าฟังก์ชันเชื่อมต่อฐานข้อมูล MongoDB
const { initDB } = require("./utils/db"); 

// ✅ นำเข้าและตั้งค่า dotenv เพื่อโหลดตัวแปรจากไฟล์ .env
require("dotenv").config();

const app = express();
// ดึงค่า PORT จาก .env หรือใช้ค่า default 1040
const PORT = process.env.PORT || 1040;

// Middleware สำหรับการจัดการ JSON request body (ใช้ใน /login และ /notification)
app.use(express.json());

// --- การกำหนด Routes ---

// ✅ Redirect root ไป /test5 อัตโนมัติ
app.get("/", (req, res) => {
  res.redirect("/test5");
});

// ✅ หน้า test5
app.get("/test5", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/test5.html"));
});

// ✅ หน้า home (ถ้ามี)
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ✅ ใช้งาน API routes
app.use("/test5/api", apiRoutes);

// ✅ Start server + init DB
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Server running at http://localhost:${PORT}/test5`);
});

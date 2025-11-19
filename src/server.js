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

// --- การกำหนด Routes ---

// 1. ✅ Static Files (สำคัญมากสำหรับ NPM)
// บอก Express ว่า: Request ที่ขึ้นต้นด้วย /test5/ ให้มองหาไฟล์ใน public/
// Express จะตัด '/test5' ออกไป ทำให้ /test5/style.css ถูกมองเป็น /public/style.css
app.use("/test5", express.static(path.join(__dirname, "../public"))); 

// 2. ✅ Redirect Root
app.get("/", (req, res) => {
    res.redirect("/test5");
});

// 3. ✅ Frontend Main Page
// ไม่จำเป็นต้องมี .get() แยกสำหรับ /test5 เพราะ middleware ด้านบนจัดการ test5.html ได้แล้ว
// แต่ใส่ไว้เพื่อความชัดเจนในการ Redirect
app.get("/test5", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/test5.html"));
});

// 4. ✅ API Routes
// Endpoint ต้องเป็น /test5/api เพื่อรับ Request ที่มาจาก NPM
app.use("/test5/api", apiRoutes);

// 5. ✅ Start server และเริ่มต้นฐานข้อมูล
app.listen(PORT, async () => {
    // เรียกใช้ initDB เพื่อเชื่อมต่อฐานข้อมูล MongoDB Atlas
    await initDB(); 
    console.log(`🚀 Server running at http://localhost:${PORT}/test5`);
});
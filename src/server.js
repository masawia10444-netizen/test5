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

// 1. ✅ Static Files (สำหรับ CSS, JS, Fonts, Images, และ HTML)
// Express จะมองหาไฟล์ใน /public/ เมื่อ Path เริ่มต้นด้วย /test5
app.use("/test5", express.static(path.join(__dirname, "../public"))); 

// 2. ✅ Redirect Root: / ไปที่ /test5
app.get("/", (req, res) => {
    res.redirect("/test5");
});

// 3. ✅ Frontend Main Page: /test5
app.get("/test5", (req, res) => {
    // 💡 การแก้ไข: ใช้ path.resolve เพื่อสร้าง Absolute Path ที่แน่นอน
    // NOTE: เนื่องจากไฟล์จริงชื่อ Client_DGA.html เราจึงต้องเปลี่ยนชื่อไฟล์ตรงนี้ด้วย
    res.sendFile(path.resolve(__dirname, '..', 'public', 'Client_DGA.html')); 
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
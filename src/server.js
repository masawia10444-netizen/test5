// src/server.js (ปรับปรุง)
const express = require("express");
const path = require("path");
// ... (ส่วน require อื่นๆ)

// ... (ส่วน const app = express();)

app.use(express.json());

// ✅ เพิ่ม Middleware เพื่อเสิร์ฟไฟล์ Static บน Path /test5/
// นี่คือวิธีที่ถูกต้องในการบอก Express ว่า: ถ้า Request มาที่ /test5/ ให้มองหาไฟล์ใน public/
// Express จะตัด '/test5' ออกไป ทำให้ /test5/style.css ถูกมองเป็น /public/style.css
app.use("/test5", express.static(path.join(__dirname, "../public"))); 

// ❌ ลบหรือคอมเมนต์บรรทัดเก่าออก:
// app.use(express.static(path.join(__dirname, "../public")));


// ✅ Redirect root / ไปยัง /test5 อัตโนมัติ (ยังคงอยู่)
app.get("/", (req, res) => {
    res.redirect("/test5");
});

// ✅ หน้า test5 (Frontend App)
// ไม่ต้องใช้ .get อีกต่อไป เพราะ Middleware static ด้านบนจัดการ /test5/test5.html ให้แล้ว
// หากต้องการให้แน่ใจว่าทำงานได้ ให้ใช้:
app.get("/test5", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/test5.html"));
});


// ✅ ใช้งาน API routes
// ใช้ Path เต็มตามที่ NPM ส่งมา
app.use("/test5/api", apiRoutes);

// ✅ Start server และเริ่มต้นฐานข้อมูล
app.listen(PORT, async () => {
    // เรียกใช้ initDB เพื่อเชื่อมต่อฐานข้อมูล MongoDB Atlas
    await initDB(); 
    console.log(`🚀 Server running at http://localhost:${PORT}/test5`);
});
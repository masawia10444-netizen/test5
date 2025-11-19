const express = require("express");
const path = require("path");

// ... (ส่วน require อื่นๆ)
const apiRoutes = require("./route/api"); 
const { initDB } = require("./utils/db"); 

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 1040;

app.use(express.json());

// --- การกำหนด Routes ---

// 1. ✅ Static Files (สำหรับ CSS, JS, Fonts, Images)
// เมื่อ Request มาที่ /test5/style.css, Express จะมองหาไฟล์ใน public/style.css
app.use("/test5", express.static(path.join(__dirname, "../public"))); 

// 2. ✅ Redirect Root
app.get("/", (req, res) => {
    res.redirect("/test5");
});

// 3. ✅ Frontend Main Page (สำหรับเสิร์ฟ test5.html)
// เมื่อเข้าถึง https://czp-staging.biza.me/test5/
app.get("/test5", (req, res) => {
    // __dirname คือ /app/src/
    // Path ที่ถูกต้องคือ /app/public/test5.html
    res.sendFile(path.join(__dirname, "../public/test5.html")); 
});

// 4. ✅ API Routes
app.use("/test5/api", apiRoutes);

// 5. ✅ Start server
app.listen(PORT, async () => {
    await initDB(); 
    console.log(`🚀 Server running at http://localhost:${PORT}/test5`);
});
const mongoose = require("mongoose");

/**
 * @description เชื่อมต่อฐานข้อมูล MongoDB Atlas
 */
async function initDB() {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error("❌ MONGO_URI is not defined in the environment variables. Cannot start server.");
    // แนะนำให้ปิดโปรแกรมหากเชื่อมต่อ DB ไม่ได้
    // process.exit(1); 
    return;
  }

  try {
    console.log("⏳ Attempting to connect to MongoDB Atlas...");
    
    // ตั้งค่าตัวเลือกการเชื่อมต่อ Mongoose
    await mongoose.connect(mongoURI); 
    
    console.log("✅ MongoDB connected successfully!");
    
    // ตั้งค่า event listeners สำหรับการตรวจสอบข้อผิดพลาดหลังเชื่อมต่อ
    mongoose.connection.on('error', err => {
        console.error('⚠️ MongoDB connection error:', err);
    });

  } catch (error) {
    console.error("❌ Initial database connection failed:", error.message);
    // process.exit(1); 
  }
}

module.exports = { initDB };
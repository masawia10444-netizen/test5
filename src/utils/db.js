const mongoose = require("mongoose");

/**
 * @description เชื่อมต่อฐานข้อมูล MongoDB Atlas
 */
async function initDB() {
  // ดึง URI สำหรับเชื่อมต่อจากไฟล์ .env
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error("❌ MONGO_URI is not defined in the environment variables. Please check your .env file.");
    // ถ้าไม่มี URI จะไม่พยายามเชื่อมต่อ
    return;
  }

  try {
    console.log("⏳ Attempting to connect to MongoDB Atlas...");
    
    // เชื่อมต่อ Mongoose
    await mongoose.connect(mongoURI); 
    
    console.log("✅ MongoDB connected successfully!");
    
    // ตั้งค่า Event Listener สำหรับการตรวจสอบสถานะการเชื่อมต่อหลังเริ่มต้น
    mongoose.connection.on('error', err => {
        console.error('⚠️ MongoDB connection error (After initial connection):', err);
    });

  } catch (error) {
    console.error("❌ Initial database connection failed:", error.message);
    // แสดงข้อผิดพลาดหากเชื่อมต่อเริ่มต้นล้มเหลว
  }
}

// Export ฟังก์ชัน initDB เพื่อให้ server.js เรียกใช้ได้
module.exports = { initDB };
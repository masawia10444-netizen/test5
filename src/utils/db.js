const mongoose = require('mongoose');

const initDB = async () => {
    try {
        // ดึงค่า Connection String จาก .env
        // ถ้าไม่มีให้ใช้ localhost (Fallback)
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test5_database';
        
        // เริ่มเชื่อมต่อ
        await mongoose.connect(mongoURI);
        
        console.log('✅ MongoDB Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Failed:', error.message);
        // ถ้าต่อ Database ไม่ได้ ให้ปิด Server ทันที (เพื่อให้ Docker Restart)
        process.exit(1);
    }
};

module.exports = { initDB };
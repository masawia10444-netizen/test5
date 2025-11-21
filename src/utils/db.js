const mongoose = require('mongoose');

const initDB = async () => {
    try {
        // ดึงค่า Connection String จาก .env หรือใช้ค่า Default
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test5_database';
        
        await mongoose.connect(mongoURI, {
            // options ปัจจุบัน mongoose รุ่นใหม่จัดการให้ auto แล้ว แต่ใส่ไว้เผื่อ version เก่า
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });
        
        console.log('✅ MongoDB Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Failed:', error.message);
        // ปิด Process หากต่อ Database ไม่ได้ (เพื่อให้ Docker Restart)
        process.exit(1);
    }
};

module.exports = { initDB };
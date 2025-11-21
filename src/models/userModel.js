const mongoose = require('mongoose');

// กำหนด Schema สำหรับ User
const UserSchema = new mongoose.Schema({
    // userId: รหัสอ้างอิงจากระบบ DGA
    userId: {
        type: String,
        required: [true, 'User ID is required'],
        unique: true,
        maxlength: 50,
        trim: true,
    },
    
    // citizenId: เลขบัตรประชาชน (สำคัญมาก ใช้เป็น Key หลักในการค้นหา)
    citizenId: {
        type: String,
        required: [true, 'Citizen ID is required'],
        unique: true,
        maxlength: 13,
        trim: true,
    },

    firstname: {
        type: String,
        required: [true, 'First name is required'],
        maxlength: 100,
        trim: true,
    },

    lastname: {
        type: String,
        required: [true, 'Last name is required'],
        maxlength: 100,
        trim: true,
    },

    mobile: {
        type: String,
        maxlength: 10,
        trim: true,
    },

    email: {
        type: String,
        maxlength: 100,
        trim: true,
    },
}, {
    // timestamps: true จะสร้าง created_at และ updated_at ให้อัตโนมัติ
    timestamps: true, 
    collection: 'User' 
});

// สร้าง Model จาก Schema
const User = mongoose.model('User', UserSchema);

module.exports = User;
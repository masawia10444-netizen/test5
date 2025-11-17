const mongoose = require('mongoose');

// กำหนด Schema สำหรับ User
const UserSchema = new mongoose.Schema({
    // userId (เทียบเท่า VARCHAR(50) UNIQUE NOT NULL)
    userId: {
        type: String,
        required: [true, 'User ID is required'],
        unique: true,
        maxlength: 50,
        trim: true,
    },
    
    // citizenId (เทียบเท่า VARCHAR(13) UNIQUE NOT NULL)
    citizenId: {
        type: String,
        required: [true, 'Citizen ID is required'],
        unique: true,
        maxlength: 13,
        trim: true,
    },

    // firstname (เทียบเท่า VARCHAR(100) NOT NULL)
    firstname: {
        type: String,
        required: [true, 'First name is required'],
        maxlength: 100,
        trim: true,
    },

    // lastname (เทียบเท่า VARCHAR(100) NOT NULL)
    lastname: {
        type: String,
        required: [true, 'Last name is required'],
        maxlength: 100,
        trim: true,
    },

    // mobile (เทียบเท่า VARCHAR(10) - ไม่มี NOT NULL)
    mobile: {
        type: String,
        maxlength: 10,
        trim: true,
    },

    // email (เทียบเท่า VARCHAR(100) - ไม่มี NOT NULL)
    email: {
        type: String,
        maxlength: 100,
        trim: true,
    },
}, {
    // ตัวเลือก timestamps: true จะสร้างฟิลด์ createdAt และ updatedAt (เทียบเท่า created_at)
    timestamps: true, 
    // กำหนดชื่อ Collection ใน MongoDB
    collection: 'User' 
});

// สร้าง Model จาก Schema
const User = mongoose.model('User', UserSchema);

module.exports = User;
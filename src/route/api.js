const express = require("express");
const router = express.Router();
const axios = require("axios");

// ✅ นำเข้า Mongoose Model (ต้องแน่ใจว่า path ถูกต้อง: src/models/userModel.js)
const UserModel = require("../models/userModel"); 

require("dotenv").config();

// กำหนดตัวแปร ENV ที่ชัดเจนสำหรับ DGA (อ้างอิงจาก .env ที่เคยให้มา)
const DGA_CONSUMER_KEY = process.env.DGA_CONSUMER_KEY_NOTI || process.env.CONSUMER_KEY;
const DGA_AGENT_ID = process.env.DGA_AGENT_ID_AUTH || process.env.AGENT_ID;
const DGA_CONSUMER_SECRET = process.env.DGA_CONSUMER_SECRET_AUTH || process.env.CONSUMER_SECRET;


console.log("🔧 Loaded ENV Check:", {
    'DGA_AGENT_ID': DGA_AGENT_ID,
    'DGA_CONSUMER_KEY': DGA_CONSUMER_KEY,
    'DGA_CONSUMER_SECRET': DGA_CONSUMER_SECRET ? "✅ Defined" : "❌ MISSING",
});

const axiosInstance = axios.create({
    timeout: 10000,
});

// --- API Endpoints ---

/**
 * ✅ NEW: Endpoint สำหรับดึงค่า ENV Config ที่ไม่เป็นความลับ (ใช้สำหรับ Debug หน้า Frontend)
 */
router.get("/env-config", (req, res) => {
    // ส่งเฉพาะค่าที่ไม่ใช่ความลับกลับไปให้ Frontend
    res.json({
        AGENT_ID: DGA_AGENT_ID,
        CONSUMER_KEY: DGA_CONSUMER_KEY,
    });
});

/**
 * ✅ STEP 1: Validate และขอ Token จาก eGov
 */
router.get("/validate", async (req, res) => {
    try {
        console.log("🚀 [START] /api/validate");

        const url = `${process.env.DGA_AUTH_URL}?ConsumerSecret=${DGA_CONSUMER_SECRET}&AgentID=${DGA_AGENT_ID}`; 
        
        const response = await axiosInstance.get(url, {
            headers: {
                "Consumer-Key": DGA_CONSUMER_KEY,
                "Content-Type": "application/json",
            },
        });

        if (!response.data.Result) throw new Error("Invalid Token Response");

        res.json({
            success: true,
            token: response.data.Result,
        });
    } catch (err) {
        console.error("💥 Validate Error:", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            message: "การ Validate token ล้มเหลว",
            error: err.response?.data || err.message,
        });
    }
});

/**
 * ✅ STEP 2: Login, ดึงข้อมูลผู้ใช้, และบันทึก/อัปเดต (UPSERT) ลง MongoDB
 */
router.post("/login", async (req, res) => {
    try {
        console.log("🚀 [START] /api/login");
        const { appId, mToken, token } = req.body;

        if (!appId || !mToken || !token)
            return res.status(400).json({ success: false, message: "Missing appId, mToken, or token" });

        const apiUrl = process.env.DGA_API_URL; 

        const headers = {
            "Consumer-Key": DGA_CONSUMER_KEY,
            "Content-Type": "application/json",
            Token: token,
        };

        const response = await axiosInstance.post(
            apiUrl,
            { appId: appId, mToken: mToken },
            { headers }
        );

        const result = response.data;

        if (result.messageCode !== 200)
            throw new Error(result.message || "CZP API Error");

        const user = result.result;

        // 💾 Save to DB: Mongoose findOneAndUpdate (UPSERT)
        try {
            const upsertedUser = await UserModel.findOneAndUpdate(
                // 1. Query: ใช้ citizenId เป็นเงื่อนไขหลักในการค้นหา
                { citizenId: user.citizenId },
                // 2. Update/Set: ตั้งค่าฟิลด์ที่จะอัปเดตหรือสร้างใหม่
                {
                    userId: user.userId, 
                    firstname: user.firstName, 
                    lastname: user.lastName, 
                    mobile: user.mobile,
                    email: user.email,
                },
                // 3. Options: upsert: true คือถ้าไม่เจอให้สร้างใหม่
                { upsert: true, new: true, setDefaultsOnInsert: true } 
            );

            console.log(`💾 User saved/updated successfully (ID: ${upsertedUser._id})`);
        } catch (dbErr) {
            console.error("⚠️ Database UPSERT error:", dbErr.message); 
        }

        res.json({
            success: true,
            message: "ดึงข้อมูลจาก CZP สำเร็จ",
            user,
        });
    } catch (err) {
        console.error("💥 Login Error:", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการเชื่อมต่อกับ CZP",
            error: err.response?.data || err.message,
        });
    }
});

/**
 * ✅ STEP 3: ส่ง Notification ไปยัง eGov
 */
router.post("/notification", async (req, res) => {
    try {
        console.log("🚀 [START] /api/notification");

        const { appId, userId, token, message, sendDateTime } = req.body;

        if (!appId || !userId || !token)
            return res.status(400).json({
                success: false,
                message: "Missing appId, userId, or token",
            });

        const Urlnoti = process.env.DGA_NOTI_API_URL; 

        const headers = {
            "Consumer-Key": DGA_CONSUMER_KEY,
            "Content-Type": "application/json",
            Token: token,
        };

        const body = {
            appId: appId,
            data: [
                {
                    message: message || "ทดสอบข้อความ", 
                    userId: userId,
                },
            ],
            sendDateTime: sendDateTime || null
        };

        const response = await axiosInstance.post(Urlnoti, body, { headers });
        const result = response.data;

        res.json({
            success: true,
            message: "ส่ง Notification สำเร็จ",
            result,
        });
    } catch (err) {
        console.error("💥 Notification Error:", err.response?.data || err.message);
        res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการส่ง Notification",
            error: err.response?.data || err.message,
        });
    }
});

module.exports = router;
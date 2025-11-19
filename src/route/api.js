const express = require("express");
const router = express.Router();
const axios = require("axios");

// ❌ ลบ const { pool } = require("../db"); (ถ้าคุณเปลี่ยนเป็น MongoDB แล้ว)
// ✅ นำเข้า Mongoose Model (User)
const UserModel = require("../models/userModel"); 

require("dotenv").config();

// กำหนดตัวแปร ENV ที่ชัดเจนสำหรับ DGA
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

/**
 * ✅ NEW: Endpoint สำหรับดึงค่า ENV Config (ใช้ Debug Frontend)
 */
router.get("/env-config", (req, res) => {
    res.json({
        AGENT_ID: DGA_AGENT_ID,
        CONSUMER_KEY: DGA_CONSUMER_KEY,
    });
});

/**
 * ✅ STEP 1: Validate และขอ Token จาก eGov (เมธอด GET ตาม DGA)
 */
/**
 * ✅ STEP 1: Validate และขอ Token จาก eGov (เมธอด GET ตาม DGA)
 */
router.get("/validate", async (req, res) => { 
    try {
        // ... (โค้ดสร้าง URL และส่ง Request ไป DGA)

        const response = await axiosInstance.get(url, {
            headers: {
                "Consumer-Key": DGA_CONSUMER_KEY, 
                "Content-Type": "application/json", 
            },
        });
        
        // 1. ตรวจสอบสถานะ: ถ้าไม่ใช่ 200 ให้ส่ง Error ทันที
        if (response.status !== 200 || !response.data.Result) {
            // หาก DGA คืน 403, Axios จะ throw error ก่อนถึงบรรทัดนี้
            throw new Error(`Invalid Token Response or status ${response.status}`);
        }
        
        const token = response.data.Result; 

        res.json({
            success: true,
            token: token,
            agentId: DGA_AGENT_ID, 
            consumerKey: DGA_CONSUMER_KEY,
        });
    } catch (err) {
        console.error("💥 Validate Error:", err.response?.data || err.message);
        
        // 2. 💡 แก้ไข: ดึง HTTP Status Code จาก Axios Error และส่งกลับไปให้ Frontend
        const status = err.response?.status || 500;
        
        // ถ้าเป็น 403 ให้ระบุชัดเจนว่าเป็น Forbidden
        const message = status === 403 ? "Forbidden: IP Whitelist หรือ Secrets ผิดพลาด" : "การ Validate token ล้มเหลว";

        res.status(status).json({
            success: false,
            message: message,
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
        // รับค่า AppId, MToken และ Token จาก Frontend
        const { appId, mToken, token } = req.body; 

        if (!appId || !mToken || !token) {
            return res.status(400).json({ success: false, message: "Missing AppId, MToken, or Token" });
        }

        const apiUrl = process.env.DGA_API_URL; 

        // Headers: Consumer-Key, Content-Type, Token
        const headers = {
            "Consumer-Key": DGA_CONSUMER_KEY,
            "Content-Type": "application/json",
            "Token": token,
        };
        
        // Request Body: AppId, MToken
        const requestBody = {
            "AppId": appId,
            "MToken": mToken,
        };

        const response = await axiosInstance.post(
            apiUrl,
            requestBody, 
            { headers } 
        );

        const result = response.data;

        if (result.messageCode !== 200) {
            throw new Error(result.message || "CZP API Error");
        }

        const user = result.result; 

        // 💾 Save to DB: Mongoose findOneAndUpdate (UPSERT)
        try {
            await UserModel.findOneAndUpdate(
                { citizenId: user.citizenId },
                {
                    userId: user.userId, 
                    firstname: user.firstName, 
                    lastname: user.lastName, 
                    mobile: user.mobile, 
                    email: user.email,
                },
                { upsert: true, new: true, setDefaultsOnInsert: true } 
            );
            console.log(`💾 User saved/updated successfully.`);
        } catch (dbErr) {
            console.error("⚠️ Database UPSERT error:", dbErr.message); 
        }

        // 5. Response
        res.json({
            success: true,
            message: "ดึงข้อมูลจาก CZP สำเร็จ",
            user: user, // ส่ง Object user กลับไปให้ Frontend
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

        if (!appId || !userId || !token) {
            return res.status(400).json({
                success: false,
                message: "Missing appId, userId, or token",
            });
        }

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
const express = require("express");
const router = express.Router();
const axios = require("axios");

// ❌ ลบการนำเข้า PostgreSQL pool และแทนที่ด้วย Mongoose Model
// const { pool } = require("../db"); 

// ✅ นำเข้า Mongoose Model (User)
// ต้องแน่ใจว่ามีไฟล์ src/models/userModel.js แล้วนะครับ
const UserModel = require("../models/userModel"); 

require("dotenv").config();

// กำหนดตัวแปร ENV ที่ชัดเจนสำหรับ DGA (ใช้ชื่อตัวแปรที่กำหนดไว้)
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
 * ✅ STEP 1: Validate และขอ Token จาก eGov
 */
router.get("/validate", async (req, res) => { 
    try {
        console.log("🚀 [START] /api/validate");

        // ใช้ DGA_AUTH_URL และ Secrets จากตัวแปรที่กำหนดไว้
        const url = `${process.env.DGA_AUTH_URL}?ConsumerSecret=${DGA_CONSUMER_SECRET}&AgentID=${DGA_AGENT_ID}`; 
        
        const response = await axiosInstance.get(url, {
            headers: {
                "Consumer-Key": DGA_CONSUMER_KEY,
                "Content-Type": "application/json",
            },
        });

        // 1. ตรวจสอบสถานะ
        if (response.status !== 200 || !response.data.Result) {
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
        
        const status = err.response?.status || 500;
        let message = "การ Validate token ล้มเหลว";
        if (status === 403) {
            message = "Forbidden: IP Whitelist หรือ Secrets ผิดพลาด";
        }

        res.status(status).json({
            success: false,
            message: message,
            error: err.response?.data || err.message,
        });
    }
});

/**
 * ✅ STEP 2: ใช้ token จาก validate + appId + mToken เพื่อขอข้อมูลผู้ใช้
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
            "Token": token,
        };

        console.log("🌐 [STEP] Calling DGA:", apiUrl);
        const response = await axiosInstance.post(
            apiUrl,
            { appId: appId, mToken: mToken },
            { headers }
        );

        const result = response.data;
        console.log("✅ DGA Response:", result);

        if (result.messageCode !== 200)
            throw new Error(result.message || "CZP API Error");

        const user = result.result;

        // ✅ Save to DB (ใช้ Mongoose UPSERT แทน SQL)
        try {
            await UserModel.findOneAndUpdate(
                // 1. Query: ค้นหาด้วย citizenId
                { citizenId: user.citizenId },
                // 2. Update/Set: ข้อมูลผู้ใช้ใหม่
                {
                    userId: user.userId, 
                    firstname: user.firstName, 
                    lastname: user.lastName, 
                    mobile: user.mobile, 
                    email: user.email,
                },
                // 3. Options: upsert: true (Update or Insert)
                { upsert: true, new: true, setDefaultsOnInsert: true } 
            );
            console.log("💾 User saved successfully to MongoDB");
        } catch (dbErr) {
            console.error("⚠️ Database UPSERT error:", dbErr.message);
        }

        res.json({
            success: true,
            message: "ดึงข้อมูลจาก CZP สำเร็จ",
            user: user,
        });
    } catch (err) {
        console.error("💥 Login Error:", err.response?.data || err.message);
        const status = err.response?.status || 500;
        res.status(status).json({
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

        // ✅ ดึงข้อมูลจาก body ที่ frontend ส่งมา
        const { appId, userId, token, message, sendDateTime } = req.body;

        console.log("📥 Notification Request Body:", req.body);
        if (!appId || !userId || !token)
            return res.status(400).json({
                success: false,
                message: "Missing appId, userId, or token",
            });

        const Urlnoti = process.env.DGA_NOTI_API_URL; 

        // ✅ Header ตามคู่มือ DGA
        const headers = {
            "Consumer-Key": DGA_CONSUMER_KEY,
            "Content-Type": "application/json",
            "Token": token,
        };

        // ✅ Body ตามรูปแบบที่คุณต้องการ
        const body = {
            appId: appId,
            data: [
                {
                    message: message || "ทดสอบข้อความ", // ค่า default
                    userId: userId,
                },
            ],
            sendDateTime: sendDateTime || null
        };

        console.log("🌐 [STEP] Calling DGA:", Urlnoti);

        const response = await axiosInstance.post(Urlnoti, body, { headers });
        const result = response.data;

        console.log("✅ DGA Response:", result);

        res.json({
            success: true,
            message: "ส่ง Notification สำเร็จ",
            result,
        });
    } catch (err) {
        console.error("💥 Notification Error:", err.response?.data || err.message);
        const status = err.response?.status || 500;
        res.status(status).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการส่ง Notification",
            error: err.response?.data || err.message,
        });
    }
});

module.exports = router;
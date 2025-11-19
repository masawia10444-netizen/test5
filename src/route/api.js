const express = require("express");
const router = express.Router();
const axios = require("axios");

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
router.get("/validate", async (req, res) => { 
    try {
        console.log("🚀 [START] /api/validate (GET)");

        // 💡 1. ดึงค่าจาก Query Parameters ที่ Frontend อาจส่งมา (เช่น appId, mToken)
        const frontendAppId = req.query.appId;
        const frontendMToken = req.query.mToken;

        // 2. กำหนดค่า Secrets ที่ใช้ในการเรียก DGA (ใช้ค่าจาก .env เสมอเพื่อความปลอดภัย)
        const finalSecret = DGA_CONSUMER_SECRET; // Secret Key
        const finalAgentId = DGA_AGENT_ID;       // Agent ID

        // 3. สร้าง Request URL สำหรับ DGA Validate
        // NOTE: เราใช้ finalSecret และ finalAgentId ที่มาจาก ENV เสมอ
        const url = `${process.env.DGA_AUTH_URL}?ConsumerSecret=${finalSecret}&AgentID=${finalAgentId}`; 
        
        const response = await axiosInstance.get(url, {
            headers: {
                "Consumer-Key": DGA_CONSUMER_KEY, 
                "Content-Type": "application/json", 
            },
        });

        // 4. ตรวจสอบสถานะ
        if (response.status !== 200 || !response.data.Result) {
            throw new Error(`Invalid Token Response or status ${response.status}`);
        }
        
        const token = response.data.Result; 

        // 5. Response (ส่ง Token และค่า Debug กลับไป)
        res.json({
            success: true,
            token: token,
            agentId: finalAgentId, 
            consumerKey: DGA_CONSUMER_KEY,
            // 💡 เพิ่มค่าที่ Frontend ส่งมากลับไปเผื่อใช้ Debug
            appIdReceived: frontendAppId || 'N/A',
            mTokenReceived: frontendMToken || 'N/A',
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
 * ✅ STEP 2: Login, ดึงข้อมูลผู้ใช้, และบันทึก/อัปเดต (UPSERT) ลง MongoDB
 */
router.post("/login", async (req, res) => {
    try {
        console.log("🚀 [START] /api/login");
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

        // 1. ตรวจสอบสถานะ DGA (MessageCode 200)
        if (result.messageCode !== 200) {
            throw new Error(result.message || "CZP API Error");
        }

        const user = result.result; 

        // 2. 💾 Save to DB: Mongoose findOneAndUpdate (UPSERT)
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
            // ไม่ได้ throw error ที่นี่ เพื่อให้ Response ยังคงสำเร็จ หากแค่ DB มีปัญหาชั่วคราว
        }

        // 3. Response
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
        const status = err.response?.status || 500;
        res.status(status).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการส่ง Notification",
            error: err.response?.data || err.message,
        });
    }
});

module.exports = router;
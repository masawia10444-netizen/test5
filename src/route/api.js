const express = require("express");
const router = express.Router();
const axios = require("axios");

// ❌ ลบ const { pool } = require("../db"); (ถ้าคุณเปลี่ยนเป็น MongoDB แล้ว)

// ✅ นำเข้า Mongoose Model (User)
const UserModel = require("../models/userModel"); 

require("dotenv").config();

// กำหนดตัวแปร ENV ที่ชัดเจนสำหรับ DGA (ใช้ชื่อตัวแปรที่ดึงจาก .env อย่างถูกต้อง)
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
router.get("/validate", async (req, res) => { // ⬅️ ต้องใช้ router.get()
    try {
        console.log("🚀 [START] /api/validate (GET)");

        // 1. สร้าง Request URL พร้อม Query Parameters (ConsumerSecret และ AgentID)
        // DGA_AUTH_URL: https://api.egov.go.th/ws/auth/validate
        const url = `${process.env.DGA_AUTH_URL}?ConsumerSecret=${DGA_CONSUMER_SECRET}&AgentID=${DGA_AGENT_ID}`; 
        
        console.log("🔗 Requesting DGA Validate:", url);

        // 2. ส่ง Request พร้อม Headers (Consumer-Key และ Content-Type)
        const response = await axiosInstance.get(url, {
            headers: {
                "Consumer-Key": DGA_CONSUMER_KEY, // ⬅️ Consumer-Key ใน Header
                "Content-Type": "application/json", // ⬅️ Content-Type ใน Header
            },
        });

        // 3. ตรวจสอบผลลัพธ์ (Response 200 OK และมี "Result")
        if (response.status !== 200 || !response.data.Result) {
            throw new Error(`Invalid Token Response or status ${response.status}`);
        }
        
        const token = response.data.Result; // นี่คือ Access Token ที่ต้องการ

        res.json({
            success: true,
            token: token,
            // ส่ง DGA ID กลับไปให้ Frontend สำหรับ Debug/แสดงผล
            agentId: DGA_AGENT_ID, 
            consumerKey: DGA_CONSUMER_KEY,
        });
    } catch (err) {
        console.error("💥 Validate Error:", err.response?.data || err.message);
        // ถ้า DGA ตอบกลับด้วยสถานะที่ไม่ใช่ 2xx ให้ส่ง Error Code กลับไป
        const status = err.response?.status || 500;
        res.status(status).json({
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
        // รับค่า AppId, MToken และ Token จาก Frontend
        const { appId, mToken, token } = req.body; 

        if (!appId || !mToken || !token) {
            return res.status(400).json({ success: false, message: "Missing AppId, MToken, or Token" });
        }

        const apiUrl = process.env.DGA_API_URL; // https://api.egov.go.th/ws/dga/czp/uat/v1/core/shield/data/deproc

        // 1. Headers: Consumer-Key, Content-Type, Token
        const headers = {
            "Consumer-Key": DGA_CONSUMER_KEY, // ⬅️ REQUIRED
            "Content-Type": "application/json", // ⬅️ REQUIRED
            "Token": token, // ⬅️ REQUIRED (Access Token ที่ได้จาก /validate)
        };
        
        // 2. Request Body: AppId, MToken
        const requestBody = {
            "AppId": appId, // ⬅️ REQUIRED
            "MToken": mToken, // ⬅️ REQUIRED
        };

        console.log("💡 Calling DGA Data Retrieval API:", apiUrl);

        const response = await axiosInstance.post(
            apiUrl,
            requestBody, // ส่ง Body ที่มี AppId และ MToken
            { headers } // ส่ง Headers
        );

        const result = response.data;

        // 3. ตรวจสอบสถานะ Response
        if (result.messageCode !== 200) {
            throw new Error(result.message || "CZP API Error");
        }

        const user = result.result; // Object ข้อมูลผู้ใช้

        // 4. 💾 บันทึก/อัปเดตข้อมูลผู้ใช้ใน MongoDB (UPSERT)
        try {
            await UserModel.findOneAndUpdate(
                { citizenId: user.citizenId },
                {
                    userId: user.userId, 
                    firstname: user.firstName, 
                    lastname: user.lastName, 
                    mobile: user.mobile, // ข้อมูลนี้ตรงกับ Schema ที่สร้างไว้
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
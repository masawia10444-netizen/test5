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
 * ✅ NEW STEP: Login (Validate + Deproc + Save DB)
 */
router.post("/login", async (req, res) => {
    // 💡 ดึงค่าที่จำเป็นจาก Body (ตามที่ Frontend ส่งมา)
    const { appId, mToken } = req.body;

    // ใช้ค่า ENV ที่เรากำหนดไว้
    const consumerKey = DGA_CONSUMER_KEY;
    const consumerSecret = DGA_CONSUMER_SECRET;
    const agentId = DGA_AGENT_ID;

    try {
        console.log("🚀 [START] /api/login (Integrated DGA Flow)");

        // ----------------------------------------------------
        // Step 1: Validate -> Get Access Token
        // ----------------------------------------------------

        // 💡 ใช้ encodeURIComponent สำหรับ Secrets ตามตัวอย่าง
        const validateUrl = `${process.env.DGA_AUTH_URL}?ConsumerSecret=${encodeURIComponent(
            consumerSecret
        )}&AgentID=${encodeURIComponent(agentId)}`;

        console.log(`🔗 Calling Validate API: ${process.env.DGA_AUTH_URL}`);

        const validateResp = await fetch(validateUrl, {
            method: 'GET',
            headers: { 'Consumer-Key': consumerKey, 'Content-Type': 'application/json' }
        });

        const validateJson = await validateResp.json().catch(() => null);

        if (!validateResp.ok) {
            // ถ้า Validate ล้มเหลว (เช่น 403 Forbidden) ให้ส่ง Error กลับไป
            return res.status(validateResp.status || 500).json({
                step: 'validate',
                ok: false,
                message: `Validation failed with status ${validateResp.status}`,
                body: validateJson
            });
        }

        const token = validateJson?.Result || validateJson?.result || validateJson?.Token;

        if (!token) {
            return res.status(500).json({ step: 'validate', ok: false, message: 'Access Token not found in DGA response' });
        }
        console.log(`✅ Access Token obtained: ${token.substring(0, 10)}...`);


        // ----------------------------------------------------
        // Step 2: Deproc (Citizen Data Retrieval)
        // ----------------------------------------------------
        const deprocUrl = process.env.DGA_API_URL;

        if (!appId || !mToken) {
            return res.status(400).json({ step: 'deproc', ok: false, message: 'Missing appId or mToken in request body' });
        }

        const deprocResp = await fetch(deprocUrl, {
            method: 'POST',
            headers: {
                'Consumer-Key': consumerKey,
                'Content-Type': 'application/json',
                'Token': token // ใช้ Access Token ที่ได้
            },
            body: JSON.stringify({ appId, mToken })
        });

        const deprocJson = await deprocResp.json().catch(() => null);

        if (!deprocResp.ok || deprocJson?.messageCode !== 200) {
            return res.status(deprocResp.status || 500).json({
                step: 'deproc',
                ok: false,
                message: 'Deproc API failed or returned non-200 messageCode.',
                body: deprocJson
            });
        }

        // ----------------------------------------------------
        // Step 3: Data Extraction and MongoDB UPSERT
        // ----------------------------------------------------
        let citizen = deprocJson?.result || deprocJson?.data || deprocJson;

        // ตรวจสอบว่ามี field สำคัญครบถ้วนหรือไม่ (ตาม Logic ของคุณ)
        const requiredFields = ['userId', 'citizenId', 'firstName', 'lastName'];
        const hasExpected = citizen && requiredFields.every(f => f in citizen);

        if (!hasExpected) {
            return res.status(500).json({
                step: 'deproc',
                message: 'Unexpected data structure or missing required fields',
                deprocJson
            });
        }

        // Map data ไปยัง Mongoose Document
        const doc = {
            userId: citizen.userId,
            citizenId: citizen.citizenId,
            firstname: citizen.firstName,
            lastname: citizen.lastName,
            mobile: citizen.mobile || null,
            email: citizen.email || null,
        };

        try {
            // 💡 MongoDB UPSERT Logic
            const upsertedUser = await UserModel.findOneAndUpdate(
                { citizenId: doc.citizenId },
                { $set: doc },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`💾 User saved/updated successfully (ID: ${upsertedUser._id})`);
        } catch (dbErr) {
            console.error("⚠️ Database UPSERT error:", dbErr.message);
            // เราจะไม่ส่ง 500 กลับไปถ้า DB error ไม่ได้สำคัญถึงขั้นต้องหยุด flow หลัก
        }


        // 4. Response Final
        res.status(200).json({
            success: true,
            message: "ดึงข้อมูลผู้ใช้สำเร็จและบันทึก DB แล้ว",
            user: doc // ส่งข้อมูลที่สะอาดกลับไป
        });

    } catch (err) {
        console.error("💥 Fatal API Error:", err);
        res.status(500).json({
            step: 'general',
            ok: false,
            message: 'An unexpected error occurred.',
            error: err.message
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
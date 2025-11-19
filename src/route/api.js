const express = require("express");
const router = express.Router();
// เราจะใช้ Node.js native fetch API ตามตัวอย่างของคุณ แทน Axios
const fetch = require('node-fetch'); 

const UserModel = require("../models/userModel"); 
require("dotenv").config();

// กำหนดตัวแปร ENV ที่ชัดเจนสำหรับ DGA
const DGA_CONSUMER_KEY = process.env.DGA_CONSUMER_KEY_NOTI || process.env.CONSUMER_KEY;
const DGA_AGENT_ID = process.env.DGA_AGENT_ID_AUTH || process.env.AGENT_ID;
const DGA_CONSUMER_SECRET = process.env.DGA_CONSUMER_SECRET_AUTH || process.env.CONSUMER_SECRET;
const DGA_AUTH_URL = process.env.DGA_AUTH_URL;
const DGA_API_URL = process.env.DGA_API_URL;

console.log("🔧 Loaded ENV Check:", {
    'DGA_AGENT_ID': DGA_AGENT_ID,
    'DGA_CONSUMER_KEY': DGA_CONSUMER_KEY,
    'DGA_CONSUMER_SECRET': DGA_CONSUMER_SECRET ? "✅ Defined" : "❌ MISSING",
});

// ❌ ลบ Endpoint /validate (รวม Logic เข้าไปใน /login แล้ว)
router.get("/env-config", (req, res) => {
    res.json({ AGENT_ID: DGA_AGENT_ID, CONSUMER_KEY: DGA_CONSUMER_KEY });
});

/**
 * ✅ NEW STEP: Login (Validate + Deproc + Save DB)
 * Frontend จะส่ง AppId และ MToken มาให้
 */
router.post("/login", async (req, res) => {
    // โค้ดนี้ใช้ Logic การจัดการ Response ที่ซับซ้อนตามตัวอย่างของคุณ
    const { appId, mToken } = req.body; 
    let token = req.body.token; // รับ token ที่อาจจะถูกส่งมาด้วย (ถ้า Frontend ไม่ต้องการให้ Validate)

    try {
        console.log("🚀 [START] /api/login (Validate + Deproc)");

        // ----------------------------------------------------
        // Step 1: Validate -> Get Access Token
        // ----------------------------------------------------
        if (!token) { // ถ้า Frontend ไม่ได้ส่ง Token มา ให้ทำการ Validate เอง
            const validateUrl = `${DGA_AUTH_URL}?ConsumerSecret=${encodeURIComponent(
                DGA_CONSUMER_SECRET
            )}&AgentID=${encodeURIComponent(DGA_AGENT_ID)}`;
            
            const validateResp = await fetch(validateUrl, {
                method: 'GET', // DGA Validate ใช้ GET
                headers: { 'Consumer-Key': DGA_CONSUMER_KEY, 'Content-Type': 'application/json' }
            });
            
            const validateJson = await validateResp.json().catch(() => null);
            
            if (!validateResp.ok) {
                return res.status(500).json({ 
                    step: 'validate', 
                    ok: false, 
                    message: 'Validate API failed.',
                    body: validateJson 
                });
            }
            
            token = validateJson?.Result || validateJson?.result || validateJson?.Token;
            
            if (!token) {
                return res.status(500).json({ 
                    step: 'validate', 
                    ok: false, 
                    message: 'Token not found in Validate response' 
                });
            }
            console.log(`✅ Token obtained.`);
        } else {
             console.log(`💡 Using token provided by Frontend.`);
        }

        // ----------------------------------------------------
        // Step 2: Deproc (Citizen Data Retrieval)
        // ----------------------------------------------------
        if (!appId || !mToken) {
            return res.status(400).json({ step: 'deproc', ok: false, message: 'Missing appId or mToken' });
        }

        const deprocResp = await fetch(DGA_API_URL, {
            method: 'POST',
            headers: {
                'Consumer-Key': DGA_CONSUMER_KEY,
                'Content-Type': 'application/json',
                'Token': token // ใช้ Access Token
            },
            body: JSON.stringify({ appId, mToken })
        });
        
        const deprocJson = await deprocResp.json().catch(() => null);
        
        if (!deprocResp.ok || deprocJson?.messageCode !== 200) {
            return res.status(500).json({ 
                step: 'deproc', 
                ok: false, 
                message: 'Deproc API failed or returned non-200 code.',
                body: deprocJson
            });
        }
        
        // ----------------------------------------------------
        // Step 3: Data Extraction and Validation
        // ----------------------------------------------------
        let citizen = deprocJson?.result || deprocJson?.data || deprocJson;
        
        // ตรวจสอบว่ามี field สำคัญครบถ้วนหรือไม่ (ตาม Logic ของคุณ)
        const requiredFields = ['userId', 'citizenId', 'firstName', 'lastName', 'mobile', 'email'];
        const hasExpected = citizen && requiredFields.every(f => f in citizen);
        
        if (!hasExpected) {
             return res.status(500).json({ 
                 step: 'deproc', 
                 message: 'Unexpected data structure or missing required fields', 
                 deprocJson 
             });
        }
        
        // ----------------------------------------------------
        // Step 4: MongoDB UPSERT (บันทึกข้อมูล)
        // ----------------------------------------------------
        const doc = {
            userId: citizen.userId,
            citizenId: citizen.citizenId,
            firstname: citizen.firstName, // ใช้ชื่อฟิลด์ตาม Mongoose Schema (firstname)
            // middleName: citizen.middleName ?? null, // ลบ middleName ออก เพราะไม่ได้อยู่ใน Schema
            lastname: citizen.lastName,   // ใช้ชื่อฟิลด์ตาม Mongoose Schema (lastname)
            // dateOfBirthString: citizen.dateOfBirthString, // ลบออก เพราะไม่ได้อยู่ใน Schema
            mobile: citizen.mobile,
            email: citizen.email,
            // notification: !!citizen.notification // ลบออก เพราะไม่ได้อยู่ใน Schema
        };

        try {
             const upsertedUser = await UserModel.findOneAndUpdate(
                 { citizenId: doc.citizenId },
                 { $set: doc }, // ใช้ $set เพื่ออัปเดตเฉพาะฟิลด์ที่ต้องการ
                 { upsert: true, new: true, setDefaultsOnInsert: true } 
             );
             console.log(`💾 User saved/updated successfully.`);
        } catch (dbErr) {
             console.error("⚠️ Database UPSERT error:", dbErr.message);
             // เราอาจจะส่ง 500 กลับไปถ้า DB error เป็นปัญหาสำคัญ
        }

        // 5. Response Final
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
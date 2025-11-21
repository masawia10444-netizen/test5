const express = require("express");
const router = express.Router();
const axios = require("axios");
const UserModel = require("../models/userModel"); 

require("dotenv").config();

// Load Env Variables
const DGA_CONSUMER_KEY = process.env.DGA_CONSUMER_KEY_NOTI || process.env.CONSUMER_KEY;
const DGA_AGENT_ID = process.env.DGA_AGENT_ID_AUTH || process.env.AGENT_ID;
const DGA_CONSUMER_SECRET = process.env.DGA_CONSUMER_SECRET_AUTH || process.env.CONSUMER_SECRET;

const axiosInstance = axios.create({ timeout: 10000 });

// --- Debug Route ---
router.get("/env-config", (req, res) => {
    res.json({
        AGENT_ID: DGA_AGENT_ID,
        AUTH_URL: process.env.DGA_AUTH_URL,
        STATUS: "Ready"
    });
});

// --- 1. Validate Token ---
router.get("/validate", async (req, res) => { 
    try {
        console.log("🚀 [1] Starting Validate...");

        // Safety Check: ป้องกัน URL ผิด (เช่นมี google link ติดมา)
        if (!process.env.DGA_AUTH_URL || process.env.DGA_AUTH_URL.includes('google.com')) {
            throw new Error("❌ Config Error: DGA_AUTH_URL ไม่ถูกต้อง (มี Google Link ติดมา)");
        }

        const url = `${process.env.DGA_AUTH_URL}?ConsumerSecret=${DGA_CONSUMER_SECRET}&AgentID=${DGA_AGENT_ID}`; 
        
        const response = await axiosInstance.get(url, {
            headers: {
                "Consumer-Key": DGA_CONSUMER_KEY,
                "Content-Type": "application/json",
            },
        });

        if (response.status !== 200 || !response.data.Result) {
            throw new Error(`Invalid Token Response: ${response.status}`);
        }
        
        console.log("✅ Validate Success");
        res.json({
            success: true,
            token: response.data.Result,
            agentId: DGA_AGENT_ID
        });
    } catch (err) {
        console.error("💥 Validate Error:", err.message);
        res.status(500).json({ success: false, message: "Validate Failed", error: err.message });
    }
});

// --- 2. Login / Get Data ---
router.post("/login", async (req, res) => {
    try {
        console.log("🚀 [2] Starting Login...");
        const { appId, mToken, token } = req.body;

        if (!appId || !mToken || !token)
            return res.status(400).json({ success: false, message: "Missing parameters" });

        const apiUrl = process.env.DGA_API_URL;
        const headers = {
            "Consumer-Key": DGA_CONSUMER_KEY,
            "Content-Type": "application/json",
            "Token": token,
        };

        // ✅ FIX: ส่งเป็น PascalCase (ตัวพิมพ์ใหญ่) ตาม Document DGA
        // DGA Spec ต้องการ: "AppId" และ "MToken"
        const payload = {
            AppId: appId,
            MToken: mToken
        };

        console.log("🌐 Calling DGA API:", apiUrl);
        const response = await axiosInstance.post(apiUrl, payload, { headers });
        const result = response.data;

        // บางที API ตอบ 200 แต่มี messageCode บอก Error
        if (result.messageCode && result.messageCode !== 200)
            throw new Error(result.message || "DGA API Error");

        const user = result.result || result;

        // ✅ Save/Update to MongoDB
        if (user && user.citizenId) {
            await UserModel.findOneAndUpdate(
                { citizenId: user.citizenId },
                {
                    userId: user.userId, 
                    firstname: user.firstName || user.firstname, 
                    lastname: user.lastName || user.lastname,
                    mobile: user.mobile, 
                    email: user.email,
                },
                { upsert: true, new: true, setDefaultsOnInsert: true } 
            );
            console.log("💾 User saved to DB");
        }

        res.json({ success: true, user: user });
    } catch (err) {
        console.error("💥 Login Error:", err.response?.data || err.message);
        res.status(500).json({ success: false, message: "Login Failed", error: err.message });
    }
});

// --- 3. Notification ---
router.post("/notification", async (req, res) => {
    try {
        const { appId, userId, token, message, sendDateTime } = req.body;
        const headers = {
            "Consumer-Key": DGA_CONSUMER_KEY,
            "Content-Type": "application/json",
            "Token": token,
        };

        const body = {
            appId: appId,
            data: [{ message: message || "Notification Test", userId: userId }],
            sendDateTime: sendDateTime || null
        };

        const response = await axiosInstance.post(process.env.DGA_NOTI_API_URL, body, { headers });
        res.json({ success: true, result: response.data });
    } catch (err) {
        console.error("💥 Noti Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
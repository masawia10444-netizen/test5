// src/routes/api.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { pool } = require("../db");
require("dotenv").config();

console.log("🔧 Loaded ENV:", {
  AGENT_ID: process.env.AGENT_ID,
  CONSUMER_KEY: process.env.CONSUMER_KEY,
  CONSUMER_SECRET: process.env.CONSUMER_SECRET ? "✅" : "❌ MISSING",
});

const axiosInstance = axios.create({
  timeout: 10000,
});

/**
 * ✅ STEP 1: Validate และขอ Token จาก eGov
 */
router.get("/validate", async (req, res) => {
  try {
    console.log("🚀 [START] /api/validate");

    const { AGENT_ID, CONSUMER_KEY, CONSUMER_SECRET } = process.env;
    const url = `https://api.egov.go.th/ws/auth/validate?ConsumerSecret=${CONSUMER_SECRET}&AgentID=${AGENT_ID}`;

    console.log("🔗 Requesting:", url);

    const response = await axiosInstance.get(url, {
      headers: {
        "Consumer-Key": CONSUMER_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Validate success:", response.data);

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
 * ✅ STEP 2: ใช้ token จาก validate + appId + mToken เพื่อขอข้อมูลผู้ใช้
 */
router.post("/login", async (req, res) => {
  try {
    console.log("🚀 [START] /api/login");
    const { appId, mToken, token } = req.body;

    if (!appId || !mToken || !token)
      return res
        .status(400)
        .json({ success: false, message: "Missing appId, mToken, or token" });

    const apiUrl =
      "https://api.egov.go.th/ws/dga/czp/uat/v1/core/shield/data/deproc";

    const headers = {
      "Consumer-Key": process.env.CONSUMER_KEY,
      "Content-Type": "application/json",
      Token: token,
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

    // ✅ Save to DB
    try {
      await pool.query(
        `INSERT INTO "User" (userId, citizenId, firstname, lastname, mobile, email)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (citizenId) DO UPDATE
         SET firstname = EXCLUDED.firstname,
             lastname = EXCLUDED.lastname,
             mobile = EXCLUDED.mobile,
             email = EXCLUDED.email;`,
        [
          user.userId,
          user.citizenId,
          user.firstName,
          user.lastName,
          user.mobile,
          user.email,
        ]
      );
      console.log("💾 User saved successfully");
    } catch (dbErr) {
      console.warn("⚠️ Database insert error:", dbErr.message);
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

    // ✅ ดึงข้อมูลจาก body ที่ frontend ส่งมา
    const { appId, userId, token, message, sendDateTime } = req.body;

    console.log("📥 Notification Request Body:", req.body);
    if (!appId || !userId || !token)
      return res.status(400).json({
        success: false,
        message: "Missing appId, userId, or token",
      });

    const Urlnoti =
      "https://api.egov.go.th/ws/dga/czp/uat/v1/core/notification/push";

    // ✅ Header ตามคู่มือ DGA
    const headers = {
      "Consumer-Key": process.env.CONSUMER_KEY,
      "Content-Type": "application/json",
      Token: token,
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
    console.log("📦 Body:", JSON.stringify(body, null, 2));

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
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการส่ง Notification",
      error: err.response?.data || err.message,
    });
  }
});

module.exports = router;

const express = require("express");
const path = require("path");
const apiRoutes = require("./routes/api");
const { initDB } = require("./db");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ✅ Redirect root ไป /test5 อัตโนมัติ
app.get("/", (req, res) => {
  res.redirect("/test5");
});

// ✅ หน้า test5
app.get("/test5", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/test5.html"));
});

// ✅ หน้า home (ถ้ามี)
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ✅ ใช้งาน API routes
app.use("/test5/api", apiRoutes);

// ✅ Start server + init DB
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Server running at http://localhost:${PORT}/test5`);
});

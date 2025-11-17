# 1. Base Stage: ใช้ Node.js เป็น Base Image
FROM node:20-alpine AS base

# กำหนด Working Directory ภายในคอนเทนเนอร์
WORKDIR /app

# 2. Dependencies Stage: ติดตั้ง dependencies
FROM base AS dependencies
COPY package*.json ./
# ใช้ --only=production เพื่อติดตั้งเฉพาะ dependencies ที่จำเป็นสำหรับการรัน
RUN npm install --only=production

# 3. Development/Build Stage (สำหรับ production, เราจะข้ามส่วนนี้ แต่ถ้าต้องการ build frontend ก็จะทำตรงนี้)
# FROM base AS build 
# COPY . .
# RUN npm run build # หากมีคำสั่ง build สำหรับ frontend

# 4. Production Stage: เตรียม Image สำหรับ Production
FROM base AS production
# Copy dependencies ที่ติดตั้งแล้วจาก Dependencies Stage
COPY --from=dependencies /app/node_modules ./node_modules
# Copy โค้ดทั้งหมด
COPY . .

# กำหนด Environment Variables 
# (สำหรับ ENV ที่ไม่เป็นความลับ เช่น PORT, ส่วน SECRET จะถูก inject ผ่าน docker-compose)
ENV PORT=1040

# Expose Port ที่ Express Server ใช้
EXPOSE 1040

# คำสั่งเริ่มต้นรันเซิร์ฟเวอร์
CMD ["node", "src/server.js"]
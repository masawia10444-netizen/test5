### 1️⃣ ติดตั้ง dependencies
```bash
npm install

## รัน PostgreSQL ด้วย Docker
docker run --name czp-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=czp_db -p 5432:5432 -d postgres

## ตรวจสอบฐานข้อมูล:
docker exec -it czp-db psql -U postgres -d czp_db

## รันระบบ Backend (Express)
node server.js

## หรือในโหมด dev:
npx nodemon server.js

## การรันทั้งหมดผ่าน Docker Compose (ถ้ามี docker-compose.yml)
docker compose up --build

## หรือถ้าต้องการรันเบื้องหลัง (detached mode):
docker compose up -d

##Restart / Stop Container
docker restart czp-db
docker stop czp-db


## สำหรับนักพัฒนา (Dev Tips)

## รันระบบในโหมดปกติ
npm start	
# รันแบบ auto-reload เมื่อแก้ไขไฟล์
npx nodemon server.js	
# ตรวจสอบ container ที่กำลังทำงาน
docker ps	
# ดู log ของ PostgreSQL
docker logs czp-db	
# เข้าฐานข้อมูลใน container
docker exec -it czp-db psql -U postgres -d czp_db	
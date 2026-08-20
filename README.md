# HYBRID // TRAIN

เว็บแอปออกกำลังกายส่วนตัวแบบ PWA สำหรับ iPhone ใช้งานได้ฟรีบน Vercel

## Deploy บน Vercel

1. สร้างบัญชีฟรีที่ [vercel.com](https://vercel.com)
2. อัปโหลดโฟลเดอร์นี้ไปยัง GitHub repository ใหม่ (หรือใช้ Vercel CLI)
3. ใน Vercel กด **Add New → Project** แล้วเลือก repository นั้น
4. กด **Deploy** โดยไม่ต้องตั้งค่า Build Command หรือ Framework
5. เปิดลิงก์ที่ Vercel ให้ด้วย Safari บน iPhone แล้วกด **Share → Add to Home Screen**

แอปนี้เป็น static site จึงไม่ต้องใช้ฐานข้อมูลหรือค่าใช้จ่ายของเซิร์ฟเวอร์ ข้อมูลการออกกำลังกายเก็บในเบราว์เซอร์ของเครื่อง จึงควรใช้ Export ในหน้า “เพิ่มเติม” เพื่อสำรองข้อมูลเป็นระยะ

## สิ่งที่มีในแอป

- ตาราง 12 สัปดาห์จากไฟล์ Hybrid Aesthetic Calisthenics + Marathon
- โปรแกรม Upper A, Lower + Core, Upper B, recovery และแผนวิ่ง
- บันทึกจำนวนครั้ง น้ำหนัก และติ๊กแต่ละเซ็ต
- ตัวจับเวลาของเซสชันและเวลาพัก 60/90 วินาที
- บันทึกการวิ่ง ระยะทาง เวลา และ RPE
- สร้างโปรแกรมเอง และ Import/Export ข้อมูล

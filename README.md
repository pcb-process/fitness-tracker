# HYBRID // TRAIN

เว็บแอปออกกำลังกายแบบ PWA สำหรับ iPhone ใช้งานได้ฟรีบน Vercel พร้อมรองรับ Supabase สำหรับหลายผู้ใช้และหลายโปรแกรม

## เปิดใช้ Login + Database

1. สร้างโปรเจกต์ฟรีใน [Supabase](https://supabase.com/dashboard)
2. เปิด **SQL Editor** แล้วรันไฟล์ `supabase/schema.sql`
3. จาก **Project Settings → API** คัดลอก Project URL และ Publishable key (หรือ anon key)
4. ใส่ค่าทั้งสองใน `supabase-config.js` โดยห้ามใช้ `service_role` key
5. ใน **Authentication → URL Configuration** เพิ่ม URL ของ Vercel เป็น Redirect URL
6. Deploy ใหม่บน Vercel

หลังเชื่อมแล้ว ผู้ใช้จะสมัคร/ล็อกอินด้วยอีเมลและรหัสผ่านได้ ข้อมูลถูกแยกด้วย Row Level Security ตามบัญชี และกดชื่อโปรแกรมด้านขวาบนเพื่อสร้างหรือสลับโปรแกรมได้

ในหน้า **Settings** ยังมีปุ่ม **Choose program**, **Edit profile**, **Friends** และ **Log out**. การค้นหาเพื่อนใช้ username ที่เจ้าของบัญชีเลือกเปิดให้ค้นหาเท่านั้น; อีเมลและบันทึกการออกกำลังกายจะไม่ถูกเปิดเผย.

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

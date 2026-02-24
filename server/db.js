// server/db.js

// 1. เรียกใช้ dotenv เพื่อให้อ่านค่าจากไฟล์ .env ได้
require('dotenv').config();

const { Pool } = require('pg');

// 2. สร้างการเชื่อมต่อ โดยดึงค่ามาจาก .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true // Neon บังคับให้ใช้ SSL เพื่อความปลอดภัย
    }
});

// 3. (Optional) ลองเทสดูว่าต่อติดไหม
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ เชื่อมต่อ Database ไม่สำเร็จ:', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('❌ Query ไม่ได้:', err.stack);
        }
        console.log('✅ เชื่อมต่อ Neon Database สำเร็จ! เวลาของ Server คือ:', result.rows[0].now);
    });
});

module.exports = pool;

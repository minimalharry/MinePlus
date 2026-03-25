const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'IP',
    user: 'USER',
    password: 'PASS',
    database: 'DB',
    port: 3306
});

db.connect(err => {
    if (err) {
        console.error('DB Error:', err);
    } else {
        console.log('✅ MySQL Connected');

        // 🔥 AUTO TABLE CREATE
        db.query(`
            CREATE TABLE IF NOT EXISTS embeds (
                name VARCHAR(255) PRIMARY KEY,
                data JSON
            )
        `);

        db.query(`
            CREATE TABLE IF NOT EXISTS config (
                type VARCHAR(50) PRIMARY KEY,
                data JSON
            )
        `);
    }
});

module.exports = db;
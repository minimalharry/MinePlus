const db = require('../../database/db');

module.exports = {

    async set(type, data) {
        return new Promise((resolve, reject) => {
            db.query(
                'REPLACE INTO config (type, data) VALUES (?, ?)',
                [type, JSON.stringify(data)],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    },

    async get(type) {
        return new Promise((resolve) => {
            db.query(
                'SELECT data FROM config WHERE type = ?',
                [type],
                (err, results) => {
                    if (err || results.length === 0) return resolve(null);
                    try {
                        resolve(JSON.parse(results[0].data));
                    } catch {
                        console.error(`[config_store] Invalid JSON for type "${type}". Returning null.`);
                        resolve(null);
                    }
                }
            );
        });
    }

};

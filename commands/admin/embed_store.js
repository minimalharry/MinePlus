const db = require('../../database/db');

module.exports = {

    async set(name, data) {
        return new Promise((resolve, reject) => {
            db.query(
                'REPLACE INTO embeds (name, data) VALUES (?, ?)',
                [name, JSON.stringify(data)],
                err => err ? reject(err) : resolve()
            );
        });
    },

    async get(name) {
        return new Promise((resolve) => {
            db.query(
                'SELECT data FROM embeds WHERE name = ?',
                [name],
                (err, results) => {
                    if (err || !results.length) return resolve(null);
                    resolve(JSON.parse(results[0].data));
                }
            );
        });
    },

    async has(name) {
        return new Promise((resolve) => {
            db.query(
                'SELECT name FROM embeds WHERE name = ?',
                [name],
                (err, results) => {
                    resolve(results && results.length > 0);
                }
            );
        });
    },

    async delete(name) {
        return new Promise((resolve) => {
            db.query('DELETE FROM embeds WHERE name = ?', [name], () => resolve());
        });
    },

    async list() {
        return new Promise((resolve) => {
            db.query('SELECT name FROM embeds', (err, results) => {
                if (err || !results) return resolve([]);
                resolve(results.map(r => r.name));
            });
        });
    }
};
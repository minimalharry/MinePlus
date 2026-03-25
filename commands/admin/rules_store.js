const db = require('../../database/db');
const ensureArray = require('../../utils/ensureArray');

module.exports = {

    async getAll() {
        return new Promise(resolve => {
            db.query(
                'SELECT data FROM config WHERE type = ?',
                ['rules_panels'],
                (err, res) => {
                    if (err || !res.length) return resolve([]);
                    try {
                        resolve(ensureArray(JSON.parse(res[0].data), 'rules_store:getAll'));
                    } catch {
                        resolve([]);
                    }
                }
            );
        });
    },

    async saveAll(data) {
        return new Promise(resolve => {
            db.query(
                'REPLACE INTO config (type, data) VALUES (?, ?)',
                ['rules_panels', JSON.stringify(data)],
                () => resolve()
            );
        });
    },

    async get(id) {
        const all = await this.getAll();
        return all.find(x => x.id === id);
    },

    async set(panel) {
        let all = ensureArray(await this.getAll(), 'rules_store:set');

        const index = all.findIndex(x => x.id === panel.id);

        if (index !== -1) all[index] = panel;
        else all.push(panel);

        await this.saveAll(all);
    },

    async delete(id) {
        let all = ensureArray(await this.getAll(), 'rules_store:delete');
        all = all.filter(x => x.id !== id);
        await this.saveAll(all);
    }
};

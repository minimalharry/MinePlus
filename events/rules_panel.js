const store = require('../commands/admin/rules_store');

module.exports = (client) => {

    client.on('interactionCreate', async interaction => {

        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('rule_')) return;

        try {

            const parts = interaction.customId.split('_');
            const id = parts[1];
            const index = parseInt(parts[2]);

            const panel = await store.get(id);
            if (!panel) {
                return interaction.reply({ content: '❌ Panel not found', flags: 64 });
            }

            const btn = panel.buttons[index];
            if (!btn) {
                return interaction.reply({ content: '❌ Rule not found', flags: 64 });
            }

            await interaction.reply({
                content: btn.content || 'No content',
                flags: 64
            });

        } catch (err) {
            console.error(err);
        }
    });
};
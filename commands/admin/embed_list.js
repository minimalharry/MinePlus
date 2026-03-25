const { SlashCommandBuilder } = require('discord.js');
const embedStore = require('./embed_store');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed-list')
        .setDescription('List all embeds'),

    async execute(interaction) {

        const embeds = await embedStore.list();

        if (!embeds.length) {
            return interaction.reply({
                content: '❌ No embeds found',
                flags: 64
            });
        }

        return interaction.reply({
            content: `📦 Embeds:\n\n${embeds.join('\n')}`,
            flags: 64
        });
    }
};
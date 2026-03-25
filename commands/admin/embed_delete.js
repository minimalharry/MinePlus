const { SlashCommandBuilder } = require('discord.js');
const embedStore = require('./embed_store');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed-delete')
        .setDescription('Delete an embed')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Embed name')
                .setRequired(true)
        ),

    async execute(interaction) {

        const name = interaction.options.getString('name');

        if (!(await embedStore.has(name))) {
            return interaction.reply({
                content: '❌ Embed not found',
                flags: 64
            });
        }

        await embedStore.delete(name);

        return interaction.reply({
            content: `✅ Deleted embed **${name}**`,
            flags: 64
        });
    }
};
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embedStore = require('./embed_store');
const config = require('./config_store');
const ensureArray = require('../../utils/ensureArray');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription('Autoresponder system')

        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add autoresponder')
                .addStringOption(opt =>
                    opt.setName('trigger').setDescription('Trigger').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('message').setDescription('Message').setRequired(false))
                .addStringOption(opt =>
                    opt.setName('embed').setDescription('Embed name').setRequired(false))
        )

        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete autoresponder')
                .addStringOption(opt =>
                    opt.setName('trigger').setDescription('Trigger').setRequired(true))
        )

        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List autoresponders')
        ),

    async execute(interaction) {

        const sub = interaction.options.getSubcommand();
        let list = ensureArray(await config.get('autoresponder'), 'autoresponder:get');
        await config.set('autoresponder', list);

        // ===== ADD =====
        if (sub === 'add') {
            const trigger = interaction.options.getString('trigger');
            const message = interaction.options.getString('message');
            const embed = interaction.options.getString('embed');

            if (!message && !embed)
                return interaction.reply({ content: '❌ Provide message or embed', flags: MessageFlags.Ephemeral });

            if (embed && !(await embedStore.has(embed)))
                return interaction.reply({ content: '❌ Embed not found', flags: MessageFlags.Ephemeral });

            console.log('Type of list:', typeof list, list);
            list = ensureArray(list, 'autoresponder:before-push');

            list.push({
                trigger: trigger.toLowerCase(),
                message: message || null,
                embed: embed || null
            });

            await config.set('autoresponder', list);

            return interaction.reply({ content: `✅ Added trigger **${trigger}**`, flags: MessageFlags.Ephemeral });
        }

        // ===== DELETE =====
        if (sub === 'delete') {
            const trigger = interaction.options.getString('trigger');

            list = list.filter(x => x.trigger !== trigger.toLowerCase());
            await config.set('autoresponder', list);

            return interaction.reply({ content: `🗑️ Deleted **${trigger}**`, flags: MessageFlags.Ephemeral });
        }

        // ===== LIST =====
        if (sub === 'list') {

            if (!list.length)
                return interaction.reply({ content: '❌ No autoresponders', flags: MessageFlags.Ephemeral });

            return interaction.reply({
                content: list.map(x => `• ${x.trigger}`).join('\n'),
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

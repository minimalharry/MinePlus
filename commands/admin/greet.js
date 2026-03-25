const { SlashCommandBuilder } = require('discord.js');
const embedStore = require('./embed_store');
const config = require('./config_store');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('greet')
        .setDescription('Greeting system')

        .addSubcommand(sub =>
            sub.setName('set-channel')
                .setDescription('Set welcome channel')
                .addChannelOption(opt =>
                    opt.setName('channel').setDescription('Channel').setRequired(true))
        )

        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set greeting')
                .addStringOption(opt =>
                    opt.setName('message').setDescription('Message').setRequired(false))
                .addStringOption(opt =>
                    opt.setName('embed').setDescription('Embed').setRequired(false))
        )

        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete greeting')
        )

        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show greeting config')
        )

        .addSubcommand(sub =>
            sub.setName('greeting-test')
                .setDescription('Test greeting message')
        ),

    async execute(interaction) {

        const sub = interaction.options.getSubcommand();
        let cfg = await config.get('greet') || {};

        // ===== SET CHANNEL =====
        if (sub === 'set-channel') {
            const channel = interaction.options.getChannel('channel');
            cfg.channel = channel.id;

            await config.set('greet', cfg);

            return interaction.reply({ content: `✅ Channel set to ${channel}`, flags: 64 });
        }

        // ===== SET =====
        if (sub === 'set') {
            const message = interaction.options.getString('message');
            const embed = interaction.options.getString('embed');

            if (!message && !embed)
                return interaction.reply({ content: '❌ Provide message or embed', flags: 64 });

            if (embed && !(await embedStore.has(embed)))
                return interaction.reply({ content: '❌ Embed not found', flags: 64 });

            cfg.message = message || null;
            cfg.embed = embed || null;

            await config.set('greet', cfg);

            return interaction.reply({ content: '✅ Greeting set', flags: 64 });
        }

        // ===== DELETE =====
        if (sub === 'delete') {
            await config.set('greet', {});
            return interaction.reply({ content: '🗑️ Greeting removed', flags: 64 });
        }

        // ===== LIST =====
        if (sub === 'list') {
            return interaction.reply({
                content:
`Channel: ${cfg.channel || 'None'}
Message: ${cfg.message || 'None'}
Embed: ${cfg.embed || 'None'}`,
                flags: 64
            });
        }

        // ===== TEST =====
        if (sub === 'greeting-test') {

            if (!cfg.channel)
                return interaction.reply({ content: '❌ No channel set', flags: 64 });

            const channel = interaction.guild.channels.cache.get(cfg.channel);
            if (!channel)
                return interaction.reply({ content: '❌ Channel not found', flags: 64 });

            let embed = null;

            if (cfg.embed) {
                const data = await embedStore.get(cfg.embed);

                if (data) {
                    embed = new EmbedBuilder()
                        .setColor(data.color || '#00ff88')
                        .setTitle(data.title || null)
                        .setDescription(
                            (data.description || '')
                                .replace('{user}', interaction.user.username)
                                .replace('{mention}', `<@${interaction.user.id}>`)
                        );
                }
            }

            await channel.send({
                content: cfg.message
                    ? cfg.message
                        .replace('{user}', interaction.user.username)
                        .replace('{mention}', `<@${interaction.user.id}>`)
                    : undefined,
                embeds: embed ? [embed] : []
            });

            return interaction.reply({
                content: '✅ Test message sent',
                flags: 64
            });
        }
    }
};
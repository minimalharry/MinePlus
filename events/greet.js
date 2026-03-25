const config = require('../commands/admin/config_store');
const embedStore = require('../commands/admin/embed_store');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {

    client.on('guildMemberAdd', async member => {

        const cfg = await config.get('greet');
        if (!cfg || !cfg.channel) return;

        const channel = member.guild.channels.cache.get(cfg.channel);
        if (!channel) return;

        let embed = null;

        if (cfg.embed) {
            const data = await embedStore.get(cfg.embed);

            if (data) {
                embed = new EmbedBuilder()
                    .setColor(data.color || '#00ff88')
                    .setTitle(data.title || null)
                    .setDescription(
                        (data.description || '')
                        .replace('{user}', member.user.username)
                        .replace('{mention}', `<@${member.id}>`)
                    );
            }
        }

        await channel.send({
            content: cfg.message
                ? cfg.message
                    .replace('{user}', member.user.username)
                    .replace('{mention}', `<@${member.id}>`)
                : undefined,
            embeds: embed ? [embed] : []
        });
    });

};
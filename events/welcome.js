const embedStore = require('../commands/admin/embed_store');
const config = require('../commands/admin/config_store');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {

    client.on('guildMemberAdd', member => {

        if (!config.greeting) return;

        const data = embedStore.get(config.greeting);
        if (!data) return;

        const embed = new EmbedBuilder()
            .setColor(data.color || '#00ff88')
            .setTitle(data.title || null)
            .setDescription(
                (data.description || '')
                    .replace('{mention}', `<@${member.id}>`)
                    .replace('{server}', member.guild.name)
            );

        if (data.author?.name) embed.setAuthor(data.author);
        if (data.footer?.text) embed.setFooter(data.footer);

        member.guild.systemChannel?.send({ embeds: [embed] });
    });

};
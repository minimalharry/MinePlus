const embedStore = require('../commands/admin/embed_store');
const config = require('../commands/admin/config_store');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {

    client.on('messageCreate', async message => {
        if (message.author.bot) return;

        const list = await config.get('autoresponder');
        if (!list || !Array.isArray(list)) return;

        for (const cfg of list) {

            if (!message.content.toLowerCase().includes(cfg.trigger)) continue;

            let embed = null;

            // 🔥 embed
            if (cfg.embed) {
                const data = await embedStore.get(cfg.embed);
                if (data) {
                    embed = new EmbedBuilder()
                        .setColor(data.color || '#00ff88')
                        .setTitle(data.title || null)
                        .setDescription(data.description || null);

                    if (data.author?.name) embed.setAuthor(data.author);
                    if (data.footer?.text) embed.setFooter(data.footer);
                    if (data.image) embed.setImage(data.image);
                    if (data.thumbnail) embed.setThumbnail(data.thumbnail);
                }
            }

            await message.reply({
                content: cfg.message || undefined,
                embeds: embed ? [embed] : []
            });

            break; // 🔥 only first match
        }
    });

};
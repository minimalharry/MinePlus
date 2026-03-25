const embedStore = require('../commands/admin/embed_store');
const { EmbedBuilder } = require('discord.js');

module.exports = function getEmbed(name) {
    const data = embedStore.get(name);
    if (!data) return null;

    const embed = new EmbedBuilder()
        .setColor(data.color || '#00ff88')
        .setTitle(data.title || null)
        .setDescription(data.description || null);

    if (data.author?.name) embed.setAuthor(data.author);
    if (data.footer?.text) embed.setFooter(data.footer);
    if (data.image) embed.setImage(data.image);
    if (data.thumbnail) embed.setThumbnail(data.thumbnail);

    return embed;
};
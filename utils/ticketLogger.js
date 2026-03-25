const fs = require('fs');
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { generateTranscript } = require('./transcript');

function formatFooterDate(ts) {
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

async function buildTranscriptAttachment(channel) {
  const { filePath, messageCount } = await generateTranscript(channel);
  const size = fs.statSync(filePath).size;
  return {
    filePath,
    messageCount,
    size,
    attachment: new AttachmentBuilder(filePath, { name: `ticket-${channel.id}.html` })
  };
}

async function sendTicketCloseLog({ guild, logChannelId, channel, closedBy, ownerUser, ownerId, reason, closedAt, transcriptAttachment, transcriptTooLarge }) {
  if (!logChannelId) return;

  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

  const unix = Math.floor(closedAt / 1000);
  const embed = new EmbedBuilder()
    .setTitle('📁 Ticket Log')
    .setColor(0xFF0000)
    .addFields(
      { name: 'Ticket', value: channel.name || 'Unknown', inline: false },
      { name: 'Closed By', value: `<@${closedBy.id}>`, inline: true },
      { name: 'Owner', value: ownerUser ? `<@${ownerUser.id}> (${ownerUser.tag})` : `<@${ownerId || 'unknown'}>`, inline: true },
      { name: 'Reason', value: reason || 'No reason', inline: false },
      { name: 'Closed At', value: `<t:${unix}:F>`, inline: false }
    )
    .setFooter({ text: `Closed at ${formatFooterDate(closedAt)}` })
    .setTimestamp(closedAt);

  const files = [];
  if (transcriptAttachment && !transcriptTooLarge) files.push(transcriptAttachment);

  if (transcriptTooLarge) {
    embed.addFields({ name: 'Transcript', value: 'Transcript generated but file is too large to upload.' });
  }

  await logChannel.send({ embeds: [embed], files }).catch(() => null);
}

module.exports = {
  buildTranscriptAttachment,
  sendTicketCloseLog
};

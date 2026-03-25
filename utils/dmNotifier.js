const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const cooldownMap = new Map();
const DM_COOLDOWN_MS = 5000;

function key(channelId, userId) {
  return `${channelId}:${userId}`;
}

function isCoolingDown(channelId, userId) {
  const k = key(channelId, userId);
  const now = Date.now();
  const last = cooldownMap.get(k) || 0;
  if (now - last < DM_COOLDOWN_MS) return true;
  cooldownMap.set(k, now);
  return false;
}

async function notifyTicketOwnerOnStaffReply({ message, ownerId, staffDisplayName }) {
  if (!ownerId) return;
  if (isCoolingDown(message.channel.id, ownerId)) return;

  const owner = await message.client.users.fetch(ownerId).catch(() => null);
  if (!owner) return;

  const content = (message.content?.trim() || '[embed/attachment]').slice(0, 1024);

  const embed = new EmbedBuilder()
    .setTitle('🔔 New Reply in Your Ticket')
    .setDescription('A staff member has replied to your ticket.')
    .addFields(
      { name: 'Staff', value: `<@${message.author.id}>`, inline: true },
      { name: 'Message', value: content, inline: false }
    )
    .setColor('#5865F2')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('Go to Ticket')
      .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}`)
  );

  await owner.send({ embeds: [embed], components: [row] }).catch(() => null);
}

async function notifyTicketClosed({ client, ownerId, transcriptAttachment }) {
  if (!ownerId) return;
  const owner = await client.users.fetch(ownerId).catch(() => null);
  if (!owner) return;

  const payload = {
    content: 'Your ticket has been closed.'
  };

  if (transcriptAttachment) payload.files = [transcriptAttachment];

  await owner.send(payload).catch(() => null);
}

async function notifyTicketClaimed({ client, ownerId, claimerId }) {
  if (!ownerId || !claimerId || ownerId === claimerId) return;

  const owner = await client.users.fetch(ownerId).catch(() => null);
  if (!owner) return;

  await owner.send({ content: `<@${claimerId}> is now handling your ticket.` }).catch(() => null);
}

async function notifyUserCalled({ client, ownerId, staffId, guildId, channelId }) {
  const owner = await client.users.fetch(ownerId).catch(() => null);
  if (!owner) return false;

  const embed = new EmbedBuilder()
    .setTitle('📢 You Have Been Called')
    .setDescription('A staff member has requested your attention in your ticket.')
    .addFields(
      { name: 'Staff', value: `<@${staffId}>`, inline: true },
      { name: 'Ticket', value: `<#${channelId}>`, inline: true }
    )
    .setColor('#FEE75C')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('Go to Ticket')
      .setURL(`https://discord.com/channels/${guildId}/${channelId}`)
  );

  const sent = await owner.send({ embeds: [embed], components: [row] }).then(() => true).catch(() => false);
  return sent;
}

module.exports = {
  notifyTicketOwnerOnStaffReply,
  notifyTicketClosed,
  notifyTicketClaimed,
  notifyUserCalled
};

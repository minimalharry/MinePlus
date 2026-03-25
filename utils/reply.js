const { MessageFlags } = require('discord.js');

function normalizeOptions(options = {}) {
  const next = { ...options };

  if (Object.prototype.hasOwnProperty.call(next, 'ephemeral')) {
    if (next.ephemeral) {
      next.flags = MessageFlags.Ephemeral;
    }
    delete next.ephemeral;
  }

  return next;
}

function reply(interaction, options = {}) {
  return interaction.reply(normalizeOptions(options));
}

function followUp(interaction, options = {}) {
  return interaction.followUp(normalizeOptions(options));
}

function editReply(interaction, options = {}) {
  return interaction.editReply(normalizeOptions(options));
}

module.exports = {
  normalizeOptions,
  reply,
  followUp,
  editReply
};

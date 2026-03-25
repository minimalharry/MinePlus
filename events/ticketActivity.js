const ticketManager = require('../utils/ticketManager');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    await ticketManager.handleTicketMessage(message).catch(() => null);
  });

  client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    await ticketManager.cleanupDeletedTicket(channel.guild.id, channel.id).catch(() => null);
  });
};

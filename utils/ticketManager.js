const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} = require('discord.js');

const db = require('../database/db');
const { buildTranscriptAttachment, sendTicketCloseLog } = require('./ticketLogger');
const { canClaim, isStaffMember } = require('./claimSystem');
const {
  notifyTicketOwnerOnStaffReply,
  notifyTicketClosed,
  notifyTicketClaimed,
  notifyUserCalled
} = require('./dmNotifier');

const SESSION_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_INACTIVE_CLOSE_MINUTES = 24 * 60;
const MAX_DISCORD_FILE_SIZE = 8 * 1024 * 1024;
const setupSessions = new Map();
const closeReasonStore = new Map();

function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function updateGuildConfig(guildId, updater) {
  const rows = await dbQuery('SELECT data FROM config WHERE type = ?', [guildId]);
  let payload = {};

  if (rows?.[0]?.data) {
    try {
      payload = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    } catch {
      payload = {};
    }
  }

  updater(payload);

  await dbQuery(
    'INSERT INTO config (type, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
    [guildId, JSON.stringify(payload)]
  );

  return payload;
}

function defaultTicketSystem() {
  return {
    panels: {},
    tickets: {},
    history: {},
    settings: {
      allowOneTicketPerUser: true,
      autoCloseMinutes: DEFAULT_INACTIVE_CLOSE_MINUTES,
      logChannelId: null,
      ticketsCategoryId: null
    }
  };
}

async function getTicketSystem(guildId) {
  const rows = await dbQuery('SELECT data FROM config WHERE type = ?', [guildId]);
  let payload = {};

  if (rows?.[0]?.data) {
    try {
      payload = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
    } catch {
      payload = {};
    }
  }

  const current = payload.ticketSystem || {};
  const defaults = defaultTicketSystem();

  return {
    ...defaults,
    ...current,
    panels: { ...defaults.panels, ...(current.panels || {}) },
    tickets: { ...defaults.tickets, ...(current.tickets || {}) },
    history: { ...defaults.history, ...(current.history || {}) },
    settings: { ...defaults.settings, ...(current.settings || {}) }
  };
}

async function saveTicketSystem(guildId, ticketSystem) {
  await updateGuildConfig(guildId, data => {
    data.ticketSystem = ticketSystem;
  });
}

function sessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function isHexColor(input) {
  return /^#([A-Fa-f0-9]{6})$/.test(input || '');
}

function isLikelyImageUrl(input) {
  if (!input) return false;

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  const value = `${parsed.pathname}${parsed.search}`;

  return /(\.png|\.jpe?g|\.gif|\.webp|\.bmp|\.tiff|\.svg)(\?.*)?$/i.test(value)
    || /format=(png|jpe?g|gif|webp|bmp|tiff|svg)/i.test(parsed.search);
}

function normalizeEmoji(raw) {
  if (!raw) return null;
  if (raw.toLowerCase() === 'skip') return null;
  return raw.trim();
}

function parseEmoji(input) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;

  // Custom emoji: <:name:id> or <a:name:id>
  const custom = value.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (custom) {
    return {
      name: custom[1],
      id: custom[2],
      animated: value.startsWith('<a:')
    };
  }

  // Basic unicode emoji fallback
  if ([...value].length <= 2) {
    return { name: value };
  }

  console.log('Invalid emoji detected:', input);
  return null;
}

function parseRoleInput(raw) {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || text.toLowerCase() === 'none') return null;

  const mention = text.match(/^<@&(\d+)>$/);
  if (mention) return mention[1];

  if (/^\d{17,20}$/.test(text)) return text;
  return 'INVALID';
}

function sanitizeTicketName(username) {
  return `ticket-${username.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 70) || 'user'}`;
}

function buildPreviewEmbed(session, guildName) {
  const embed = new EmbedBuilder()
    .setTitle(session.embed.title || 'Ticket Support')
    .setDescription(session.embed.description || 'Select a category from the menu below to create a support ticket.')
    .setColor(session.embed.color || '#2B2D31')
    .setFooter({ text: 'Support • Ticket System' });

  if (session.embed.image) embed.setImage(session.embed.image);
  if (session.embed.thumbnail) embed.setThumbnail(session.embed.thumbnail);

  return embed;
}

function setupControlRows() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_setup_title').setLabel('Title').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_setup_description').setLabel('Description').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_setup_color').setLabel('Color').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_setup_image').setLabel('Image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_setup_thumbnail').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_setup_json').setLabel('JSON').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_setup_save').setLabel('Save & Set Category').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_setup_exit').setLabel('Exit').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

function categoryControlRows() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_category_add').setLabel('Add Select Menu Option').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_category_finish').setLabel('Finish').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_category_remove').setLabel('Remove Category').setStyle(ButtonStyle.Danger)
  );

  return [row];
}

function buildCategoryEmbed(session, guildName) {
  const embed = new EmbedBuilder()
    .setTitle('Ticket Category Builder')
    .setDescription('Add categories for your panel select menu, then click **Finish** to publish the panel.')
    .setColor('#57F287')
    .setFooter({ text: `${guildName} • Category Setup` });

  if (session.categories.length === 0) {
    embed.addFields({ name: 'Categories', value: 'No categories added yet.' });
  } else {
    embed.addFields({
      name: 'Categories',
      value: session.categories
        .map((cat, idx) => `${idx + 1}. ${cat.emoji ? `${cat.emoji} ` : ''}${cat.name}${cat.roleId ? ` • <@&${cat.roleId}>` : ''}`)
        .join('\n')
        .slice(0, 1024)
    });
  }

  return embed;
}

function buildSafeCategoryOption(cat, idx, mode = 'panel') {
  const option = {
    label: (cat.name || `Category ${idx + 1}`).slice(0, 100),
    value: String(idx)
  };

  if (mode === 'remove') {
    option.description = cat.roleId ? `Role: ${cat.roleId}` : 'No role';
  } else {
    option.description = `Open a ${cat.name || `Category ${idx + 1}`} ticket`.slice(0, 100);
  }

  const parsed = parseEmoji(cat.emoji);
  if (parsed) option.emoji = parsed;

  return option;
}

function buildSafeCategoryOptions(categories, mode = 'panel') {
  return (categories || [])
    .map((cat, idx) => {
      if (!cat || typeof cat.name !== 'string' || cat.name.trim().length === 0) return null;
      return buildSafeCategoryOption(cat, idx, mode);
    })
    .filter(Boolean);
}

function getSession(interaction) {
  const key = sessionKey(interaction.guildId, interaction.user.id);
  const session = setupSessions.get(key);

  if (!session) return { error: 'No active setup session. Run `/ticket setup` again.' };

  if (Date.now() > session.expiresAt) {
    setupSessions.delete(key);
    return { error: 'Setup session timed out after 10 minutes. Run `/ticket setup` again.' };
  }

  session.expiresAt = Date.now() + SESSION_TIMEOUT_MS;
  setupSessions.set(key, session);

  return { session, key };
}

function setupInputModal(customId, title, label, placeholder, required = true, style = TextInputStyle.Short) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId('value')
    .setLabel(label)
    .setPlaceholder(placeholder)
    .setRequired(required)
    .setStyle(style)
    .setMaxLength(style === TextInputStyle.Paragraph ? 4000 : 256);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

async function startSetup(interaction, targetChannel) {
  const channel = targetChannel || interaction.channel;
  const isValidTarget = channel
    && channel.guildId === interaction.guildId
    && channel.isTextBased?.()
    && typeof channel.send === 'function';

  if (!isValidTarget) {
    return interaction.reply({
      content: 'Invalid channel. Please select a server text channel.',
      flags: MessageFlags.Ephemeral
    });
  }

  const key = sessionKey(interaction.guildId, interaction.user.id);
  const session = {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    setupChannelId: interaction.channelId,
    targetChannelId: channel.id,
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    embed: {
      title: 'Ticket Support',
      description: 'Please select a category from the menu below to create a ticket.',
      color: '#5865F2',
      image: null,
      thumbnail: null
    },
    categories: []
  };

  setupSessions.set(key, session);

  return interaction.reply({
    flags: MessageFlags.Ephemeral,
    embeds: [buildPreviewEmbed(session, interaction.guild.name)],
    components: setupControlRows(),
    content: `Setup started. Final ticket panel will be sent to <#${channel.id}>.`
  });
}

async function handleSetupButton(interaction) {
  const result = getSession(interaction);
  if (result.error) {
    return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
  }

  const { session, key } = result;
  const id = interaction.customId;

  if (id === 'ticket_setup_exit') {
    setupSessions.delete(key);
    return interaction.update({
      content: 'Ticket setup closed.',
      embeds: [],
      components: []
    });
  }

  if (id === 'ticket_setup_save') {
    return interaction.update({
      embeds: [buildCategoryEmbed(session, interaction.guild.name)],
      components: categoryControlRows()
    });
  }

  if (id === 'ticket_setup_title') {
    return interaction.showModal(setupInputModal('ticket_modal_title', 'Set Embed Title', 'Title', 'Enter embed title'));
  }

  if (id === 'ticket_setup_description') {
    return interaction.showModal(
      setupInputModal('ticket_modal_description', 'Set Embed Description', 'Description', 'Enter embed description', true, TextInputStyle.Paragraph)
    );
  }

  if (id === 'ticket_setup_color') {
    return interaction.showModal(setupInputModal('ticket_modal_color', 'Set Embed Color', 'Hex Color', '#FFFFFF'));
  }

  if (id === 'ticket_setup_image') {
    return interaction.showModal(setupInputModal('ticket_modal_image', 'Set Embed Image', 'Image URL', 'https://example.com/banner.png'));
  }

  if (id === 'ticket_setup_thumbnail') {
    return interaction.showModal(setupInputModal('ticket_modal_thumbnail', 'Set Thumbnail', 'Thumbnail URL', 'https://example.com/icon.png'));
  }

  if (id === 'ticket_setup_json') {
    return interaction.showModal(
      setupInputModal('ticket_modal_json', 'Set Raw Embed JSON', 'JSON', '{"title":"Support"}', true, TextInputStyle.Paragraph)
    );
  }

  if (id === 'ticket_category_add') {
    const modal = new ModalBuilder().setCustomId('ticket_modal_category').setTitle('Add Ticket Category');

    const name = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('Category Name')
      .setPlaceholder('Billing')
      .setRequired(true)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(80);

    const emoji = new TextInputBuilder()
      .setCustomId('emoji')
      .setLabel('Emoji (or skip)')
      .setPlaceholder('💳 or skip')
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(32);

    const role = new TextInputBuilder()
      .setCustomId('role')
      .setLabel('Support Role mention/id (or none)')
      .setPlaceholder('<@&1234567890> or none')
      .setRequired(false)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(64);

    modal.addComponents(
      new ActionRowBuilder().addComponents(name),
      new ActionRowBuilder().addComponents(emoji),
      new ActionRowBuilder().addComponents(role)
    );

    return interaction.showModal(modal);
  }

  if (id === 'ticket_category_remove') {
    if (session.categories.length === 0) {
      return interaction.reply({ content: 'No categories to remove.', flags: MessageFlags.Ephemeral });
    }

    const options = buildSafeCategoryOptions(session.categories, 'remove');
    if (options.length === 0) {
      return interaction.reply({
        content: 'No valid categories available to remove.',
        flags: MessageFlags.Ephemeral
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_category_remove_select')
      .setPlaceholder('Choose a category to remove')
      .addOptions(options);

    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Select one category to remove.',
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  if (id === 'ticket_category_finish') {
    if (session.categories.length === 0) {
      return interaction.reply({
        content: 'Add at least one category before finishing.',
        flags: MessageFlags.Ephemeral
      });
    }

    const ticketSystem = await getTicketSystem(interaction.guildId);
    const panelId = `panel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    ticketSystem.panels[panelId] = {
      id: panelId,
      createdBy: interaction.user.id,
      createdAt: Date.now(),
      channelId: session.targetChannelId,
      messageId: null,
      embed: { ...session.embed },
      categories: session.categories
    };

    const channel = interaction.guild.channels.cache.get(session.targetChannelId);
    if (!channel || !channel.isTextBased?.() || typeof channel.send !== 'function') {
      return interaction.reply({
        content: 'Target channel is missing or no longer a text channel.',
        flags: MessageFlags.Ephemeral
      });
    }

    const me = interaction.guild.members.me;
    if (!me) {
      return interaction.reply({
        content: 'Unable to validate bot permissions in target channel.',
        flags: MessageFlags.Ephemeral
      });
    }

    const perms = channel.permissionsFor(me);
    const required = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.UseApplicationCommands
    ];

    if (!perms || !perms.has(required)) {
      return interaction.reply({
        content: 'I need `View Channel`, `Send Messages`, `Embed Links`, and `Use Application Commands` in that channel.',
        flags: MessageFlags.Ephemeral
      });
    }

    const options = buildSafeCategoryOptions(session.categories, 'panel');
    if (options.length === 0) {
      return interaction.reply({
        content: 'No valid categories available to publish.',
        flags: MessageFlags.Ephemeral
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`ticket_panel_select:${panelId}`)
        .setPlaceholder('Select a category')
        .addOptions(options)
    );

    const panelMessage = await channel.send({
      embeds: [buildPreviewEmbed(session, interaction.guild.name)],
      components: [row]
    });

    ticketSystem.panels[panelId].messageId = panelMessage.id;
    await saveTicketSystem(interaction.guildId, ticketSystem);

    setupSessions.delete(key);

    return interaction.update({
      content: `✅ Ticket panel successfully created in <#${channel.id}> (ID: \`${panelId}\`)`,
      embeds: [],
      components: []
    });
  }
}

async function handleSetupModal(interaction) {
  const result = getSession(interaction);
  if (result.error) {
    return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
  }

  const { session } = result;
  const id = interaction.customId;

  if (id === 'ticket_modal_title') {
    session.embed.title = interaction.fields.getTextInputValue('value').trim();
  }

  if (id === 'ticket_modal_description') {
    session.embed.description = interaction.fields.getTextInputValue('value').trim();
  }

  if (id === 'ticket_modal_color') {
    const input = interaction.fields.getTextInputValue('value').trim();
    if (!isHexColor(input)) {
      return interaction.reply({
        content: 'Color is invalid. Please enter a valid hex code like #FFFFFF.',
        flags: MessageFlags.Ephemeral
      });
    }
    session.embed.color = input;
  }

  if (id === 'ticket_modal_image') {
    const input = interaction.fields.getTextInputValue('value').trim();
    if (!isLikelyImageUrl(input)) {
      return interaction.reply({
        content: 'Image link is invalid. Please enter a valid link.',
        flags: MessageFlags.Ephemeral
      });
    }
    session.embed.image = input;
  }

  if (id === 'ticket_modal_thumbnail') {
    const input = interaction.fields.getTextInputValue('value').trim();
    if (!isLikelyImageUrl(input)) {
      return interaction.reply({
        content: 'Thumbnail link is invalid. Please enter a valid link.',
        flags: MessageFlags.Ephemeral
      });
    }
    session.embed.thumbnail = input;
  }

  if (id === 'ticket_modal_json') {
    const raw = interaction.fields.getTextInputValue('value').trim();
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return interaction.reply({
        content: 'JSON is invalid. Please provide valid embed JSON.',
        flags: MessageFlags.Ephemeral
      });
    }

    const embedPayload = Array.isArray(parsed) ? parsed[0] : parsed;

    try {
      const built = EmbedBuilder.from(embedPayload).toJSON();
      session.embed = {
        title: built.title || null,
        description: built.description || null,
        color: built.color ? `#${built.color.toString(16).padStart(6, '0')}` : session.embed.color,
        image: built.image?.url || null,
        thumbnail: built.thumbnail?.url || null
      };
    } catch {
      return interaction.reply({
        content: 'JSON is invalid for an embed object.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  if (id === 'ticket_modal_category') {
    const name = interaction.fields.getTextInputValue('name').trim();
    const emojiRaw = interaction.fields.getTextInputValue('emoji')?.trim();
    const roleRaw = interaction.fields.getTextInputValue('role')?.trim();

    if (!name) {
      return interaction.reply({ content: 'Category name cannot be empty.', flags: MessageFlags.Ephemeral });
    }

    const roleId = parseRoleInput(roleRaw);
    if (roleId === 'INVALID') {
      return interaction.reply({
        content: 'Support role is invalid. Use a role mention, role ID, or "none".',
        flags: MessageFlags.Ephemeral
      });
    }

    if (roleId && !interaction.guild.roles.cache.has(roleId)) {
      return interaction.reply({
        content: 'Support role was not found in this server.',
        flags: MessageFlags.Ephemeral
      });
    }

    session.categories.push({
      name: name.slice(0, 80),
      emoji: normalizeEmoji(emojiRaw),
      roleId: roleId || null
    });

    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [buildCategoryEmbed(session, interaction.guild.name)],
      components: categoryControlRows()
    });
  }

  return interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: 'Embed updated.',
    embeds: [buildPreviewEmbed(session, interaction.guild.name)],
    components: setupControlRows()
  });
}

async function ensureTicketContext(interaction) {
  const ticketSystem = await getTicketSystem(interaction.guildId);
  const ticket = ticketSystem.tickets[interaction.channelId];

  if (!ticket || ticket.status !== 'open') {
    return { error: 'This command can only be used inside an open ticket channel.' };
  }

  return { ticketSystem, ticket };
}

async function addUserToTicket(interaction, userId, fromComponent = false) {
  const context = await ensureTicketContext(interaction);
  if (context.error) {
    return interaction.reply({ content: context.error, flags: MessageFlags.Ephemeral });
  }

  try {
    await interaction.channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true
    });

    context.ticket.lastActivity = Date.now();
    context.ticketSystem.tickets[interaction.channelId] = context.ticket;
    await saveTicketSystem(interaction.guildId, context.ticketSystem);

    const payload = {
      content: `✅ <@${userId}> has been added to this ticket.`,
      flags: MessageFlags.Ephemeral
    };

    if (fromComponent) return interaction.update({ components: [], content: payload.content });
    return interaction.reply(payload);
  } catch {
    return interaction.reply({
      content: 'Missing permissions to edit channel overrides.',
      flags: MessageFlags.Ephemeral
    });
  }
}

async function removeUserFromTicket(interaction, userId, fromComponent = false) {
  const context = await ensureTicketContext(interaction);
  if (context.error) {
    return interaction.reply({ content: context.error, flags: MessageFlags.Ephemeral });
  }

  if (userId === context.ticket.userId) {
    return interaction.reply({
      content: 'You cannot remove the ticket owner.',
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    await interaction.channel.permissionOverwrites.delete(userId);

    context.ticket.lastActivity = Date.now();
    context.ticketSystem.tickets[interaction.channelId] = context.ticket;
    await saveTicketSystem(interaction.guildId, context.ticketSystem);

    const payload = {
      content: `✅ <@${userId}> has been removed from this ticket.`,
      flags: MessageFlags.Ephemeral
    };

    if (fromComponent) return interaction.update({ components: [], content: payload.content });
    return interaction.reply(payload);
  } catch {
    return interaction.reply({
      content: 'Missing permissions to remove that user.',
      flags: MessageFlags.Ephemeral
    });
  }
}

function closeReasonKey(channelId, userId) {
  return `${channelId}:${userId}`;
}

async function requestClose(interaction, reason = 'No reason') {
  const context = await ensureTicketContext(interaction);
  if (context.error) {
    return interaction.reply({ content: context.error, flags: MessageFlags.Ephemeral });
  }

  closeReasonStore.set(closeReasonKey(interaction.channelId, interaction.user.id), reason || 'No reason');

  const embed = new EmbedBuilder()
    .setTitle('🔒 Close Ticket')
    .setDescription('Are you sure you want to close this ticket?')
    .addFields({ name: 'Reason', value: reason || 'No reason' })
    .setColor('#ED4245');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    flags: MessageFlags.Ephemeral,
    embeds: [embed],
    components: [row]
  });
}

async function finalizeTicketClose({ guild, channel, ticketSystem, ticket, closedByUser, reason }) {
  const closedAt = Date.now();
  const safeReason = reason || 'No reason';
  const actor = closedByUser || guild.client.user || { id: guild.id, tag: 'System' };

  let transcriptInfo = null;
  let transcriptTooLarge = false;
  let transcriptAttachment = null;
  let ownerUser = null;

  try {
    transcriptInfo = await buildTranscriptAttachment(channel);
    transcriptTooLarge = transcriptInfo.size > MAX_DISCORD_FILE_SIZE;
    transcriptAttachment = transcriptTooLarge ? null : transcriptInfo.attachment;
  } catch (err) {
    console.error('[Ticket] Transcript generation failed:', err);
  }

  try {
    ownerUser = await guild.client.users.fetch(ticket.userId);
  } catch {
    ownerUser = null;
  }

  await sendTicketCloseLog({
    guild,
    logChannelId: ticketSystem.settings.logChannelId,
    channel,
    closedBy: actor,
    ownerUser,
    ownerId: ticket.userId,
    reason: safeReason,
    closedAt,
    transcriptAttachment,
    transcriptTooLarge
  }).catch(() => null);

  await notifyTicketClosed({
    client: guild.client,
    ownerId: ticket.userId,
    transcriptAttachment
  }).catch(() => null);

  if (transcriptTooLarge && ownerUser) {
    await ownerUser.send('Transcript was generated but is too large to attach in DM.').catch(() => null);
  }

  ticket.status = 'closed';
  ticket.closedAt = closedAt;
  ticket.closeReason = safeReason;
  ticket.closedBy = actor.id;

  ticketSystem.history[channel.id] = {
    ticketId: channel.id,
    ownerId: ticket.userId,
    claimedBy: ticket.claimedBy || null,
    createdAt: ticket.createdAt,
    closedAt,
    reason: safeReason,
    closedBy: actor.id,
    panelId: ticket.panelId || null
  };

  delete ticketSystem.tickets[channel.id];
  await saveTicketSystem(guild.id, ticketSystem);

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription(`Reason: ${safeReason}\nThis channel will be deleted in 5 seconds.`)
        .setColor('#ED4245')
    ]
  }).catch(() => null);

  setTimeout(() => {
    channel.delete('Ticket closed').catch(() => null);
  }, 5000);
}

async function closeNow(interaction, reason = 'No reason') {
  const context = await ensureTicketContext(interaction);
  if (context.error) {
    return interaction.reply({ content: context.error, flags: MessageFlags.Ephemeral });
  }

  const { ticketSystem, ticket } = context;

  if (interaction.isButton()) {
    await interaction.deferUpdate().catch(() => null);
  } else {
    await interaction.reply({
      content: '🔒 Closing ticket...',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
  }

  return finalizeTicketClose({
    guild: interaction.guild,
    channel: interaction.channel,
    ticketSystem,
    ticket,
    closedByUser: interaction.user,
    reason
  });
}

async function claimTicket(interaction) {
  const context = await ensureTicketContext(interaction);
  if (context.error) {
    return interaction.reply({ content: context.error, flags: MessageFlags.Ephemeral });
  }

  const { ticketSystem, ticket } = context;
  if (!canClaim(interaction.member, ticket, ticketSystem)) {
    return interaction.reply({
      content: 'Only staff members can claim this ticket.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
    return interaction.reply({
      content: `This ticket is already claimed by <@${ticket.claimedBy}>.`,
      flags: MessageFlags.Ephemeral
    });
  }

  ticket.claimedBy = interaction.user.id;
  ticket.claimedAt = Date.now();
  ticket.lastActivity = Date.now();
  ticketSystem.tickets[interaction.channelId] = ticket;
  await saveTicketSystem(interaction.guildId, ticketSystem);

  const oldTopic = interaction.channel.topic || '';
  const topicBase = oldTopic.split('| Claimed by ')[0].trim();
  await interaction.channel.setTopic(`${topicBase} | Claimed by ${interaction.user.tag}`.slice(0, 1024)).catch(() => null);

  await interaction.channel.send({
    content: `👨‍💼 This ticket has been claimed by <@${interaction.user.id}>`
  }).catch(() => null);

  await notifyTicketClaimed({
    client: interaction.client,
    ownerId: ticket.userId,
    claimerId: interaction.user.id
  }).catch(() => null);

  if (interaction.isButton()) {
    return interaction.reply({
      content: 'Ticket claimed successfully.',
      flags: MessageFlags.Ephemeral
    });
  }

  return interaction.reply({
    content: `✅ You claimed this ticket.`,
    flags: MessageFlags.Ephemeral
  });
}

async function renameTicket(interaction, requestedName) {
  const context = await ensureTicketContext(interaction);
  if (context.error) {
    return interaction.reply({ content: context.error, flags: MessageFlags.Ephemeral });
  }

  const clean = requestedName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);

  if (!clean) {
    return interaction.reply({ content: 'Invalid channel name.', flags: MessageFlags.Ephemeral });
  }

  await interaction.channel.setName(clean).catch(() => null);
  return interaction.reply({ content: `✅ Ticket renamed to **${clean}**`, flags: MessageFlags.Ephemeral });
}

async function handlePanelSelect(interaction) {
  const [, panelId] = interaction.customId.split(':');
  const ticketSystem = await getTicketSystem(interaction.guildId);
  const panel = ticketSystem.panels[panelId];

  if (!panel) {
    return interaction.reply({ content: 'This ticket panel no longer exists.', flags: MessageFlags.Ephemeral });
  }

  const categoryIndex = Number(interaction.values[0]);
  const selected = panel.categories?.[categoryIndex];

  if (!selected) {
    return interaction.reply({ content: 'Selected category is invalid.', flags: MessageFlags.Ephemeral });
  }

  if (ticketSystem.settings.allowOneTicketPerUser) {
    const duplicate = Object.entries(ticketSystem.tickets)
      .find(([, value]) => value.userId === interaction.user.id && value.status === 'open');

    if (duplicate) {
      const existingChannel = interaction.guild.channels.cache.get(duplicate[0]);
      if (existingChannel) {
        return interaction.reply({
          content: `You already have an open ticket: ${existingChannel}`,
          flags: MessageFlags.Ephemeral
        });
      }
      delete ticketSystem.tickets[duplicate[0]];
      await saveTicketSystem(interaction.guildId, ticketSystem);
    }
  }

  const perms = [
    {
      id: interaction.guild.id,
      deny: [PermissionsBitField.Flags.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles
      ]
    }
  ];

  if (selected.roleId && interaction.guild.roles.cache.has(selected.roleId)) {
    perms.push({
      id: selected.roleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles
      ]
    });
  }

  const createOptions = {
    name: sanitizeTicketName(interaction.user.username),
    type: ChannelType.GuildText,
    topic: `ticket:${interaction.user.id}:${panelId}:${categoryIndex}`,
    permissionOverwrites: perms
  };

  if (ticketSystem.settings.ticketsCategoryId && interaction.guild.channels.cache.has(ticketSystem.settings.ticketsCategoryId)) {
    createOptions.parent = ticketSystem.settings.ticketsCategoryId;
  }

  const channel = await interaction.guild.channels.create(createOptions).catch(() => null);
  if (!channel) {
    return interaction.reply({
      content: 'I could not create the ticket channel. Check my channel + permission settings.',
      flags: MessageFlags.Ephemeral
    });
  }

  const ticketEmbed = new EmbedBuilder()
    .setTitle('🎟️ Ticket Created')
    .setDescription(`Category: **${selected.name}**\nSupport will be with you shortly.`)
    .setColor('#5865F2')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setEmoji('👨‍💼').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_add_user').setLabel('Add User').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_remove_user').setLabel('Remove User').setStyle(ButtonStyle.Secondary)
  );

  const notifyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('notify_toggle').setLabel('Notify Me').setEmoji('🔔').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('notify_user').setLabel('Notify User').setEmoji('📢').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({
    content: `<@${interaction.user.id}>${selected.roleId ? ` <@&${selected.roleId}>` : ''}`,
    embeds: [ticketEmbed],
    components: [row, notifyRow]
  });

  ticketSystem.tickets[channel.id] = {
    ticketId: channel.id,
    channelId: channel.id,
    panelId,
    categoryName: selected.name,
    categoryIndex,
    roleId: selected.roleId || null,
    userId: interaction.user.id,
    notify: false,
    claimedBy: null,
    claimedAt: null,
    closedAt: null,
    status: 'open',
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  await saveTicketSystem(interaction.guildId, ticketSystem);

  return interaction.reply({
    content: `✅ Ticket created: ${channel}`,
    flags: MessageFlags.Ephemeral
  });
}

async function handleTicketButton(interaction) {
  if (interaction.customId.startsWith('ticket_setup_') || interaction.customId.startsWith('ticket_category_')) {
    return handleSetupButton(interaction);
  }

  if (interaction.customId === 'ticket_add_user') {
    const menu = new UserSelectMenuBuilder()
      .setCustomId('ticket_add_user_select')
      .setPlaceholder('Select a user to add')
      .setMinValues(1)
      .setMaxValues(1);

    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      components: [new ActionRowBuilder().addComponents(menu)],
      content: 'Choose a user to add to this ticket.'
    });
  }

  if (interaction.customId === 'ticket_remove_user') {
    const menu = new UserSelectMenuBuilder()
      .setCustomId('ticket_remove_user_select')
      .setPlaceholder('Select a user to remove')
      .setMinValues(1)
      .setMaxValues(1);

    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      components: [new ActionRowBuilder().addComponents(menu)],
      content: 'Choose a user to remove from this ticket.'
    });
  }

  if (interaction.customId === 'notify_toggle') {
    const context = await ensureTicketContext(interaction);
    if (context.error) {
      return interaction.reply({ content: context.error, flags: MessageFlags.Ephemeral });
    }

    const { ticketSystem, ticket } = context;
    if (interaction.user.id !== ticket.userId) {
      return interaction.reply({
        content: 'Only the ticket owner can use this button.',
        flags: MessageFlags.Ephemeral
      });
    }

    ticket.notify = !Boolean(ticket.notify);
    ticket.lastActivity = Date.now();
    ticketSystem.tickets[interaction.channelId] = ticket;
    await saveTicketSystem(interaction.guildId, ticketSystem);

    return interaction.reply({
      content: ticket.notify
        ? '🔔 Notifications enabled! You will receive DMs when staff replies.'
        : '🔕 Notifications disabled.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.customId === 'notify_user') {
    const context = await ensureTicketContext(interaction);
    if (context.error) {
      return interaction.reply({ content: context.error, flags: MessageFlags.Ephemeral });
    }

    const { ticketSystem, ticket } = context;
    if (!isStaffMember(interaction.member, ticket, ticketSystem)) {
      return interaction.reply({
        content: 'Only staff can use this button.',
        flags: MessageFlags.Ephemeral
      });
    }

    const sent = await notifyUserCalled({
      client: interaction.client,
      ownerId: ticket.userId,
      staffId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId
    });

    if (!sent) {
      return interaction.reply({
        content: '❌ Cannot DM user.',
        flags: MessageFlags.Ephemeral
      });
    }

    return interaction.reply({
      content: '✅ User has been notified.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.customId === 'ticket_close') {
    return requestClose(interaction, 'No reason');
  }

  if (interaction.customId === 'ticket_claim') {
    return claimTicket(interaction);
  }

  if (interaction.customId === 'ticket_close_confirm') {
    const key = closeReasonKey(interaction.channelId, interaction.user.id);
    const reason = closeReasonStore.get(key) || 'No reason';
    closeReasonStore.delete(key);
    return closeNow(interaction, reason);
  }

  if (interaction.customId === 'ticket_close_cancel') {
    closeReasonStore.delete(closeReasonKey(interaction.channelId, interaction.user.id));
    return interaction.update({ content: 'Ticket close cancelled.', components: [], embeds: [] });
  }
}

async function handleTicketSelect(interaction) {
  if (interaction.customId.startsWith('ticket_panel_select:')) {
    return handlePanelSelect(interaction);
  }

  if (interaction.customId === 'ticket_category_remove_select') {
    const result = getSession(interaction);
    if (result.error) {
      return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
    }

    const index = Number(interaction.values[0]);
    if (Number.isNaN(index) || index < 0 || index >= result.session.categories.length) {
      return interaction.reply({
        content: 'Invalid category selection.',
        flags: MessageFlags.Ephemeral
      });
    }

    const removed = result.session.categories.splice(index, 1)[0];

    return interaction.update({
      content: `Removed category: **${removed.name}**`,
      embeds: [buildCategoryEmbed(result.session, interaction.guild.name)],
      components: categoryControlRows()
    });
  }

  if (interaction.customId === 'ticket_add_user_select') {
    return addUserToTicket(interaction, interaction.values[0], true);
  }

  if (interaction.customId === 'ticket_remove_user_select') {
    return removeUserFromTicket(interaction, interaction.values[0], true);
  }
}

async function handleModal(interaction) {
  if (!interaction.customId.startsWith('ticket_modal_')) return;
  return handleSetupModal(interaction);
}

async function handleInteraction(interaction) {
  if (interaction.isButton()) return handleTicketButton(interaction);
  if (interaction.isAnySelectMenu()) return handleTicketSelect(interaction);
  if (interaction.isModalSubmit()) return handleModal(interaction);
}

async function handleTicketMessage(message) {
  if (!message.guild || message.author.bot) return;

  const ticketSystem = await getTicketSystem(message.guild.id);
  const ticket = ticketSystem.tickets[message.channel.id];
  if (!ticket || ticket.status !== 'open') return;

  ticket.lastActivity = Date.now();
  ticketSystem.tickets[message.channel.id] = ticket;
  await saveTicketSystem(message.guild.id, ticketSystem);

  if (message.author.id === ticket.userId) return;
  if (!isStaffMember(message.member, ticket, ticketSystem)) return;
  if (!ticket.notify) return;

  await notifyTicketOwnerOnStaffReply({
    message,
    ownerId: ticket.userId,
    staffDisplayName: message.member?.displayName || message.author.username
  }).catch(() => null);
}

async function markTicketActivity(guildId, channelId) {
  const ticketSystem = await getTicketSystem(guildId);
  if (!ticketSystem.tickets[channelId]) return;

  ticketSystem.tickets[channelId].lastActivity = Date.now();
  await saveTicketSystem(guildId, ticketSystem);
}

async function cleanupDeletedTicket(guildId, channelId) {
  const ticketSystem = await getTicketSystem(guildId);
  if (!ticketSystem.tickets[channelId]) return;
  delete ticketSystem.tickets[channelId];
  await saveTicketSystem(guildId, ticketSystem);
}

async function autoCloseTicketChannel(guild, channel, ticketData, reason) {
  const ticketSystem = await getTicketSystem(guild.id);
  if (!ticketSystem.tickets[channel.id]) return;

  return finalizeTicketClose({
    guild,
    channel,
    ticketSystem,
    ticket: ticketData,
    closedByUser: guild.client.user,
    reason
  });
}

function startInactivityWatcher(client) {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      const ticketSystem = await getTicketSystem(guild.id).catch(() => null);
      if (!ticketSystem) continue;

      const closeMinutes = Number(ticketSystem.settings.autoCloseMinutes) || DEFAULT_INACTIVE_CLOSE_MINUTES;
      const threshold = closeMinutes * 60 * 1000;

      for (const [channelId, ticket] of Object.entries(ticketSystem.tickets)) {
        const channel = guild.channels.cache.get(channelId);

        if (!channel) {
          delete ticketSystem.tickets[channelId];
          continue;
        }

        const lastActivity = ticket.lastActivity || ticket.createdAt || Date.now();
        if (Date.now() - lastActivity >= threshold) {
          await autoCloseTicketChannel(
            guild,
            channel,
            ticket,
            `No activity for ${closeMinutes} minute(s).`
          );
        }
      }

      await saveTicketSystem(guild.id, ticketSystem).catch(() => null);
    }
  }, 5 * 60 * 1000);
}

module.exports = {
  startSetup,
  handleInteraction,
  addUserToTicket,
  removeUserFromTicket,
  requestClose,
  claimTicket,
  renameTicket,
  handleTicketMessage,
  markTicketActivity,
  cleanupDeletedTicket,
  startInactivityWatcher,
  getTicketSystem,
  saveTicketSystem
};

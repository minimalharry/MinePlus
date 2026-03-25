const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const store = require('./rules_store');
const ensureArray = require('../../utils/ensureArray');

let temp = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules-panel')
        .setDescription('Rules panel system')

        .addSubcommand(s =>
            s.setName('create')
                .setDescription('Create panel')
                .addStringOption(o =>
                    o.setName('id')
                        .setDescription('Panel ID')
                        .setRequired(true)
                )
        )

        .addSubcommand(s =>
            s.setName('edit')
                .setDescription('Edit panel')
                .addStringOption(o =>
                    o.setName('id')
                        .setDescription('Panel ID')
                        .setRequired(true)
                )
        )

        .addSubcommand(s =>
            s.setName('delete')
                .setDescription('Delete panel')
                .addStringOption(o =>
                    o.setName('id')
                        .setDescription('Panel ID')
                        .setRequired(true)
                )
        )

        .addSubcommand(s =>
            s.setName('list')
                .setDescription('List panels')
        ),

    async execute(interaction) {

        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
            const all = await store.getAll();

            if (!all.length)
                return interaction.reply({ content: '❌ No panels', flags: 64 });

            return interaction.reply({
                content: all.map(x => `• ${x.id}`).join('\n'),
                flags: 64
            });
        }

        const id = interaction.options.getString('id');

        if (sub === 'delete') {
            await store.delete(id);
            return interaction.reply({ content: `🗑️ Deleted ${id}`, flags: 64 });
        }

        let data = await store.get(id);

        if (!data) {
            data = {
                id,
                title: null,
                description: null,
                color: '#00ff88',
                image: null,
                thumbnail: null,
                buttons: []
            };
        }

        temp[interaction.user.id] = data;

        const embed = buildEmbed(data);

        const row1 = new ActionRowBuilder().addComponents(
            btn('rp_title', 'Title'),
            btn('rp_desc', 'Description'),
            btn('rp_color', 'Color'),
            btn('rp_images', 'Images'),
            btn('rp_addbtn', 'Add Button', ButtonStyle.Success)
        );

        const row2 = new ActionRowBuilder().addComponents(
            btn('rp_finish', 'Finish', ButtonStyle.Danger)
        );

        return interaction.reply({
            embeds: [embed],
            components: [row1, row2]
        });
    }
};

// ================= HANDLER =================
module.exports.handleInteraction = async (interaction) => {

    const data = temp[interaction.user.id];
    if (!data) return;

    if (interaction.isButton()) {

        if (interaction.replied || interaction.deferred) return;

        if (interaction.customId === 'rp_finish') {

            await store.set(data);

            const embed = buildEmbed(data);

            const row = new ActionRowBuilder();

            if (data.buttons.length > 0) {
                data.buttons.forEach((b, i) => {

                    const button = new ButtonBuilder()
                        .setCustomId(`rule_${data.id}_${i}`)
                        .setStyle(ButtonStyle.Secondary);

                    if (b.label) button.setLabel(b.label);
                    if (b.emoji) button.setEmoji(b.emoji);

                    row.addComponents(button);
                });
            }

            delete temp[interaction.user.id];

            await interaction.reply({ content: '✅ Saved', flags: 64 });

            return interaction.channel.send({
                embeds: [embed],
                components: data.buttons.length ? [row] : []
            });
        }

        return interaction.showModal(getModal(interaction.customId));
    }

    if (interaction.isModalSubmit()) {

        const f = interaction.fields;

        if (interaction.customId === 'modal_title')
            data.title = f.getTextInputValue('title') || null;

        if (interaction.customId === 'modal_desc')
            data.description = f.getTextInputValue('desc') || null;

        if (interaction.customId === 'modal_color')
            data.color = f.getTextInputValue('color') || '#00ff88';

        if (interaction.customId === 'modal_images') {
            data.image = f.getTextInputValue('image') || null;
            data.thumbnail = f.getTextInputValue('thumb') || null;
        }

        if (interaction.customId === 'modal_addbtn') {
            data.buttons = ensureArray(data.buttons, 'rules_panel:data.buttons');
            data.buttons.push({
                label: f.getTextInputValue('label') || null,
                emoji: f.getTextInputValue('emoji') || null,
                content: f.getTextInputValue('content') || 'No content'
            });
        }

        return interaction.update({
            embeds: [buildEmbed(data)]
        });
    }
};

// ================= HELPERS =================

function btn(id, label, style = ButtonStyle.Secondary) {
    return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
}

function buildEmbed(data) {

    const embed = new EmbedBuilder()
        .setColor(data.color || '#CBFF00');

    if (data.title) embed.setTitle(data.title);
    if (data.description) embed.setDescription(data.description);

    if (data.image) embed.setImage(data.image);
    if (data.thumbnail) embed.setThumbnail(data.thumbnail);

    if (!data.title && !data.description && !data.image && !data.thumbnail) {
        embed.setDescription('‎');
    }

    return embed;
}

function getModal(type) {

    const make = (id, label, paragraph = false, required = false) =>
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setRequired(required)
                .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
        );

    if (type === 'rp_title')
        return new ModalBuilder().setCustomId('modal_title').setTitle('Title')
            .addComponents(make('title', 'Title (optional)'));

    if (type === 'rp_desc')
        return new ModalBuilder().setCustomId('modal_desc').setTitle('Description')
            .addComponents(make('desc', 'Description (optional)', true));

    if (type === 'rp_color')
        return new ModalBuilder().setCustomId('modal_color').setTitle('Color')
            .addComponents(make('color', 'Hex Color'));

    if (type === 'rp_images')
        return new ModalBuilder().setCustomId('modal_images').setTitle('Images')
            .addComponents(
                make('image', 'Image URL (optional)'),
                make('thumb', 'Thumbnail URL (optional)')
            );

    if (type === 'rp_addbtn')
        return new ModalBuilder().setCustomId('modal_addbtn').setTitle('Add Button')
            .addComponents(
                make('label', 'Label (optional)'),
                make('emoji', 'Emoji ID (optional)'),
                make('content', 'Content', true)
            );
}

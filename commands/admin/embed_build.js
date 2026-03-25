const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} = require('discord.js');

const embedStore = require('./embed_store');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed-create')
        .setDescription('Create an embed')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Embed name')
                .setRequired(true)
        ),

    async execute(interaction) {
        const name = interaction.options.getString('name');

        await embedStore.set(name, {
            title: 'MinePlus Network',
            description: 'Edit your embed using buttons below.',
            color: '#00ff88',
            author: {},
            footer: {},
            image: '',
            thumbnail: ''
        });

        const embed = buildEmbed(await embedStore.get(name));

        const buttons = getButtons(name);

        await interaction.reply({
            embeds: [embed],
            components: [buttons]
        });
    }
};

// ================= HELPER ================= //

function getButtons(name) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`basic_${name}`).setLabel('edit basic information').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`author_${name}`).setLabel('edit author').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`footer_${name}`).setLabel('edit footer').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`images_${name}`).setLabel('edit images').setStyle(ButtonStyle.Secondary)
    );
}

function buildEmbed(data) {
    const embed = new EmbedBuilder()
        .setColor(data.color || '#00ff88')
        .setTitle(data.title || null)
        .setDescription(data.description || null);

    if (data.author?.name) embed.setAuthor(data.author);
    if (data.footer?.text) embed.setFooter(data.footer);
    if (data.image) embed.setImage(data.image);
    if (data.thumbnail) embed.setThumbnail(data.thumbnail);

    return embed;
}

// ================= HANDLER ================= //

module.exports.handleInteraction = async (interaction) => {

    try {

        // ===== BUTTON =====
        if (interaction.isButton()) {

            const [type, name] = interaction.customId.split('_');

            if (!(await embedStore.has(name))) {
                return interaction.reply({ content: '❌ embed not found', flags: 64 });
            }

            let modal;

            if (type === 'basic') {
                modal = new ModalBuilder()
                    .setCustomId(`modal_basic_${name}`)
                    .setTitle('Edit Basic Info')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('color').setLabel('Color').setStyle(TextInputStyle.Short).setRequired(false)
                        )
                    );
            }

            if (type === 'author') {
                modal = new ModalBuilder()
                    .setCustomId(`modal_author_${name}`)
                    .setTitle('Edit Author')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('author_text').setLabel('Author').setStyle(TextInputStyle.Short).setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('author_img').setLabel('Author Image').setStyle(TextInputStyle.Short).setRequired(false)
                        )
                    );
            }

            if (type === 'footer') {
                modal = new ModalBuilder()
                    .setCustomId(`modal_footer_${name}`)
                    .setTitle('Edit Footer')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('footer_text').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('footer_img').setLabel('Footer Image').setStyle(TextInputStyle.Short).setRequired(false)
                        )
                    );
            }

            if (type === 'images') {
                modal = new ModalBuilder()
                    .setCustomId(`modal_images_${name}`)
                    .setTitle('Edit Images')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('main_img').setLabel('Image URL').setStyle(TextInputStyle.Short).setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('thumb').setLabel('Thumbnail URL').setStyle(TextInputStyle.Short).setRequired(false)
                        )
                    );
            }

            return interaction.showModal(modal);
        }

        // ===== MODAL =====
        if (interaction.isModalSubmit()) {

            const parts = interaction.customId.split('_');
            const type = parts[1];
            const name = parts.slice(2).join('_');

            const data = await embedStore.get(name);
            if (!data) return;

            if (type === 'basic') {
                data.title = interaction.fields.getTextInputValue('title');
                data.description = interaction.fields.getTextInputValue('description');
                data.color = interaction.fields.getTextInputValue('color') || data.color;
            }

            if (type === 'author') {
                data.author = {
                    name: interaction.fields.getTextInputValue('author_text') || '',
                    iconURL: interaction.fields.getTextInputValue('author_img') || ''
                };
            }

            if (type === 'footer') {
                data.footer = {
                    text: interaction.fields.getTextInputValue('footer_text') || '',
                    iconURL: interaction.fields.getTextInputValue('footer_img') || ''
                };
            }

            if (type === 'images') {
                data.image = interaction.fields.getTextInputValue('main_img') || '';
                data.thumbnail = interaction.fields.getTextInputValue('thumb') || '';
            }

            await embedStore.set(name, data);

            // 🔥 THIS IS THE MAGIC (MIMU STYLE)
            return interaction.update({
                embeds: [buildEmbed(data)],
                components: [getButtons(name)]
            });
        }

    } catch (err) {
        console.error(err);
    }
};
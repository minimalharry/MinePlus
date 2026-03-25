const { EmbedBuilder, ChannelType } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const config = require('../../resources/config.json');
const { getTranslation } = require('../../languages/controller');
const lang = getTranslation();

module.exports = 
{
    // -------------------
    //    SLASH BUILDER
    // -------------------

    data: new SlashCommandBuilder()
        .setName(lang.serverInfo.slash.name)
        .setDescription(lang.serverInfo.slash.description),

    // -------------------
    //   COMMAND BUILDER
    // -------------------

    async execute(interaction) 
    {
        const guild = interaction.guild;
        const owner = guild.ownerId;
        const memberCount = guild.memberCount;
        const mention = interaction.user.toString();
        
        const roleCount = guild.roles.cache.size;
        const botCount = guild.members.cache.filter(member => member.user.bot).size;

        const textChannelCount = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannelCount = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const categoryChannelCount = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;        
        
        // -------------------
        //    COMMAND CHECK
        // -------------------

        if(!config.commands.server_info) 
        {
            const unavailableCommand = new EmbedBuilder()
                .setTitle(lang.universal.embeds.unavailable.title)
                .setDescription(lang.universal.embeds.unavailable.description)
                .setColor("Red")
                .setTimestamp();
            
            return interaction.reply({
                content: mention,
                embeds: [unavailableCommand],
                flags: 64
            });
        }
        
        // -------------------
        //    EMBED BUILDER
        // -------------------

        const mainEmbed = new EmbedBuilder()
            .setTitle(lang.serverInfo.embed.title)
            .setColor("Blue")
            .setTimestamp()

            .setDescription(lang.serverInfo.embed.description
                .replace('{owner_id}', owner)
                .replace('{member_count}', memberCount)
                .replace('{role_count}', roleCount)
                .replace('{bot_count}', botCount)
                .replace('{channel_text_count}', textChannelCount)
                .replace('{channel_voice_count}', voiceChannelCount)
                .replace('{channel_category_count}', categoryChannelCount)
            )

            .setImage("https://media.discordapp.net/attachments/1476563577010655379/1480029959765495898/Gemini_Generated_Image_ao6rqrao6rqrao6r.png?ex=69c1f750&is=69c0a5d0&hm=31400c2a0003a6dbbb5d33f9bd4d514d5c640e95d097a980e353ab516ce92407&=&format=webp&quality=lossless&width=1094&height=614");

        // -------------------
        //     SEND EMBED
        // -------------------

        try
        {
            return interaction.reply({
                content: mention,
                embeds: [mainEmbed],});
        }

        catch(error)
        {
            // -------------------
            //   ERROR FEEDBACK
            // -------------------
        
            console.log(error);
            console.log("[MinePlus] => [C] Critical => An unknown error occurred in the Server Info command!");
            console.log("[MinePlus] => [L] Log => Send the log to: https://github.com/minimalharry");
        
            // -------------------
            //     ERROR EMBED
            // -------------------            
        
            const errorEmbed = new EmbedBuilder()
                .setTitle(lang.universal.embeds.broken.title)
                .setDescription(lang.universal.embeds.broken.description)
                .setColor("DarkRed")
                .setTimestamp();

            // -------------------
            //     ERROR SEND
            // -------------------                
                
            return interaction.reply({
                content: mention,
                embeds: [errorEmbed],
                flags: 64
            });
        }
    }
};
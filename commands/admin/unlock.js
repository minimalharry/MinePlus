const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
        .setName(lang.unlock.slash.name)
        .setDescription(lang.unlock.slash.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // -------------------
    //   COMMAND EXECUTE
    // -------------------

    async execute(interaction)
    {
        const author = interaction.user.username;
        const mention = interaction.user.toString();
        const channel = interaction.channel;

        const everyoneRole = interaction.guild.roles.everyone;
        const existingPermissions = channel.permissionOverwrites.resolve(everyoneRole.id);
        
        // -------------------
        //    COMMAND CHECK
        // -------------------

        if(!config.commands.unlock) 
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
        //    UNLOCK CHECK
        // -------------------

        if(existingPermissions && existingPermissions.allow.has(PermissionFlagsBits.SendMessages))
        {
            const alreadyUnlockedEmbed = new EmbedBuilder()
                .setTitle(lang.unlock.embed.alreadyunlocked.title)
                .setDescription(lang.unlock.embed.alreadyunlocked.description)
                .setColor("Red")
                .setTimestamp();

            return interaction.reply({
                content: mention,
                embeds: [alreadyUnlockedEmbed],
                flags: 64
            });
        }

        // -------------------
        //    SUCESS UNLOCK
        // -------------------

        try 
        {
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: true });
            
            // -------------------
            //    UNLOCK EMBED
            // -------------------

            const successEmbed = new EmbedBuilder()
                .setTitle(lang.unlock.embed.unlocked.title)
                .setDescription(lang.unlock.embed.unlocked.description.replace('{author}', author))
                .setColor("Green")
                .setTimestamp();
    
            // -------------------
            //    UNLOCK SEND
            // -------------------
    
            return interaction.reply({
                content: mention,
                embeds: [successEmbed],});
        }

        catch(error)
        {
            // -------------------
            //   ERROR FEEDBACK
            // -------------------
        
            console.log(error);
            console.log("[MinePlus] => [C] Critical => An unknown error occurred in the Unlock command!");
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
    },
};
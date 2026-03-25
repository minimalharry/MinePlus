const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
  
const config = require('../../resources/config.json');
const { getTranslation } = require('../../languages/controller');
const lang = getTranslation();

module.exports = 
{
    // -------------------
    //    SLASH BUILDER
    // -------------------  
    
    data: new SlashCommandBuilder()
        .setName(lang.playerHead.slash.name)
        .setDescription(lang.playerHead.slash.description)
        
        .addStringOption(option => option.setName(lang.playerHead.slash.option.name)
            .setDescription(lang.playerHead.slash.option.description)
            .setRequired(true)
        ),
  
    // -------------------
    //   COMMAND EXECUTE
    // -------------------

    async execute(interaction) 
    {
        let uuid;
        const mention = interaction.user.toString();
        const username = interaction.options.getString(lang.playerHead.slash.option.name);

        // -------------------
        //    COMMAND CHECK
        // -------------------

        if(!config.commands.player_head) 
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
        //    GET USER UUID
        // -------------------
        
        try 
        {
            const response = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
            uuid = response.data.id;
        }

        // -------------------
        //   USER NOT FOUND
        // -------------------        
        
        catch (error) 
        {
            const headNotFoundEmbed = new EmbedBuilder()
                .setTitle(lang.playerHead.embed.notfound.title)
                .setDescription(lang.playerHead.embed.notfound.description.replace('{player_name}', username))
                .setColor("Red")
                .setTimestamp();
                
            return interaction.reply({
                content: mention,
                embeds: [headNotFoundEmbed],
                flags: 64
            });
        }

        // -------------------
        //     USER FOUND
        // -------------------        

        try 
        {
            const sucessEmbed = new EmbedBuilder()
                .setTitle(lang.playerHead.embed.showhead.title.replace('{player_name}', username))
                .setColor("Yellow")
                .setTimestamp()
                .setImage(`https://crafatar.com/avatars/${uuid}.png`);
                
            return interaction.reply({
                content: mention,
                embeds: [sucessEmbed],});
        }

        // -------------------
        //    INTERNAL ERROR
        // -------------------        
        
        catch(error)
        {
            // -------------------
            //   ERROR FEEDBACK
            // -------------------
        
            console.log(error);
            console.log("[MinePlus] => [C] Critical => An unknown error occurred in the Player Head command!");
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
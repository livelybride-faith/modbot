const { Client } = require("revolt.js");
const express = require("express");

// 1. RENDER PORT BINDING
const app = express();
app.get("/", (req, res) => res.send("AutoMod is shielding the server."));
app.listen(process.env.PORT || 10000);

// 2. BOT SETUP
const client = new Client({ apiURL: "https://api.stoat.chat" });

// Define forbidden words or patterns
const BANNED_WORDS = ["spamlink.com", "badword1", "badword2"]; 

client.on("ready", () => console.log(`🛡️ AutoMod active as ${client.user.username}`));

client.on("messageCreate", async (message) => {
    if (message.author?.bot) return;

    const content = message.content.toLowerCase();

    // 3. MODERATION LOGIC
    const containsBanned = BANNED_WORDS.some(word => content.includes(word));
    
    if (containsBanned) {
        try {
            await message.delete();
            const warning = await message.channel.sendMessage(`⚠️ <@${message.author.id}>, your message was removed for violating server rules.`);
            // Auto-delete the warning after 5 seconds
            setTimeout(() => warning.delete(), 5000);
            console.log(`[MOD] Deleted message from ${message.author.username}`);
        } catch (e) {
            console.error("Failed to delete message. Check permissions!");
        }
    }
});

client.loginBot(process.env.BOT_TOKEN);
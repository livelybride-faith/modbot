const { Client } = require("revolt.js");
const fs = require("fs"); // Import File System module
const express = require("express");

// --- 1. RENDER WEB SERVER ---
const app = express();
app.get("/", (req, res) => res.send("AutoMod is shielding the server."));
app.listen(process.env.PORT || 10000);

// --- 2. LOAD EXTERNAL BANNED WORDS ---
let BANNED_WORDS = [];
try {
    const data = fs.readFileSync("banned_words.txt", "utf8");
    // Split by comma and remove any accidental spaces/new lines
    BANNED_WORDS = data.split(",").map(word => word.trim().toLowerCase());
    console.log(`🛡️ Loaded ${BANNED_WORDS.length} banned words from file.`);
} catch (err) {
    console.error("❌ Could not find banned_words.txt! Starting with empty list.");
}

// --- 3. BOT SETUP ---
const client = new Client({ apiURL: "https://api.stoat.chat" });

client.on("ready", () => console.log(`✅ AutoMod logged in as ${client.user.username}`));

client.on("messageCreate", async (message) => {
    if (!message.content || message.author?.bot) return;

    // Remove punctuation and split message into words
    const userWords = message.content
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/);

    // Check if any word in the message is in our BANNED_WORDS list
    const foundBadWord = userWords.some(word => BANNED_WORDS.includes(word));

    if (foundBadWord) {
        try {
            await message.delete();
            const warning = await message.channel.sendMessage(`⚠️ <@${message.author.id}>, that word is not allowed here.`);
            setTimeout(() => warning.delete(), 4000);
            console.log(`[MOD] Deleted message from ${message.author.username}`);
        } catch (e) {
            console.error("Mod Error: Check if Bot has 'Manage Messages' permission.");
        }
    }
});

client.loginBot(process.env.BOT_TOKEN);
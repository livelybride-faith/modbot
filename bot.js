const { Client } = require("revolt.js");
const fs = require("fs");
const path = require("path"); // Added for reliable file paths
const express = require("express");

// --- 1. RENDER WEB SERVER ---
const app = express();
app.get("/", (req, res) => res.send("AutoMod is shielding the server."));
app.listen(process.env.PORT || 10000);

// --- 2. LOAD EXTERNAL BANNED WORDS ---
let BANNED_WORDS = [];

function loadBannedWords() {
    try {
        const filePath = path.join(__dirname, "banned_words.txt");
        
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, "utf8");

            // --- THE FIX ---
            // This regex splits by commas OR any type of newline (\r or \n)
            BANNED_WORDS = rawData.split(/[,\r\n]+/)
                .map(word => word.trim().toLowerCase()) // Clean up spaces
                .filter(word => word.length > 0);        // Remove empty lines
            
            console.log(`🛡️ AutoMod: Successfully loaded ${BANNED_WORDS.length} words.`);
        } else {
            console.log("⚠️ Warning: banned_words.txt not found.");
        }
    } catch (err) {
        console.error("❌ Error reading banned_words.txt:", err.message);
    }
}

// Initial load
loadBannedWords();

// --- 3. BOT SETUP ---
const client = new Client({ apiURL: "https://api.stoat.chat" });

client.on("ready", () => {
    console.log(`✅ Shield Active: Logged in as ${client.user.username}`);
});

client.on("messageCreate", async (message) => {
    // 1. Safety Checks
    if (!message.content || message.author?.bot) return;

    // 2. Format the message for checking
    // Removes symbols but keeps the space between words
    const cleanMessage = message.content
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    const userWords = cleanMessage.split(/\s+/);

    // 3. Scan for banned words
    const foundBadWord = userWords.some(word => BANNED_WORDS.includes(word));

    if (foundBadWord) {
        try {
            await message.delete();
            
            // Send a self-destructing warning
            const warning = await message.channel.sendMessage(
                `⚠️ **AutoMod:** <@${message.author.id}>, that language is not permitted here.`
            );
            
            setTimeout(() => {
                warning.delete().catch(() => {}); // Catch error if warning already deleted
            }, 4000);

            console.log(`[MOD] Removed message from ${message.author.username}`);
        } catch (e) {
            console.error("Mod Error: Ensure the bot has 'Manage Messages' permissions.");
        }
    }
});

// --- 4. START ---
if (!process.env.BOT_TOKEN) {
    console.error("❌ Missing BOT_TOKEN environment variable!");
} else {
    client.loginBot(process.env.BOT_TOKEN);
}
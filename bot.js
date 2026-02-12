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
        // Path joins the current folder with the filename
        const filePath = path.join(__dirname, "banned_words.txt");
        
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, "utf8");
            // Split by comma, filter out empty strings, and trim whitespace
            BANNED_WORDS = data.split(",")
                .map(word => word.trim().toLowerCase())
                .filter(word => word.length > 0);
            
            console.log(`🛡️ AutoMod: Successfully loaded ${BANNED_WORDS.length} words.`);
        } else {
            console.log("⚠️ Warning: banned_words.txt not found in root directory.");
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
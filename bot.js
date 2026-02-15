const { Client } = require("revolt.js");
const fs = require("fs");
const path = require("path");
const express = require("express");

// --- 1. CONFIGURATION ---
const AUTO_ASSIGN_ROLE = process.env.AUTO_ASSIGN_ROLE; 
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID; 

// --- 2. RENDER WEB SERVER ---
const app = express();
app.get("/", (req, res) => res.send("AutoMod is shielding the server."));
app.listen(process.env.PORT || 10000);

// --- 3. LOAD EXTERNAL BANNED WORDS ---
let BANNED_WORDS = [];

function loadBannedWords() {
    try {
        const filePath = path.join(__dirname, "banned_words.txt");
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, "utf8");
            BANNED_WORDS = rawData.split(/[,\r\n]+/)
                .map(word => word.trim().toLowerCase())
                .filter(word => word.length > 0);
            console.log(`AutoMod: Successfully loaded ${BANNED_WORDS.length} words.`);
        } else {
            console.log("Warning: banned_words.txt not found.");
        }
    } catch (err) {
        console.error("Error reading banned_words.txt:", err.message);
    }
}

loadBannedWords();

// --- 4. BOT SETUP ---
const client = new Client({ apiURL: "https://api.stoat.chat" });

client.on("ready", () => {
    console.log(`Shield Active: Logged in as ${client.user.username}`);
});

// --- 5. AUTO-ROLE ON JOIN ---
client.on("memberJoin", async (member) => {
    // Check if AUTO_ROLE_ID exists and isn't just an empty string
    if (!AUTO_ROLE_ID || AUTO_ROLE_ID.trim() === "") {
        console.log("AutoRole: Feature is disabled (no Role ID provided).");
        return;
    }

    try {
        const server = member.server;
        if (!server) return;

        // Assign the role
        await member.edit({ roles: [AUTO_ROLE_ID] });
        
        console.log(`AutoRole: Assigned role to ${member.user?.username || member._id}`);
    } catch (e) {
        console.error(`AutoRole Error: Check Role ID and permissions.`, e.message);
    }
});

// --- 6. MODERATION LOGIC ---
client.on("messageCreate", async (message) => {
    if (!message.content || message.author?.bot) return;

    const cleanMessage = message.content
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    const userWords = cleanMessage.split(/\s+/);
    const foundBadWord = userWords.some(word => BANNED_WORDS.includes(word));

    if (foundBadWord) {
        try {
            await message.delete();
            const warning = await message.channel.sendMessage(
                `AutoMod: <@${message.author.id}>, that language is not permitted here.`
            );
            
            setTimeout(() => {
                warning.delete().catch(() => {});
            }, 4000);

            console.log(`[MOD] Removed message from ${message.author.username}`);
        } catch (e) {
            console.error("Mod Error: Ensure the bot has 'Manage Messages' permissions.");
        }
    }
});

// --- 7. START ---
if (!process.env.BOT_TOKEN) {
    console.error("Missing BOT_TOKEN environment variable!");
} else {
    client.loginBot(process.env.BOT_TOKEN);
}
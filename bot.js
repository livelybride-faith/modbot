import { Client } from "stoat.js";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. CONFIGURATION ---
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID; 
const BOT_TOKEN = process.env.BOT_TOKEN;
const PREFIX = "!";

// --- 2. WEB SERVER ---
const PORT = process.env.PORT || 10000;
const app = express();
app.get("/", (req, res) => res.send("AutoMod is shielding the server."));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

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
const client = new Client();

client.on("error", (err) => {
    console.error("Socket Error:", err);
    // This prevents the bot from crashing. 
    // It will usually try to reconnect automatically.
});

client.on("ready", () => {
    console.log(`Shield Active: Logged in as ${client.user.username}`);
    
    // Heartbeat: Fetch self every 25s to keep connection alive
    setInterval(async () => {
        try {
            await client.users.fetch(client.user.id);
        } catch (e) {
            console.error("Heartbeat failed");
        }
    }, 25000);
});

// --- 5. AUTO-ROLE ON JOIN ---
// Corrected event name based on documentation
client.on("serverMemberJoin", async (member) => {
    console.log("AutoRole: Start");
    if (!AUTO_ROLE_ID || AUTO_ROLE_ID.trim() === "") {
        console.log("AutoRole: Feature is disabled (no Role ID provided).");
        return;
    }

    try {
        // Stoat.js/Revolt.js v7+ uses .edit on the member directly
        await member.edit({ roles: [AUTO_ROLE_ID] });
        console.log(`AutoRole: Assigned role to ${member.user?.username || member._id}`);
    } catch (e) {
        console.error(`AutoRole Error: Check Role ID and permissions.`, e.message);
    }
});

// --- 6. MODERATION LOGIC ---
client.on("messageCreate", async (message) => {
    if (!message.content || message.author?.bot) return;

    const rawContent = message.content.trim();
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
            console.error("Mod Error: Ensure the bot has Manage Messages permissions.");
        }
    }

    if (!rawContent.startsWith(PREFIX)) return;

    const fullCommand = rawContent.slice(PREFIX.length).trim();
    const args = fullCommand.split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commandName === "ping") {
        return message.channel.sendMessage("Pong! ModBot is active.");
    }
});

// --- 7. START ---
if (!BOT_TOKEN) {
    console.error("Missing BOT_TOKEN environment variable!");
} else {
    client.loginBot(BOT_TOKEN);
}
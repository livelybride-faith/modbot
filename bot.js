import { Client } from "stoat.js";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. CONFIGURATION ---
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID; 
const BOT_TOKEN = process.env.BOT_TOKEN;
const PREFIX = "!";

const SPAM_THRESHOLD = 10;      
const SPAM_INTERVAL = 6000;    
const userMessages = new Map(); 

// --- 2. WEB SERVER (Keep-Alive) ---
const PORT = process.env.PORT || 10000;
const app = express();
app.get("/", (req, res) => res.send("ModBot is online."));
app.listen(PORT, () => console.log(`[WEB] Server active on port ${PORT}`));

// --- 3. LOAD BANNED WORDS ---
let BANNED_WORDS = [];
function loadBannedWords() {
    try {
        const filePath = path.join(__dirname, "banned_words.txt");
        if (fs.existsSync(filePath)) {
            BANNED_WORDS = fs.readFileSync(filePath, "utf8")
                .split(/[,\r\n]+/)
                .map(word => word.trim().toLowerCase())
                .filter(word => word.length > 0);
            console.log(`[SYSTEM] Loaded ${BANNED_WORDS.length} banned words.`);
        }
    } catch (err) {
        console.error("[ERROR] Failed to load banned words:", err.message);
    }
}
loadBannedWords();

// --- 4. BOT SETUP & RECONNECT LOGIC ---
const client = new Client();

client.on("ready", () => {
    console.log(`[SUCCESS] Connected as ${client.user.username}`);
});

// If the WebSocket closes, this will trigger
client.on("logout", () => {
    console.log("[WARNING] Disconnected from Stoat. Attempting to reconnect...");
    startBot();
});

client.on("error", (err) => {
    console.error("[SOCKET ERROR]", err);
});

// --- 5. AUTO-ROLE ---
client.on("serverMemberJoin", async (member) => {
    if (!AUTO_ROLE_ID) return;
    try {
        await member.edit({ roles: [AUTO_ROLE_ID] });
        console.log(`[AUTOROLE] Assigned role to ${member.user?.username || member._id}`);
    } catch (e) {
        console.error(`[AUTOROLE ERROR] Check bot permissions:`, e.message);
    }
});

// --- 6. MODERATION & COMMANDS ---
client.on("messageCreate", async (message) => {
    if (!message.content || message.author?.bot) return;

    const authorId = message.author.id;
    const now = Date.now();

    // Anti-Spam Logic
    if (!userMessages.has(authorId)) userMessages.set(authorId, []);
    const timestamps = userMessages.get(authorId);
    timestamps.push(now);

    const recentMessages = timestamps.filter(time => now - time < SPAM_INTERVAL);
    userMessages.set(authorId, recentMessages);

    if (recentMessages.length > SPAM_THRESHOLD) {
        try {
            await message.delete();
            if (recentMessages.length === SPAM_THRESHOLD + 1) {
                await message.channel.sendMessage(`<@${authorId}>, slow down. Anti-spam active.`);
            }
            return;
        } catch (e) {
            console.error("[MOD] Spam delete failed:", e.message);
        }
    }

    // Word Filter
    const cleanMessage = message.content.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const userWords = cleanMessage.split(/\s+/);
    const hasBadWord = userWords.some(word => BANNED_WORDS.includes(word));

    if (hasBadWord) {
        try {
            await message.delete();
            await message.channel.sendMessage(`Notice: <@${authorId}>, that language is not allowed.`);
            return;
        } catch (e) {
            console.error("[MOD] Word filter failed:", e.message);
        }
    }

    // Commands
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "ping") {
        message.channel.sendMessage("Pong! ModBot is active.");
    }
});

// --- 7. START FUNCTION ---
async function startBot() {
    if (!BOT_TOKEN) {
        console.error("[FATAL] BOT_TOKEN missing in .env!");
        return;
    }

    try {
        await client.loginBot(BOT_TOKEN);
    } catch (error) {
        console.error("[LOGIN FAILED] Retrying in 10 seconds...", error.message);
        setTimeout(startBot, 10000); // Retry after 10 seconds
    }
}

startBot();
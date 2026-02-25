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

// Define the rules in an object for easy access
const RULES = {
    "1": "### 1. The Golden Rule (Matthew 7:12)\nTreat every member, the body of Christ, with the respect and love due to a fellow image-bearer of God. If disagreement should arise, keep your tone seasoned with salt (Colossians 4:6).",
    "2": "### 2. Purity of Language & Content\nThis is a family-friendly community. We aim to keep our conversation \"above reproach.\"\n\n- **No Profanity**: Please refrain from using foul language, including bypassed filters or \"masked\" swearing.\n- **No NSFW**: Absolutely no sexually explicit, suggestive, or gore-related content. This includes avatars, nicknames, and \"memes.\"\n- **Wholesome Contents**: Ensure any videos or links shared align with a standard of \"whatever is pure, whatever is lovely\" (Philippians 4:8).",
    "3": "### 3. Theological Discussion & Conduct\nWe welcome questions but no debates, maintaining peace and unity in Christ's Spirit is our priority.\n\n- **Secondary Matters**: We recognize that believers differ on non-essential doctrines. Kindly \"agree to disagree\" gracefully.\n- **No Proselytizing for Other Religions**: While all are welcome to observe and ask questions, this server exists to promote the Christian faith.\n- **Respect the Word**: Avoid using Scripture to mock, troll, or intentionally twist meanings to cause division.",
    "4": "### 4. Moderation & Authority\n\n- **Listen to Mods:** Our staff is here to keep the peace. If a Moderator asks you to change a topic or tone, please comply immediately.\n- **Dispute Privately:** If you have an issue with a moderator's decision, please DM an Administrator rather than arguing in public channels.",
    "5": "### 5. Standard Stoat.Chat Safety\n- **Privacy:** Do not share personal information (address, phone number, sensitive data such as passwords) of yourself or others.",
    "6": "### 6. General Conduct & Respect\n\n- **Be Kind:** No harassment, bullying, hate speech, or personal attacks. Respect all members' opinions and boundaries.\n- **Stay Civil:** No political or religious debates or \"baiting\" others into fights, no trolling.\n- **Professionalism:** No impersonating staff/members and follow all moderator directions and do not hunt for rule loopholes.\n- **Safety First:** No doxxing, leaking private sensitive info on DMs/VCs. Threats and violent behavior result in an immediate ban.",
    "7": "### 7. Content & Media Standards\n\n- **Keep it Clean:** Strictly no NSFW, gore, or disturbing media in general channels. Profiles (avatars/nicknames) must stay family-friendly.\n- **Appropriate Posting:** Use designated channels. Avoid \"cursed\" images, shock content, or jump-scares.\n- **No Misinformation:** Do not spread fake news, hoaxes, or \"fake giveaway\" scams.",
    "8": "### 8. Messaging & Anti-Spam\n\n- **Quality over Quantity:** No spamming text, emojis, reactions, or GIFs. Avoid flooding the chat with repetitive memes.\n- **Respectful Pinging:** Do not ping-spam.\n- **Clean Links:** No advertising without approval. No malware, phishing, or pirated materials.",
    "9": "### 9. Voice Channel (VC) Etiquette\n\n- **Audio Quality:** No mic-spamming, screaming, or using annoying voice changers.\n- **Respect the Floor:** Do not talk over others or \"stalk\" members across VCs. Respect conversations in progress.\n- **Stream Ethics:** No streaming NSFW or pirated content. Do not record calls without the explicit consent of everyone present.",
    "10": "### 10. Creative & Art Guidelines\n\n- **No Theft:** Art theft, tracing without consent, or stealing NFTs is strictly prohibited. Always provide proper credit.\n- **Constructive Vibes:** Only provide critiques if requested. Never insult anyone's work or a specific art style.",
    "11": "### 11. Legal & Platform Compliance\n\n- **Stoat.Chat Rules:** All members must comply with the [Terms of Service](https://stoat.chat/legal/terms) and [Community Guidelines](https://stoat.chat/legal/community-guidelines).\n- **Account Integrity:** No multi-account abuse, ban evasion, or use of the server for raids/illegal acts."
};

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

    // --- DETECT !rule# ANYWHERE IN THE MESSAGE ---
    // This regex looks for "!rule" followed by 1 or 2 digits (e.g., !rule1 or !rule11)
    const ruleMatch = message.content.match(/!rule(\d{1,2})/i);

    if (ruleMatch) {
        const ruleNum = ruleMatch[1]; // Extracts just the number (e.g. "4")
        if (RULES[ruleNum]) {
            return message.channel.sendMessage(RULES[ruleNum]);
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

// --- 8. START FUNCTION ---
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
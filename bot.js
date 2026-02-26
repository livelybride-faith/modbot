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
const WELCOME_ROLE_ID = process.env.WELCOME_ROLE_ID;
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;
const SERVER_ID = process.env.SERVER_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const PREFIX = "!";

const SPAM_THRESHOLD = 10;      
const SPAM_INTERVAL = 6000;    
const userMessages = new Map(); 

// Membership Check Config
const MEMBERSHIP_WAIT_TIME = 1 * 60 * 1000; // 15 Minutes
const CRON_INTERVAL = 60000; // Check every 1 minute

// Time out function Config
const AUTHORIZED_ROLES = process.env.AUTHORIZED_MOD_ROLES 
    ? process.env.AUTHORIZED_MOD_ROLES.split(',').map(id => id.trim()) 
    : [];

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

    // --- 2. THE CHECK (Inside messageCreate) ---
    const userRoles = message.member?.roles || [];

    // Convert userRoles to strings just in case they are objects/numbers
    const isMod = userRoles.some(roleId => {
        return AUTHORIZED_ROLES.includes(String(roleId));
    });

    // --- COMMAND: !mute <@mention> [duration] ---
    if (command === "mute") {
        if (!isMod) return message.channel.sendMessage("❌ Only moderators can use this.");

        const targetInput = args[0];
        if (!targetInput) return message.channel.sendMessage("❌ Usage: `!mute @user 15m` ");

        // 1. Clean the ID from the mention
        const targetId = targetInput.replace(/[<@!>]/g, '');
        
        // 2. Duration
        let durationMs = 15 * 60 * 1000; // Default: 15m
        const timeInput = args[1] ? args[1].toLowerCase() : null;

        if (timeInput) {
            const timeValue = parseInt(timeInput);
            
            if (isNaN(timeValue)) {
                return message.channel.sendMessage("❌ Invalid time format. Use: 15m, 2h, or 1d.");
            }

            if (timeInput.includes('d')) {
                durationMs = timeValue * 24 * 60 * 60 * 1000; // Days
            } else if (timeInput.includes('h')) {
                durationMs = timeValue * 60 * 60 * 1000;      // Hours
            } else if (timeInput.includes('m')) {
                durationMs = timeValue * 60 * 1000;           // Minutes
            } else {
                durationMs = timeValue * 60 * 1000;           // Default to mins if no unit
            }
        }

        // Optional: Safety cap at 28 days (standard API limit)
        if (durationMs > 2419200000) {
            return message.channel.sendMessage("❌ Timeout cannot exceed 28 days.");
        }

        try {
            // 3. API PATCH (Directly from your reference code)
            const timeoutExpiry = new Date(Date.now() + durationMs).toISOString();

            await client.api.patch(
                `/servers/${message.server.id}/members/${targetId}`,
                { timeout: timeoutExpiry }
            );

            // 1. Get the Unix seconds from the expiry date
            const unixTimestamp = Math.floor(new Date(timeoutExpiry).getTime() / 1000);

            // 2. Use the :T tag for "Long Time" (usually includes AM/PM) 
            // and :R for "Relative" (in 15 minutes)
            message.channel.sendMessage(`Timed out. <@${targetId}> will be unmute <t:${unixTimestamp}:R>`);

        } catch (e) {
            console.error("[MUTE ERROR]", e);
            message.channel.sendMessage(`❌ Failed to mute: ${e.message}`);
        }
    }

    // --- COMMAND: !unmute <@mention> ---
    if (command === "unmute") {
        if (!isMod) return;

        const targetId = args[0]?.replace(/[<@!>]/g, '');
        if (!targetId) return;

        try {
            // As per your source, setting timeout to Date(0) clears it
            await client.api.patch(
                `/servers/${message.server.id}/members/${targetId}`,
                { timeout: new Date(0).toISOString() }
            );
            message.channel.sendMessage(`🔓 Timeout cleared for <@${targetId}>.`);
        } catch (e) {
            message.channel.sendMessage(`❌ Error clearing timeout: ${e.message}`);
        }
    }

    // --- COMMAND: !info <@mention> ---
    if (command === "info") {
        // 1. Get the target ID (clean the mention or use author's ID)
        const targetInput = args[0];
        const targetId = targetInput ? targetInput.replace(/[<@!>]/g, '') : message.author.id;

        try {
            // 2. Fetch Member Data directly via API (same way we PATCH)
            const member = await client.api.get(`/servers/${message.server.id}/members/${targetId}`);
            
            if (member) {
                // 3. Extract status and timeout
                const timeoutValue = member.timeout; 
                const isMuted = timeoutValue && new Date(timeoutValue) > new Date();
                
                // Get user data (username) - API member objects usually nest user info
                const username = member.user?.username || targetId;

                let statusMsg = `**Status:** ${isMuted ? "🚫 Muted" : "🟢 Active"}\n`;
                
                if (isMuted) {
                    const unixExpiry = Math.floor(new Date(timeoutValue).getTime() / 1000);
                    // Use :T for AM/PM and :R for "in X minutes"
                    statusMsg += `**Unmute:** <t:${unixExpiry}:R>`;
                }
                
                message.channel.sendMessage(statusMsg);
            }
        } catch (e) {
            console.error("[INFO ERROR]", e);
            // If the API returns 404, the user isn't in the server
            message.channel.sendMessage(`❌ User not found. Use a mention like \`!info @username\`.`);
        }
    }

    if (command === "mutes") {
        if (!isMod) return;

        try {
            let rawData = await message.server.fetchMembers();
            
            // 1. Convert to Array. If rawData.users exists, use that. 
            // Otherwise, take the values of the object.
            let allMembers = rawData.users ? Object.values(rawData.users) : Object.values(rawData);
            
            // 2. Filter for mutes
            const now = new Date();
            const mutedMembers = allMembers.filter(m => {
                // Safety check: ensure 'm' exists and has a timeout
                const expiry = m?.timeout || m?.communication_disabled_until;
                return expiry && new Date(expiry) > now;
            });

            if (mutedMembers.length === 0) {
                return message.channel.sendMessage("✅ No users are currently silenced.");
            }

            // 3. Build the list
            let response = "### 🚫 Currently Silenced Users\n";
            mutedMembers.forEach(m => {
                const expiry = m.timeout || m.communication_disabled_until;
                const unixExpiry = Math.floor(new Date(expiry).getTime() / 1000);
                
                // Try to find a name: member.user.username OR member.nickname OR member.id
                const name = m.user?.username || m.nickname || m.id || "Unknown";
                response += `* **${name}** — ends <t:${unixExpiry}:T> (<t:${unixExpiry}:R>)\n`;
            });

            message.channel.sendMessage(response);

        } catch (e) {
            console.error("[MUTES LIST ERROR]", e);
            message.channel.sendMessage("❌ Logic error. Check bot console.");
        }
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
# modbot
Moderator Bot for StoatChat

## Feature : 
1. Automatically delete the message when banned words detected.
2. Auto assign role when new user join.
3. Anti-spamming.
4. Command to return rules' content, kindly change the content in 
```javascript
const RULES = { }
```
5. Mute, unmute and info function. Default is set to 15m. Enter 20m for 20 minutes, 2h for 2hours, 20d for 20 days & so on...

| Command | Action |
| :--- | :--- |
| `!mute @username 15m` | Mute user for 15 mins |
| `!mute @username 1h` | Mute user for 1 hour |
| `!mute @username 1d` | Mute user for 1 day (Max 28 days) |
| `!unmute @username` | Remove mute |
| `!info @username` | Check status |

---
ENV Var : 
```env
#TRUE to enable auto assign role when new member join.
AUTO_ASSIGN_ROLE = TRUE 
AUTO_ROLE_ID = [YOUR_ROLE_ID]
#Multiple roles separated by ,
AUTHORIZED_MOD_ROLES=YOUR_ROLE_ID, YOUR_ANOTHER_ROLE_ID
```
## 📜 License
This project is licensed under the MIT License - see the [LICENSE](https://github.com/livelybride-faith/modbot/blob/main/LICENSE) file for details.

## Buy me a coffee 
[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/paypalme/MichelleYeow)

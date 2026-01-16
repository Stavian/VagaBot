# VagaBot Deployment Guide

**Last Updated:** 2026-01-16

This guide covers deploying VagaBot for 24/7 operation using PM2 on a local PC or Raspberry Pi.

---

## 📋 Prerequisites

- ✅ Node.js installed
- ✅ Bot fully configured (`.env` file with all API keys)
- ✅ Commands deployed (`npm run deploy`)
- ✅ PM2 installed globally (`npm install -g pm2`)

---

## 🚀 Quick Start

### 1. Deploy Commands (if not already done)
```bash
npm run deploy
```

### 2. Start Bot with PM2
```bash
npm run pm2:start
```

### 3. Verify Bot is Running
```bash
npm run pm2:status
```

You should see:
```
┌────┬────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id │ name       │ mode        │ status  │ cpu     │ memory   │
├────┼────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0  │ VagaBot    │ fork        │ online  │ 0%      │ 50.2mb   │
└────┴────────────┴─────────────┴─────────┴─────────┴──────────┘
```

---

## 📊 PM2 Commands Reference

### Basic Operations
```bash
# Start the bot
npm run pm2:start

# Stop the bot
npm run pm2:stop

# Restart the bot
npm run pm2:restart

# View real-time logs
npm run pm2:logs

# View process status
npm run pm2:status

# Real-time monitoring dashboard
npm run pm2:monit
```

### Advanced PM2 Commands
```bash
# View detailed info
pm2 info VagaBot

# Show logs from specific time
pm2 logs VagaBot --lines 100

# Clear logs
pm2 flush

# Delete process from PM2
pm2 delete VagaBot
```

---

## 🔄 Auto-Start on System Boot

To make VagaBot start automatically when your PC/Pi boots:

### Windows
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save

# Install PM2 Windows service (requires admin)
npm install -g pm2-windows-startup
pm2-startup install
```

### Linux/Raspberry Pi
```bash
# Generate startup script (follow the command it outputs)
pm2 startup

# Save current process list
pm2 save
```

**Verify auto-start:**
Restart your PC/Pi and check if VagaBot is running:
```bash
pm2 status
```

---

## 📝 Configuration

### PM2 Ecosystem Config (`ecosystem.config.js`)

The bot is configured with:
- **Max Memory:** 500MB (auto-restart if exceeded)
- **Auto-restart:** Enabled
- **Max Restarts:** 10 within min uptime period
- **Min Uptime:** 10 seconds before considered stable
- **Restart Delay:** 4 seconds between restarts
- **Logs:** Saved to `logs/` directory

### Modify Configuration

Edit `ecosystem.config.js` to change settings:
```javascript
{
  max_memory_restart: '500M',  // Increase if needed
  max_restarts: 10,            // Max restart attempts
  restart_delay: 4000,         // Delay between restarts (ms)
  watch: false                 // Set to true for auto-reload on code changes
}
```

After modifying, restart:
```bash
pm2 restart VagaBot --update-env
```

---

## 🔍 Monitoring & Logs

### Real-Time Monitoring
```bash
# Interactive dashboard
pm2 monit

# Real-time logs
pm2 logs VagaBot --lines 50
```

### Log Files
Logs are saved to:
- **Output logs:** `logs/out.log`
- **Error logs:** `logs/error.log`

View logs directly:
```bash
# View recent output
tail -f logs/out.log

# View recent errors
tail -f logs/error.log
```

### Discord Error Logging

Errors are automatically posted to Discord:
1. Set up a bot-logs channel in Discord
2. Configure it: `/config log_channel #bot-logs`
3. All errors will be logged to that channel with timestamps

---

## 🐛 Troubleshooting

### Bot Won't Start
```bash
# Check PM2 logs
pm2 logs VagaBot --err

# Check if port is in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000                  # Linux
```

### Bot Keeps Restarting
```bash
# View restart count
pm2 status

# Check error logs
pm2 logs VagaBot --err --lines 100

# Common causes:
# - Missing .env file or invalid API keys
# - Database file locked or corrupted
# - Network connectivity issues
```

### High Memory Usage
```bash
# Check current memory
pm2 status

# Increase max memory in ecosystem.config.js:
max_memory_restart: '1G'  # Increase to 1GB

# Restart
pm2 restart VagaBot --update-env
```

### Bot Not Auto-Starting on Boot
```bash
# Re-generate startup script
pm2 unstartup
pm2 startup

# Save process list again
pm2 save

# Reboot and verify
pm2 status
```

---

## 🔐 Security Best Practices

### 1. Protect .env File
```bash
# Verify .env is not tracked by git
git check-ignore -v .env

# Should output: .gitignore:2:.env    .env
```

### 2. Regular Backups
Backup important files regularly:
```bash
# Backup database
cp data/database.db data/database-backup-$(date +%Y%m%d).db

# Backup .env
cp .env .env.backup
```

### 3. Update Dependencies
```bash
# Check for updates
npm outdated

# Update packages
npm update

# Update PM2
npm update -g pm2
```

---

## 📈 Performance Optimization

### Monitor Resource Usage
```bash
# Check CPU and memory
pm2 monit

# View metrics
pm2 show VagaBot
```

### Optimize for Low-End Hardware
For Raspberry Pi or older PCs, adjust `ecosystem.config.js`:
```javascript
{
  max_memory_restart: '300M',  // Lower memory limit
  node_args: '--max_old_space_size=256'  // Limit Node.js heap
}
```

---

## 🆘 Emergency Commands

### Quick Restart
```bash
pm2 restart VagaBot
```

### Stop Everything
```bash
pm2 stop all
```

### Nuclear Option (reset PM2)
```bash
pm2 kill
pm2 start ecosystem.config.js
```

---

## 📞 Need Help?

- **View logs:** `pm2 logs VagaBot`
- **Check Discord:** Error messages in `#bot-logs` channel
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **GitHub Issues:** https://github.com/Stavian/VagaBot/issues

---

## ✅ Deployment Checklist

- [ ] PM2 installed globally
- [ ] Bot tested locally (`npm start`)
- [ ] Commands deployed (`npm run deploy`)
- [ ] `.env` file configured
- [ ] Bot started with PM2 (`npm run pm2:start`)
- [ ] Auto-start on boot configured (`pm2 startup` + `pm2 save`)
- [ ] Discord log channel configured (`/config log_channel`)
- [ ] Bot status appears as "Watching the Squad"
- [ ] Logs directory created and writable
- [ ] Backup strategy in place

---

## 🎉 Success!

Your bot is now running 24/7! Check the status anytime with:
```bash
pm2 status
```

Monitor logs in real-time:
```bash
pm2 logs VagaBot
```

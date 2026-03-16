# Email Logging Test Instructions

## Current Status
✅ Content script is detecting emails and sending data
✅ Background script is acknowledging the messages

## Next Steps to Verify

### 1. Check Service Worker Console
1. Open `chrome://extensions`
2. Find ARGUS extension
3. Click "Service worker" (blue link)
4. Look for these logs:
   ```
   [ARGUS Email] Logging email scan to database: {...}
   [ARGUS Email] Response status: 200 OK
   [ARGUS Email] Successfully logged to database: {...}
   ```

### 2. Check Next.js Terminal
Look for these logs in your terminal where `npm run dev` is running:
```
[ARGUS Email] Received pre-computed analysis from extension
[ARGUS Email Log] Starting log process...
[ARGUS Email Log] MongoDB connected successfully
[ARGUS Email Log] Successfully created log entry with ID: <id>
```

### 3. Test Database Connection
```bash
# Test MongoDB connection
curl http://localhost:3000/api/test-db

# Check recent email logs
curl http://localhost:3000/api/email-logs

# Check with limit
curl http://localhost:3000/api/email-logs?limit=5
```

### 4. Manual API Test
```bash
curl -X POST http://localhost:3000/api/analyze-email \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "test@example.com",
    "subject": "Test Email",
    "verdict": "SUSPICIOUS",
    "score": 65,
    "reason": "Test reason",
    "signals": ["signal1", "signal2"]
  }'
```

Expected response:
```json
{
  "success": true,
  "logged": true,
  "logId": "<mongodb-id>",
  "verdict": "SUSPICIOUS",
  "score": 65,
  ...
}
```

## Troubleshooting

### If Service Worker shows no logs:
1. The background script might not be running
2. Reload the extension: `chrome://extensions` → Click "Reload"
3. Check for errors in service worker console

### If API shows errors:
1. Make sure Next.js is running: `cd argus/ARGUS && npm run dev`
2. Check MongoDB connection in `.env.local`
3. Test connection: `curl http://localhost:3000/api/test-db`

### If logs show success but no database entry:
1. Check Next.js terminal for MongoDB errors
2. Verify MONGODB_URI in `.env.local`
3. Check MongoDB Atlas network access settings

## Quick Verification Script

Run this to see all email logs:
```bash
curl http://localhost:3000/api/email-logs | json_pp
```

Or in PowerShell:
```powershell
(Invoke-WebRequest -Uri "http://localhost:3000/api/email-logs").Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## What You Should See

If everything is working, you should see:
1. ✅ Content script logs in Gmail console
2. ✅ Background script logs in service worker console
3. ✅ API logs in Next.js terminal
4. ✅ Database entries when you call `/api/email-logs`

## Current Email Detections Observed

From your logs, the extension detected:
1. Email from "hello@ollama.com" - CLEAR (0 score)
2. Email "Intern at EY" - SUSPICIOUS (45 score, 3 suspicious links)

These should now be in the database if the API calls succeeded.

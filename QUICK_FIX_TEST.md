# Quick Fix & Test Guide

## Current Status
✅ Content script detects emails and sends to background
✅ Background script acknowledges messages  
✅ Database has 3 test logs (manually created)
✅ API `/api/security-analytics` returns data correctly
❌ Gmail detections not appearing in database

## The Problem
The background script is receiving messages from the content script but NOT calling the API to save them to the database.

## Quick Test

### 1. Reload Extension
```
1. Go to chrome://extensions
2. Find ARGUS extension
3. Click "Reload" button
4. Click "Service worker" link to open console
```

### 2. Open Gmail and Check Logs
Open an email in Gmail and look for these logs in **Service Worker console**:

**Expected logs:**
```
[ARGUS BG] Received message: logEmailScan from tab: <number>
[ARGUS BG] logEmailScan received, calling handler...
[ARGUS Email] Logging email scan to database: {...}
[ARGUS Email] Sending payload: {...}
[ARGUS Email] Response status: 200 OK
[ARGUS Email] Successfully logged to database: {...}
[ARGUS BG] logEmailScan handler completed: {...}
```

**If you DON'T see these logs**, the background script isn't running properly.

### 3. Check Next.js Terminal
You should see:
```
[ARGUS Email] Received pre-computed analysis from extension
[ARGUS Email Log] Starting log process...
[ARGUS Email Log] MongoDB connected successfully
[ARGUS Email Log] Successfully created log entry with ID: <id>
```

### 4. Verify Database
```bash
curl http://localhost:3000/api/email-logs
```

Should show the Gmail detections.

## If Service Worker Shows No Logs

The background script might not be handling the message. Check for:
1. JavaScript errors in service worker console
2. Extension permissions issues
3. Service worker crashed/inactive

## Manual Test of Full Flow

Test the API directly:
```bash
curl -X POST http://localhost:3000/api/analyze-email \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "mongodb-atlas@mongodb.com",
    "subject": "The difference between a $30k dev and a $150k dev",
    "verdict": "SUSPICIOUS",
    "score": 55,
    "reason": "Contains @ URL obfuscation pattern",
    "signals": ["8 links found", "1 suspicious link(s)", "1 phishing keyword(s)"]
  }'
```

Then check:
```bash
curl http://localhost:3000/api/email-logs
```

## Dashboard Refresh

After logs are in database, refresh the dashboard:
```
http://localhost:3000/dashboard
```

The "Security Analytics" tab should show the email detections.

## Most Likely Issue

The service worker is not executing `handleLogEmailScan` function. This could be because:
1. The service worker crashed
2. There's a JavaScript error preventing execution
3. The message listener isn't properly registered

**Solution:** Check the service worker console for errors!

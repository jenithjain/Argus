# Testing URL Blocking Feature

## IMPORTANT: Reload the Extension First!

After the code changes, you MUST reload the extension:

1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Find the ARGUS extension
4. Click the **reload icon** (circular arrow) on the extension card
5. This ensures all new files (analyzing-script.js, blocked-script.js) are loaded

## How It Works

When you navigate to any URL:
1. Extension shows "Analyzing URL Safety" page immediately
2. Background script performs AI-powered threat analysis (1-3 seconds)
3. **If safe**: Auto-redirects to the actual website
4. **If malicious**: Shows blocked page with threat details

## Test URLs

### Safe URLs (should redirect automatically)
- https://google.com
- https://github.com
- https://wikipedia.org

### Suspicious URLs (should show blocked page)
Try creating test URLs with these patterns:
- `http://secure-paypal-login-verification.ru/`
- `http://192.168.1.1/login-verify-account/`
- `http://amaz0n-security-alert.tk/`

## Debugging

Open browser console (F12) on the analyzing page to see logs:
- `[ARGUS Analyzing] Page loaded for URL:` - Page initialized
- `[ARGUS Analyzing] Received message:` - Got result from background
- `[ARGUS Analyzing] Analysis complete:` - Processing result
- `[ARGUS Analyzing] Timeout reached` - 10-second timeout triggered

## Notes
- Common safe domains skip analysis entirely for better UX
- 10-second timeout ensures you're never stuck
- Extension badge shows "!" for blocked threats

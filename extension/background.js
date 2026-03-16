// ARGUS v2 — Background Service Worker
// Handles: deepfake detection, URL scanning (Gemini AI), email phishing alerts, context engine
'use strict';

console.log('[ARGUS BG] ========================================');
console.log('[ARGUS BG] Background service worker STARTING...');
console.log('[ARGUS BG] ========================================');

const DEFAULT_BACKEND    = 'http://localhost:5000';
const GEMINI_PROXY_URL   = 'http://localhost:3000/api'; // Next.js backend proxies Gemini
const BLOCKED_PAGE       = chrome.runtime.getURL('blocked.html');
const ANALYZING_PAGE     = chrome.runtime.getURL('analyzing.html');

console.log('[ARGUS BG] Constants initialized');
console.log('[ARGUS BG] GEMINI_PROXY_URL:', GEMINI_PROXY_URL);

let activeDetectionTabId = null;
const autoStartCooldownByTab = new Map();
const manuallyStoppedTabs = new Set();

// ─── RBAC: Cached user ID from the Next.js session ──────────────────────────
let _cachedUserId = null;
let _userIdFetchedAt = 0;
const USER_ID_CACHE_MS = 5 * 60 * 1000; // re-fetch every 5 min

async function getUserId() {
  if (_cachedUserId && Date.now() - _userIdFetchedAt < USER_ID_CACHE_MS) {
    return _cachedUserId;
  }
  try {
    const resp = await fetch('http://localhost:3000/api/auth/session', {
      credentials: 'include',
    });
    if (resp.ok) {
      const session = await resp.json();
      _cachedUserId = session?.user?.id || null;
      _userIdFetchedAt = Date.now();
    }
  } catch {
    // session endpoint unreachable — keep cached value
  }
  return _cachedUserId;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normUrl(url) {
  return (url || DEFAULT_BACKEND).trim().replace(/\/$/, '');
}

function dataURLtoBlob(dataURL) {
  const parts  = dataURL.split(',');
  const mime   = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const array  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

// ─── URL Lexical Pre-filter (no API call) ───────────────────────────────────

const SUSPICIOUS_KEYWORDS = [
  'login','signin','verify','secure','account','update','confirm','paypal',
  'amazon','google','apple','microsoft','netflix','bank','password','credential',
  'suspend','urgent','alert','limited','unusual','activity','suspended','validate'
];
const MALICIOUS_TLDS = ['.tk','.ml','.ga','.cf','.gq','.xyz','.top','.click','.download','.link'];

function lexicalScore(urlStr) {
  try {
    const u    = new URL(urlStr);
    let score  = 0;
    const host = u.hostname.toLowerCase();
    const full = urlStr.toLowerCase();

    // IP address instead of domain
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) score += 40;
    // Excessive subdomains
    if (host.split('.').length > 4) score += 20;
    // Suspicious TLD
    if (MALICIOUS_TLDS.some(t => host.endsWith(t))) score += 25;
    // Suspicious keywords in host
    const kwHits = SUSPICIOUS_KEYWORDS.filter(k => host.includes(k)).length;
    score += kwHits * 12;
    // @ in URL (classic trick)
    if (full.includes('@')) score += 30;
    // Excessive hyphens
    const hyphens = (host.match(/-/g) || []).length;
    if (hyphens > 3) score += 15;
    // Very long URL
    if (urlStr.length > 100) score += 10;
    if (urlStr.length > 200) score += 15;
    // Double dots / path tricks
    if (full.includes('//') && full.indexOf('//') !== full.lastIndexOf('//')) score += 20;
    // Punycode / xn-- (homograph attack)
    if (host.includes('xn--')) score += 35;
    // Port in URL (unusual for regular sites)
    if (u.port && !['80','443',''].includes(u.port)) score += 15;

    return Math.min(score, 100);
  } catch {
    return 0;
  }
}

function lexicalReason(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const reasons = [];

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) reasons.push('Uses raw IP address instead of a trusted domain');
    if (host.includes('xn--')) reasons.push('Contains punycode (possible homograph attack)');
    if (MALICIOUS_TLDS.some(t => host.endsWith(t))) reasons.push('Uses a high-risk top-level domain');
    if (urlStr.includes('@')) reasons.push('Contains @ URL obfuscation pattern');
    if (host.split('.').length > 4) reasons.push('Excessive subdomains indicate possible impersonation');

    const kwHits = SUSPICIOUS_KEYWORDS.filter(k => host.includes(k));
    if (kwHits.length > 0) reasons.push(`Suspicious domain keywords: ${kwHits.slice(0, 3).join(', ')}`);

    return reasons[0] || 'High-risk lexical patterns detected';
  } catch {
    return 'High-risk lexical patterns detected';
  }
}

function buildBlockedPageUrl(targetUrl, reason, score) {
  return `${BLOCKED_PAGE}?url=${encodeURIComponent(targetUrl)}&reason=${encodeURIComponent(reason || 'Malicious URL detected')}&score=${Math.max(0, Math.min(score || 0, 100))}`;
}

function needsScanning(urlStr) {
  try {
    const u = new URL(urlStr);
    const hostname = u.hostname.toLowerCase();
    
    // Skip localhost and common safe domains
    const SKIP_DOMAINS = [
      'localhost', '127.0.0.1',
      'google.com', 'googleapis.com', 'gstatic.com', 'youtube.com',
      'microsoft.com', 'windows.com', 'office.com', 'azure.com', 'live.com',
      'github.com', 'githubusercontent.com',
      'cloudflare.com', 'amazon.com', 'amazonaws.com',
      'apple.com', 'icloud.com',
      'mozilla.org', 'firefox.com',
      'wikipedia.org', 'wikimedia.org',
    ];
    
    if (SKIP_DOMAINS.some(safe => hostname === safe || hostname.endsWith('.' + safe))) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Helper to safely check if tab exists before sending messages
async function tabExists(tabId) {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

// Helper to safely send message to tab
async function sendMessageToTab(tabId, message) {
  try {
    const exists = await tabExists(tabId);
    if (!exists) return false;
    
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

function blockNow(tabId, targetUrl, reason, score) {
  const blockedUrl = buildBlockedPageUrl(targetUrl, reason, score);
  chrome.tabs.stop(tabId).catch(() => {});
  chrome.tabs.update(tabId, { url: blockedUrl });
  chrome.action.setBadgeText({ text: '!', tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
}

function getImmediateLexicalBlock(urlStr) {
  const score = lexicalScore(urlStr);
  if (score >= 70) {
    return {
      verdict: 'HIGH_RISK',
      score,
      reason: lexicalReason(urlStr),
      url: urlStr,
      source: 'lexical-preblock',
    };
  }
  return null;
}

// ─── Gemini URL Analysis ────────────────────────────────────────────────────

async function analyzeUrlWithGemini(urlStr) {
  try {
    const userId = await getUserId();
    const resp = await fetch(`${GEMINI_PROXY_URL}/analyze-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlStr, userId }),
    });
    if (!resp.ok) throw new Error(`Proxy error: ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn('[ARGUS URL] Gemini proxy failed:', err.message);
    return null;
  }
}

async function scanUrl(urlStr) {
  // Skip chrome:// and extension pages
  if (!urlStr || urlStr.startsWith('chrome://') || urlStr.startsWith('chrome-extension://') ||
      urlStr.startsWith('about:') || urlStr.startsWith('data:')) {
    return null;
  }

  const lexScore = lexicalScore(urlStr);

  // Low suspicion: clear
  if (lexScore < 20) {
    return { verdict: 'CLEAR', score: lexScore, url: urlStr, source: 'lexical' };
  }

  // Medium or high: call Gemini
  const geminiResult = await analyzeUrlWithGemini(urlStr);
  if (geminiResult) {
    return {
      verdict:  geminiResult.verdict,
      score:    geminiResult.score,
      reason:   geminiResult.reason,
      url:      urlStr,
      source:   'gemini',
    };
  }

  // Fallback: return lexical result
  const verdict = lexScore >= 60 ? 'HIGH_RISK' : lexScore >= 35 ? 'SUSPICIOUS' : 'CLEAR';
  return { verdict, score: lexScore, url: urlStr, source: 'lexical' };
}

// ─── Navigation Interceptor ─────────────────────────────────────────────────

// Tracks URLs being scanned to avoid double-processing
const pendingScans = new Map(); // url -> { tabId, timestamp, result }
const analyzingTabs = new Map(); // tabId -> { targetUrl, startTime }

// Store analysis results temporarily
const analysisResults = new Map(); // url -> result

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only
  const url = details.url;
  
  // Skip internal pages
  if (!url || url.startsWith('chrome') || url.startsWith('about:') || url.startsWith('data:')) return;
  
  // Skip our own analyzing and blocked pages
  if (url.startsWith(ANALYZING_PAGE) || url.startsWith(BLOCKED_PAGE)) return;

  // Check if this URL needs scanning (skip common safe domains)
  const shouldScan = needsScanning(url);
  if (!shouldScan) return;

  // Check if we already have a result for this URL
  if (analysisResults.has(url)) {
    const result = analysisResults.get(url);
    if (result.verdict === 'HIGH_RISK' || result.verdict === 'MALICIOUS') {
      // Block it
      blockNow(details.tabId, url, result.reason || 'Malicious URL detected', result.score || 0);
      return;
    }
    // Otherwise allow navigation
    return;
  }

  // Show analyzing page immediately
  const analyzingUrl = `${ANALYZING_PAGE}?url=${encodeURIComponent(url)}&tabId=${details.tabId}`;
  analyzingTabs.set(details.tabId, { targetUrl: url, startTime: Date.now() });
  
  // Perform analysis FIRST, then decide
  if (!pendingScans.has(url)) {
    pendingScans.set(url, { tabId: details.tabId, timestamp: Date.now() });
    
    // Start analysis immediately (don't await - let it run in background)
    (async () => {
      try {
        // Wait a bit for analyzing page to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check immediate lexical threats
        const immediate = getImmediateLexicalBlock(url);
        if (immediate) {
          analysisResults.set(url, immediate);
          chrome.runtime.sendMessage({ action: 'urlScanResult', result: immediate }).catch(() => {});
          
          // If tab exists and is on analyzing page, send result
          const exists = await tabExists(details.tabId);
          if (exists) {
            chrome.tabs.get(details.tabId).then((tab) => {
              if (tab && tab.url && tab.url.startsWith(ANALYZING_PAGE)) {
                sendMessageToTab(details.tabId, {
                  action: 'analysisComplete',
                  tabId: details.tabId.toString(),
                  result: immediate
                });
              }
            }).catch(() => {});
            
            chrome.action.setBadgeText({ text: '!', tabId: details.tabId }).catch(() => {});
            chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: details.tabId }).catch(() => {});
          }
          
          chrome.notifications.create({
            type:    'basic',
            iconUrl: 'icons/icon48.png',
            title:   'ARGUS — Malicious URL Blocked',
            message: `Blocked: ${url.slice(0, 80)}`,
          }).catch(() => {});
          return;
        }

        // Perform full scan
        const result = await scanUrl(url);
        if (result) {
          analysisResults.set(url, result);
          chrome.runtime.sendMessage({ action: 'urlScanResult', result }).catch(() => {});

          // If tab exists and is on analyzing page, send result
          const exists = await tabExists(details.tabId);
          if (exists) {
            chrome.tabs.get(details.tabId).then((tab) => {
              if (tab && tab.url && tab.url.startsWith(ANALYZING_PAGE)) {
                sendMessageToTab(details.tabId, {
                  action: 'analysisComplete',
                  tabId: details.tabId.toString(),
                  result: result
                });
              }
            }).catch(() => {});

            // Update badge
            if (result.verdict === 'HIGH_RISK' || result.verdict === 'MALICIOUS') {
              chrome.action.setBadgeText({ text: '!', tabId: details.tabId }).catch(() => {});
              chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: details.tabId }).catch(() => {});
              
              chrome.notifications.create({
                type:    'basic',
                iconUrl: 'icons/icon48.png',
                title:   'ARGUS — Malicious URL Blocked',
                message: `Blocked: ${url.slice(0, 80)}`,
              }).catch(() => {});
            } else if (result.verdict === 'SUSPICIOUS') {
              chrome.action.setBadgeText({ text: '?', tabId: details.tabId }).catch(() => {});
              chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId: details.tabId }).catch(() => {});
            } else {
              chrome.action.setBadgeText({ text: '', tabId: details.tabId }).catch(() => {});
            }
          }
        }
      } finally {
        setTimeout(() => {
          pendingScans.delete(url);
          analysisResults.delete(url); // Clean up after 30 seconds
        }, 30000);
      }
    })();
  }

  // Redirect to analyzing page
  chrome.tabs.update(details.tabId, { url: analyzingUrl });
});

// Also scan on tab update (for history-push SPAs)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    manuallyStoppedTabs.delete(tabId);
  }

  // Don't interfere with analyzing or blocked pages
  if (changeInfo.url && (changeInfo.url.startsWith(ANALYZING_PAGE) || changeInfo.url.startsWith(BLOCKED_PAGE))) {
    return;
  }

  if (changeInfo.status !== 'loading' || !changeInfo.url) return;
  const url = changeInfo.url;
  
  // Skip internal pages
  if (!url || url.startsWith('chrome') || url.startsWith('about:') || url.startsWith('data:')) return;

  // Check if this URL needs scanning
  const shouldScan = needsScanning(url);
  if (!shouldScan) return;

  // If already analyzing or have result, skip
  if (analyzingTabs.has(tabId) || analysisResults.has(url)) return;

  // This is a new navigation - trigger the same flow
  const analyzingUrl = `${ANALYZING_PAGE}?url=${encodeURIComponent(url)}&tabId=${tabId}`;
  analyzingTabs.set(tabId, { targetUrl: url, startTime: Date.now() });

  if (!pendingScans.has(url)) {
    pendingScans.set(url, { tabId, timestamp: Date.now() });
    
    (async () => {
      try {
        const immediate = getImmediateLexicalBlock(url);
        if (immediate) {
          analysisResults.set(url, immediate);
          chrome.runtime.sendMessage({ action: 'urlScanResult', result: immediate }).catch(() => {});
          
          const exists = await tabExists(tabId);
          if (exists) {
            chrome.tabs.get(tabId).then((tab) => {
              if (tab && tab.url && tab.url.startsWith(ANALYZING_PAGE)) {
                sendMessageToTab(tabId, {
                  action: 'analysisComplete',
                  tabId: tabId.toString(),
                  result: immediate
                });
              }
            }).catch(() => {});
            
            chrome.action.setBadgeText({ text: '!', tabId }).catch(() => {});
            chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId }).catch(() => {});
          }
          return;
        }

        const result = await scanUrl(url);
        if (result) {
          analysisResults.set(url, result);
          chrome.runtime.sendMessage({ action: 'urlScanResult', result }).catch(() => {});

          const exists = await tabExists(tabId);
          if (exists) {
            chrome.tabs.get(tabId).then((tab) => {
              if (tab && tab.url && tab.url.startsWith(ANALYZING_PAGE)) {
                sendMessageToTab(tabId, {
                  action: 'analysisComplete',
                  tabId: tabId.toString(),
                  result: result
                });
              }
            }).catch(() => {});

            if (result.verdict === 'HIGH_RISK' || result.verdict === 'MALICIOUS') {
              chrome.action.setBadgeText({ text: '!', tabId }).catch(() => {});
              chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId }).catch(() => {});
            } else if (result.verdict === 'SUSPICIOUS') {
              chrome.action.setBadgeText({ text: '?', tabId }).catch(() => {});
              chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId }).catch(() => {});
            } else {
              chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
            }
          }
        }
      } finally {
        setTimeout(() => {
          pendingScans.delete(url);
          analysisResults.delete(url);
        }, 30000);
      }
    })();
  }

  chrome.tabs.update(tabId, { url: analyzingUrl });
});

// Auto-start deepfake detection when a tab fully loads and has video content
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab?.url) return;
  if (manuallyStoppedTabs.has(tabId)) return;
  if (activeDetectionTabId === tabId) return;
  if (tab.url.startsWith(BLOCKED_PAGE) || tab.url.startsWith(ANALYZING_PAGE) || 
      tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('data:')) return;

  maybeAutoStartDeepfake(tabId);
});

function canAttemptAutoStart(tabId) {
  const now = Date.now();
  const last = autoStartCooldownByTab.get(tabId) || 0;
  if (now - last < 10000) return false;
  autoStartCooldownByTab.set(tabId, now);
  return true;
}

function hasVideoInTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'hasVideoElement' }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(resp?.hasVideo));
    });
  });
}

async function maybeAutoStartDeepfake(tabId) {
  if (!canAttemptAutoStart(tabId)) return;

  try {
    const hasVideo = await hasVideoInTab(tabId);
    if (!hasVideo) return;

    await new Promise((resolve) => {
      handleStartDetection(tabId, async (resp) => {
        if (resp?.success) {
          chrome.runtime.sendMessage({ action: 'deepfakeAutoStarted', tabId }).catch(() => {});
        }
        resolve();
      });
    });
  } catch (error) {
    console.warn('[ARGUS DF] Auto-start failed:', error?.message || error);
  }
}

// ─── Message Router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ARGUS BG] Received message:', message.action, 'from tab:', sender?.tab?.id);
  
  switch (message.action) {
    case 'startDetection':
      handleStartDetection(message.tabId, sendResponse);
      return true;
    case 'stopDetection':
      if (activeDetectionTabId) manuallyStoppedTabs.add(activeDetectionTabId);
      handleStopDetection(sendResponse);
      return true;
    case 'analyzeFrame':
      handleAnalyzeFrame(message.imageData, sendResponse);
      return true;
    case 'captureVisibleTab':
      handleCaptureVisibleTab(sender.tab.id, sendResponse);
      return true;
    case 'resetBackend':
      handleResetBackend(sendResponse);
      return true;
    case 'scanUrl':
      scanUrl(message.url).then(result => sendResponse(result || {}));
      return true;
    case 'getAnalysisResult':
      // Check if we have a cached result for this URL
      if (message.url && analysisResults.has(message.url)) {
        const result = analysisResults.get(message.url);
        sendResponse({ hasResult: true, result });
      } else {
        sendResponse({ hasResult: false });
      }
      return true;
    case 'detectionResult':
      chrome.runtime.sendMessage(message).catch(() => {});
      break;
    case 'detectionError':
      chrome.runtime.sendMessage(message).catch(() => {});
      break;
    case 'detectionStopped':
      activeDetectionTabId = null;
      chrome.storage.local.set({ isDetecting: false });
      chrome.runtime.sendMessage(message).catch(() => {});
      break;
    case 'emailScanResult':
      // Persist result so popup can read it even if it wasn't open at scan time
      if (sender?.tab?.id) {
        chrome.storage.local.set({ [`emailScanResult_${sender.tab.id}`]: message.result });
      }
      // Forward to popup (if open)
      chrome.runtime.sendMessage(message).catch(() => {});
      break;
    case 'logEmailScan':
      console.log('[ARGUS BG] logEmailScan received, calling handler...');
      // Content script cannot fetch localhost — handle logging here in the SW
      handleLogEmailScan(message).then(result => {
        console.log('[ARGUS BG] logEmailScan handler completed:', result);
        sendResponse({ ok: true, result });
      }).catch(err => {
        console.error('[ARGUS BG] logEmailScan handler failed:', err.message);
        sendResponse({ ok: false, error: err.message });
      });
      return true;
    case 'sendInteraction':
      // content-interaction-tracker.js routes through here to avoid CORS loopback block
      handleSendInteraction(message.data).catch(err =>
        console.warn('[ARGUS Interaction] send failed:', err.message)
      );
      sendResponse({ ok: true });
      return true;
    case 'videoPlaybackDetected':
      if (sender?.tab?.id && !manuallyStoppedTabs.has(sender.tab.id) && activeDetectionTabId !== sender.tab.id) {
        maybeAutoStartDeepfake(sender.tab.id);
      }
      sendResponse({ success: true });
      return true;
  }
});

// ─── Deepfake Frame Analysis ─────────────────────────────────────────────────

async function handleCaptureVisibleTab(tabId, sendResponse) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'jpeg',
      quality: 85
    });
    sendResponse({ success: true, dataUrl });
  } catch (error) {
    console.error('[ARGUS DF] Capture visible tab failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleAnalyzeFrame(imageDataUrl, sendResponse) {
  try {
    const settings    = await chrome.storage.local.get(['backendUrl']);
    const backendUrl  = normUrl(settings.backendUrl);
    const blob        = dataURLtoBlob(imageDataUrl);
    const formData    = new FormData();
    formData.append('frame', blob, 'frame.png');

    const controller  = new AbortController();
    const timeoutId   = setTimeout(() => controller.abort(), 10000);
    const response    = await fetch(`${backendUrl}/analyze`, {
      method: 'POST',
      body:   formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Backend ${response.status}`);
    }

    const data = await response.json();
    sendResponse(data);

    // Forward to ARGUS dashboard with userId for RBAC
    try {
      const userId = await getUserId();
      await fetch('http://localhost:3000/api/ingest-result', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...data, userId }),
      });
    } catch { /* silent */ }

  } catch (error) {
    console.error('[ARGUS DF] Frame analysis failed:', error);
    sendResponse({ error: error.message || 'Analysis failed' });
  }
}

// ─── Backend Reset ────────────────────────────────────────────────────────────

async function handleResetBackend(sendResponse) {
  try {
    const settings   = await chrome.storage.local.get(['backendUrl']);
    const backendUrl = normUrl(settings.backendUrl);
    await fetch(`${backendUrl}/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ─── Deepfake Detection Start/Stop ───────────────────────────────────────────

async function handleStartDetection(tabId, sendResponse) {
  try {
    const settings      = await chrome.storage.local.get(['backendUrl', 'captureInterval']);
    const backendUrl    = normUrl(settings.backendUrl);
    const captureInterval = settings.captureInterval || 1000;

    // Health check
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 5000);
      let response;
      try {
        response = await fetch(`${backendUrl}/health`, { signal: controller.signal });
      } catch (e) {
        if (backendUrl.includes('localhost')) {
          const fallback = backendUrl.replace('localhost', '127.0.0.1');
          response = await fetch(`${fallback}/health`, { signal: controller.signal });
          await chrome.storage.local.set({ backendUrl: fallback });
        } else { throw e; }
      }
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Backend not responding');
    } catch (error) {
      sendResponse({ success: false, error: 'Backend server not available. Start the backend first.\n' + error.message });
      return;
    }

    // Inject content script
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch (e) {
      console.warn('[ARGUS DF] Content script injection (may already be loaded):', e.message);
    }

    await new Promise(r => setTimeout(r, 500));

    chrome.tabs.sendMessage(tabId, { action: 'startDetection', interval: captureInterval }, (resp) => {
      if (chrome.runtime.lastError || !resp?.success) {
        sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Content script failed to start' });
      } else {
        activeDetectionTabId = tabId;
        chrome.storage.local.set({ isDetecting: true });
        sendResponse({ success: true });
      }
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

function handleStopDetection(sendResponse) {
  if (activeDetectionTabId) {
    chrome.tabs.sendMessage(activeDetectionTabId, { action: 'stopDetection' }, () => {
      activeDetectionTabId = null;
      chrome.storage.local.set({ isDetecting: false });
      sendResponse({ success: true });
    });
  } else {
    chrome.storage.local.set({ isDetecting: false });
    sendResponse({ success: true });
  }
}

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeDetectionTabId) {
    activeDetectionTabId = null;
    chrome.storage.local.set({ isDetecting: false });
  }
  autoStartCooldownByTab.delete(tabId);
  manuallyStoppedTabs.delete(tabId);
  analyzingTabs.delete(tabId);
});

// ─── Email Scan Logger ────────────────────────────────────────────────────────
// Background SW can reach localhost; content scripts cannot (Chrome CORS policy).

async function handleLogEmailScan({ sender, subject, verdict, score, reason, signals, links }) {
  try {
    console.log('[ARGUS Email] Logging email scan to database:', { sender, subject, verdict, score, reason });
    
    const payload = { 
      sender: String(sender || 'Unknown').slice(0, 200), 
      subject: String(subject || 'No Subject').slice(0, 300), 
      verdict: String(verdict || 'CLEAR'), 
      score: Number(score) || 0, 
      reason: String(reason || 'No reason provided').slice(0, 300), 
      signals: Array.isArray(signals) ? signals : [],
      links: Array.isArray(links) ? links : []
    };
    
    console.log('[ARGUS Email] Sending payload:', JSON.stringify(payload, null, 2));
    
    const userId = await getUserId();
    const response = await fetch(`${GEMINI_PROXY_URL}/analyze-email`, {
      method:  'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ ...payload, userId }),
    });
    
    console.log('[ARGUS Email] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ARGUS Email] API error response:', errorText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[ARGUS Email] Successfully logged to database:', result);
    return result;
  } catch (err) {
    console.error('[ARGUS Email] Failed to log email scan:', err.message);
    console.error('[ARGUS Email] Error stack:', err.stack);
    throw err;
  }
}

// ─── Interaction Proxy ────────────────────────────────────────────────────────
// Proxies POST /api/interaction on behalf of content scripts (loopback CORS fix)

async function handleSendInteraction(data) {
  try {
    await fetch(`${GEMINI_PROXY_URL}/interaction`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
  } catch (err) {
    console.warn('[ARGUS Interaction] Could not POST /api/interaction:', err.message);
  }
}

console.log('[ARGUS] Background service worker v2 loaded — URL scanner, deepfake, email shield active');

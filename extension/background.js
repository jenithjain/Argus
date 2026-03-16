// ARGUS v2 — Background Service Worker
// Handles: deepfake detection, URL scanning (Gemini AI), email phishing alerts, context engine
'use strict';

const DEFAULT_BACKEND    = 'http://localhost:5000';
const GEMINI_PROXY_URL   = 'http://localhost:3000/api'; // Next.js backend proxies Gemini
const BLOCKED_PAGE       = chrome.runtime.getURL('blocked.html');

let activeDetectionTabId = null;
const autoStartCooldownByTab = new Map();
const manuallyStoppedTabs = new Set();

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
    const resp = await fetch(`${GEMINI_PROXY_URL}/analyze-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlStr }),
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
const pendingScans = new Set();

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only
  const url = details.url;
  if (!url || url.startsWith('chrome') || url.startsWith('about:') || url.startsWith('data:')) return;

  const immediate = getImmediateLexicalBlock(url);
  if (immediate) {
    chrome.runtime.sendMessage({ action: 'urlScanResult', result: immediate }).catch(() => {});
    blockNow(details.tabId, url, immediate.reason, immediate.score);
    return;
  }

  if (pendingScans.has(url)) return;
  pendingScans.add(url);

  try {
    const result = await scanUrl(url);
    if (!result) return;

    // Notify popup
    chrome.runtime.sendMessage({ action: 'urlScanResult', result }).catch(() => {});

    // Badge
    if (result.verdict === 'HIGH_RISK' || result.verdict === 'MALICIOUS') {
      chrome.action.setBadgeText({ text: '!', tabId: details.tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId: details.tabId });
    } else if (result.verdict === 'SUSPICIOUS') {
      chrome.action.setBadgeText({ text: '?', tabId: details.tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId: details.tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId: details.tabId });
    }

    // Block malicious URLs — redirect to blocked page
    if (result.verdict === 'HIGH_RISK' || result.verdict === 'MALICIOUS') {
      blockNow(details.tabId, url, result.reason || 'Malicious URL detected', result.score || 0);

      chrome.notifications.create({
        type:    'basic',
        iconUrl: 'icons/icon48.png',
        title:   'ARGUS — Malicious URL Blocked',
        message: `Blocked: ${url.slice(0, 80)}`,
      });
    }
  } finally {
    setTimeout(() => pendingScans.delete(url), 5000);
  }
});

// Also scan on tab update (for history-push SPAs)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    manuallyStoppedTabs.delete(tabId);
  }

  if (changeInfo.status !== 'loading' || !changeInfo.url) return;
  const url = changeInfo.url;
  if (!url || url.startsWith('chrome') || url.startsWith('about:') || url.startsWith('data:')) return;

  const immediate = getImmediateLexicalBlock(url);
  if (immediate) {
    chrome.runtime.sendMessage({ action: 'urlScanResult', result: immediate }).catch(() => {});
    blockNow(tabId, url, immediate.reason, immediate.score);
    return;
  }

  if (pendingScans.has(url)) return;
  pendingScans.add(url);

  try {
    const result = await scanUrl(url);
    if (!result) return;
    chrome.runtime.sendMessage({ action: 'urlScanResult', result }).catch(() => {});

    if (result.verdict === 'HIGH_RISK' || result.verdict === 'MALICIOUS') {
      chrome.action.setBadgeText({ text: '!', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
      blockNow(tabId, url, result.reason || 'Malicious URL detected', result.score || 0);
    } else if (result.verdict === 'SUSPICIOUS') {
      chrome.action.setBadgeText({ text: '?', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  } finally {
    setTimeout(() => pendingScans.delete(url), 5000);
  }
});

// Auto-start deepfake detection when a tab fully loads and has video content
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab?.url) return;
  if (manuallyStoppedTabs.has(tabId)) return;
  if (activeDetectionTabId === tabId) return;
  if (tab.url.startsWith(BLOCKED_PAGE) || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('data:')) return;

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
    case 'resetBackend':
      handleResetBackend(sendResponse);
      return true;
    case 'scanUrl':
      scanUrl(message.url).then(result => sendResponse(result || {}));
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
    case 'videoPlaybackDetected':
      if (sender?.tab?.id && !manuallyStoppedTabs.has(sender.tab.id) && activeDetectionTabId !== sender.tab.id) {
        maybeAutoStartDeepfake(sender.tab.id);
      }
      sendResponse({ success: true });
      return true;
  }
});

// ─── Deepfake Frame Analysis ─────────────────────────────────────────────────

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

    // Forward to ARGUS dashboard
    try {
      await fetch('http://localhost:3000/api/ingest-result', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
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
});

console.log('[ARGUS] Background service worker v2 loaded — URL scanner, deepfake, email shield active');

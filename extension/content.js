// Content script for capturing tab content and displaying overlay
// ARGUS v2 Content Script — deepfake capture + email scanning + inline URL badges
'use strict';

console.log('[ARGUS] Content script v2 loaded —', window.location.href);

// ─── Guard against double-injection ──────────────────────────────────────────
if (window.__argusLoaded) {
  // Already loaded, skip
} else {
window.__argusLoaded = true;

// ─── State ───────────────────────────────────────────────────────────────────
if (!window.__argusState) {
  window.__argusState = {
    overlayIframe:  null,
    captureInterval: null,
    isCapturing:    false,
    emailObserver:  null,
    scannedLinks:   new WeakSet(),
    emailScanned:   false,
  };
}
const state = window.__argusState;

// ─── Context Detection ────────────────────────────────────────────────────────
const pageUrl = window.location.href;
const isGmail   = /mail\.google\.com/.test(pageUrl);
const isOutlook = /outlook\.(com|live|office)/.test(pageUrl);
const isMailClient = isGmail || isOutlook;

// ─── Email Scanning ───────────────────────────────────────────────────────────

const PHISHING_KEYWORDS = [
  'verify your account','confirm your identity','unusual activity','your account will be',
  'suspended','click here to verify','update your payment','limited time','act now',
  'your password','reset your password','login attempt','unauthorized access',
  'dear customer','dear user','dear member','validate your','urgent action',
  'account locked','security alert','you have been selected','claim your prize',
  'won a','free gift','limited offer','expires today','expires in 24',
  'wire transfer','gift card','bitcoin','crypto','your account has been',
  'sign in to restore','immediate action','one-time password','otp',
];

// ── Inline lexical URL scorer (mirrors background.js — no round-trip needed) ──
const _EMAIL_SUSP_KEYWORDS = [
  'login','signin','verify','secure','account','update','confirm','paypal',
  'amazon','google','apple','microsoft','netflix','bank','password','credential',
  'suspend','urgent','alert','limited','unusual','activity','suspended','validate',
];
const _EMAIL_BAD_TLDS = ['.tk','.ml','.ga','.cf','.gq','.xyz','.top','.click','.download','.link'];

function _lexScore(urlStr) {
  try {
    const u    = new URL(urlStr);
    let score  = 0;
    const host = u.hostname.toLowerCase();
    const full = urlStr.toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) score += 40;
    if (host.split('.').length > 4) score += 20;
    if (_EMAIL_BAD_TLDS.some(t => host.endsWith(t))) score += 25;
    score += _EMAIL_SUSP_KEYWORDS.filter(k => host.includes(k)).length * 12;
    if (full.includes('@')) score += 30;
    if ((host.match(/-/g) || []).length > 3) score += 15;
    if (urlStr.length > 100) score += 10;
    if (urlStr.length > 200) score += 15;
    if (full.includes('//') && full.indexOf('//') !== full.lastIndexOf('//')) score += 20;
    if (host.includes('xn--')) score += 35;
    if (u.port && !['80','443',''].includes(u.port)) score += 15;
    return Math.min(score, 100);
  } catch { return 0; }
}

function _lexVerdict(score) {
  if (score >= 60) return 'HIGH_RISK';
  if (score >= 30) return 'SUSPICIOUS';
  return 'CLEAR';
}

function _lexReason(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'Uses raw IP address instead of a trusted domain';
    if (host.includes('xn--')) return 'Contains punycode (possible homograph attack)';
    if (_EMAIL_BAD_TLDS.some(t => host.endsWith(t))) return 'Uses a high-risk top-level domain';
    if (urlStr.includes('@')) return 'Contains @ URL obfuscation pattern';
    if (host.split('.').length > 4) return 'Excessive subdomains indicate possible impersonation';
    const kws = _EMAIL_SUSP_KEYWORDS.filter(k => host.includes(k));
    if (kws.length) return `Suspicious domain keywords: ${kws.slice(0,3).join(', ')}`;
    return 'High-risk lexical patterns detected';
  } catch { return 'High-risk lexical patterns detected'; }
}
// ─────────────────────────────────────────────────────────────────────────────

function extractEmailLinks(rootEl) {
  const anchors = Array.from(rootEl.querySelectorAll('a[href]'));
  return anchors.map(a => ({
    href: a.href,
    text: (a.textContent || '').trim().slice(0, 120),
    el:   a,
  })).filter(l => l.href && (l.href.startsWith('http://') || l.href.startsWith('https://')));
}

function detectPhishingKeywords(text) {
  const lower = text.toLowerCase();
  return PHISHING_KEYWORDS.filter(kw => lower.includes(kw));
}

// Fully synchronous — no network calls, no message round-trips.
// Result is available in < 1ms.
function scanEmailContent(rootEl) {
  const bodyText = (rootEl.innerText || rootEl.textContent || '').slice(0, 8000);
  const links    = extractEmailLinks(rootEl);
  const kwHits   = detectPhishingKeywords(bodyText);

  // Score every link locally using the inline lexical scorer
  const linkResults = links.slice(0, 20).map(link => {
    const score   = _lexScore(link.href);
    const verdict = _lexVerdict(score);
    const reason  = score >= 30 ? _lexReason(link.href) : null;
    return { link, score, verdict, reason };
  });

  const malicious  = linkResults.filter(r => r.verdict === 'HIGH_RISK');
  const suspicious = linkResults.filter(r => r.verdict === 'SUSPICIOUS');
  const threats    = malicious.length + suspicious.length;

  // Keyword-based phishing boost: treat heavy keyword matches as suspicious even
  // when no individual link crosses the threshold.
  const kwThreat = kwHits.length >= 3 ? 1 : 0;
  const totalThreats = threats + kwThreat;

  // Annotate links inline — instant visual feedback
  linkResults.forEach(({ link, verdict }) => {
    if (verdict === 'HIGH_RISK') {
      injectLinkBadge(link.el, 'danger', '⚠ MALICIOUS');
    } else if (verdict === 'SUSPICIOUS') {
      injectLinkBadge(link.el, 'warning', '⚠ SUSPICIOUS');
    }
  });

  // Build human-readable summary
  const topThreat = malicious[0] || suspicious[0];
  let summary = null;
  if (topThreat) {
    summary = `${topThreat.verdict === 'HIGH_RISK' ? '🚨 Malicious' : '⚠ Suspicious'} link: ${topThreat.link.href.slice(0, 80)}`;
    if (topThreat.reason) summary += ` — ${topThreat.reason}`;
  } else if (kwHits.length > 0) {
    summary = `Phishing keywords detected: "${kwHits.slice(0, 3).join('", "')}"`;
  }

  // Report to popup instantly — no await, no delay
  chrome.runtime.sendMessage({
    action: 'emailScanResult',
    result: {
      threats:    totalThreats,
      linksFound: links.length,
      kwHits:     kwHits.length,
      summary,
    },
  });
}

function injectLinkBadge(anchor, level, label) {
  if (anchor.__argusBadged) return;
  anchor.__argusBadged = true;
  const badge = document.createElement('span');
  badge.textContent = ` ${label}`;
  badge.style.cssText = `
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: 4px;
    vertical-align: middle;
    letter-spacing: 0.04em;
    background: ${level === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)'};
    color: ${level === 'danger' ? '#ef4444' : '#f59e0b'};
    border: 1px solid ${level === 'danger' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)'};
    font-family: monospace;
    cursor: default;
  `;
  anchor.insertAdjacentElement('afterend', badge);
}

// Watch for email open in Gmail / Outlook
let _emailDebounceTimer = null;
let _lastEmailFingerprint = '';

function getEmailFingerprint(rootEl) {
  // Use a short slice of the text content as a cheap identity check.
  // If this changes, the user has opened a different email.
  return (rootEl.innerText || rootEl.textContent || '').slice(0, 200).trim();
}

function watchEmailClient() {
  if (!isMailClient) return;

  // Scan immediately if content already loaded
  tryInitialEmailScan();

  // Debounced MutationObserver — fires at most once per 100 ms and only when
  // the email pane content has actually changed (new email opened).
  if (!state.emailObserver) {
    state.emailObserver = new MutationObserver(() => {
      clearTimeout(_emailDebounceTimer);
      _emailDebounceTimer = setTimeout(() => {
        if (!state.emailScanned) {
          tryInitialEmailScan();
        }
      }, 100);
    });
    state.emailObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function tryInitialEmailScan() {
  let emailRoot = null;

  if (isGmail) {
    // Gmail: try the most specific selector first for fastest match
    emailRoot = document.querySelector('.a3s.aiL') ||
                document.querySelector('.a3s') ||
                document.querySelector('[data-message-id]') ||
                document.querySelector('[role="main"]');
  } else if (isOutlook) {
    emailRoot = document.querySelector('[aria-label="Message body"]') ||
                document.querySelector('.ReadingPaneContent') ||
                document.querySelector('[data-app-section="EmailReadingPane"]');
  }

  if (!emailRoot) return;

  // Check if this is actually a new/different email before scanning
  const fingerprint = getEmailFingerprint(emailRoot);
  if (!fingerprint || fingerprint === _lastEmailFingerprint) return;

  if (!state.emailScanned) {
    state.emailScanned = true;
    _lastEmailFingerprint = fingerprint;
    scanEmailContent(emailRoot); // synchronous — result reported instantly
    // Unlock re-scan after 3 s so switching emails triggers a fresh scan quickly
    setTimeout(() => { state.emailScanned = false; }, 3000);
  }
}

// Start email watching
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', watchEmailClient);
} else {
  watchEmailClient();
}

// Create and inject overlay
function createOverlay() {
  if (state.overlayIframe) return;

  state.overlayIframe = document.createElement('iframe');
  state.overlayIframe.id = 'deepfake-detection-overlay';
  state.overlayIframe.src = chrome.runtime.getURL('overlay.html');
  state.overlayIframe.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    width: 360px;
    height: 520px;
    border: none;
    z-index: 999999;
    pointer-events: auto;
    background: transparent;
  `;

  state.overlayIframe.addEventListener('load', () => {
    chrome.storage.local.get(['argusTheme'], (store) => {
      postOverlayTheme(store.argusTheme || 'dark');
    });
  });
  
  document.body.appendChild(state.overlayIframe);
}

function postOverlayTheme(theme) {
  if (!state.overlayIframe || !state.overlayIframe.contentWindow) return;
  state.overlayIframe.contentWindow.postMessage({ type: 'setTheme', theme }, '*');
}

// Remove overlay
function removeOverlay() {
  if (state.overlayIframe) {
    state.overlayIframe.remove();
    state.overlayIframe = null;
  }
}

// Capture current page as image using canvas
async function captureTab() {
  return new Promise((resolve, reject) => {
    try {
      // Find video element on the page (try multiple selectors)
      let video = document.querySelector('video');
      
      // Also check for video inside iframes (e.g., embedded players)
      if (!video) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            video = iframe.contentDocument?.querySelector('video');
            if (video) break;
          } catch (e) {
            // Cross-origin iframe, skip
          }
        }
      }

      if (!video) {
        reject(new Error('No video found on page'));
        return;
      }

      // Check if video is ready
      if (video.readyState < 2) {
        reject(new Error('Video not ready yet'));
        return;
      }

      // Skip ended videos, but allow paused (tab switch may pause video)
      if (video.ended) {
        reject(new Error('Video has ended'));
        return;
      }

      // Create canvas to capture video frame
      const canvas = document.createElement('canvas');
      
      // Use video dimensions, with fallback and cap for performance
      let vw = video.videoWidth || 640;
      let vh = video.videoHeight || 480;
      
      // Cap resolution for faster processing (maintain aspect ratio)
      const maxDim = 720;
      if (vw > maxDim || vh > maxDim) {
        const scale = maxDim / Math.max(vw, vh);
        vw = Math.round(vw * scale);
        vh = Math.round(vh * scale);
      }
      
      canvas.width = vw;
      canvas.height = vh;

      if (canvas.width === 0 || canvas.height === 0) {
        reject(new Error('Video has no dimensions'));
        return;
      }

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to JPEG for smaller payload (faster transfer)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}

// Send frame to backend for analysis via background service worker
// (Content scripts can't fetch localhost due to page CSP restrictions)
async function analyzeFrame(imageDataUrl) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({
        action: 'analyzeFrame',
        imageData: imageDataUrl
      }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (result && result.error) {
          reject(new Error(result.error));
          return;
        }
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Start capturing and analyzing
async function startDetection(interval = 1000) {
  if (state.isCapturing) return;

  state.isCapturing = true;
  createOverlay();

  // Wait for overlay to load, then reset it
  setTimeout(() => {
    resetOverlay(); // Reset overlay to clear old fake probability window
  }, 100);

  // Reset backend state so we start completely fresh (no previous verdict)
  try {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'resetBackend' }, () => {
        if (chrome.runtime.lastError) {
          console.log('Could not reset backend on start:', chrome.runtime.lastError.message);
        } else {
          console.log('Backend detector reset on start');
        }
        resolve();
      });
    });
  } catch (e) {
    console.log('Could not reset backend on start:', e);
  }

  // Update overlay with initial status
  updateOverlay({ status: 'analyzing' });

  // Use recursive setTimeout instead of setInterval — less throttled in background tabs
  async function captureLoop() {
    if (!state.isCapturing) return;
    try {
      // Capture current tab
      const imageDataUrl = await captureTab();

      // Analyze frame
      const result = await analyzeFrame(imageDataUrl);

      // Log results for debugging
      console.log('Analysis result:', JSON.stringify(result, null, 2));

      // Update overlay with results
      updateOverlay(result);

      // Send results to popup (ignore if popup is closed)
      try {
        chrome.runtime.sendMessage({
          action: 'detectionResult',
          data: result
        });
      } catch (e) {
        // Popup might be closed, ignore
      }

    } catch (error) {
      console.error('Detection error:', error);
      
      // Update overlay with error/disconnected state so it doesn't show stale data
      updateOverlay({ 
        status: 'error',
        error_message: error.message 
      });

      // Reset backend so next successful connection starts fresh
      try {
        chrome.runtime.sendMessage({ action: 'resetBackend' }, () => {});
      } catch (e) { /* ignore */ }
      
      // Send error to popup (ignore if popup is closed)
      try {
        chrome.runtime.sendMessage({
          action: 'detectionError',
          error: error.message
        });
      } catch (e) {
        // Popup might be closed, ignore
      }
    }
    // Schedule next capture using setTimeout (survives tab switches better)
    if (state.isCapturing) {
      state.captureTimeout = setTimeout(captureLoop, interval);
    }
  }

  captureLoop();
}

// Stop detection
async function stopDetection() {
  state.isCapturing = false;
  if (state.captureInterval) {
    clearInterval(state.captureInterval);
    state.captureInterval = null;
  }
  if (state.captureTimeout) {
    clearTimeout(state.captureTimeout);
    state.captureTimeout = null;
  }
  removeOverlay();

  // Reset backend detector state via background service worker
  try {
    chrome.runtime.sendMessage({ action: 'resetBackend' }, () => {
      if (chrome.runtime.lastError) {
        console.log('Could not reset backend:', chrome.runtime.lastError.message);
      } else {
        console.log('Backend detector reset');
      }
    });
  } catch (error) {
    console.log('Could not reset backend:', error);
  }

  // Send stopped message (ignore if popup is closed)
  try {
    chrome.runtime.sendMessage({ action: 'detectionStopped' });
  } catch (e) {
    // Popup might be closed, ignore
  }
}

// Update overlay with detection results
function updateOverlay(data) {
  if (!state.overlayIframe) return;

  state.overlayIframe.contentWindow.postMessage({
    type: 'updateResults',
    data: data
  }, '*');
}

// Reset overlay display
function resetOverlay() {
  if (!state.overlayIframe) return;

  state.overlayIframe.contentWindow.postMessage({
    type: 'resetDisplay'
  }, '*');
}

// Listen for messages from background script
if (!window.deepfakeDetectionListenerAdded) {
  window.deepfakeDetectionListenerAdded = true; // keep for compat

  // Auto-start signal: when any video starts playing, ask background to start detection.
  document.addEventListener('play', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLVideoElement)) return;
    if (state.isCapturing) return;
    try {
      chrome.runtime.sendMessage({ action: 'videoPlaybackDetected', url: window.location.href });
    } catch (e) {
      // ignore
    }
  }, true);

  // Keep overlay theme synced when user toggles popup theme.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.argusTheme) return;
    postOverlayTheme(changes.argusTheme.newValue || 'dark');
  });
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message.action);
    
    if (message.action === 'ping') {
      console.log('Ping received - responding ready');
      sendResponse({ success: true, status: 'ready' });
      return false; // Synchronous response
    } 
    
    if (message.action === 'startDetection') {
      console.log('Starting detection with interval:', message.interval);
      const interval = message.interval || 1000;
      startDetection(interval);
      sendResponse({ success: true });
      return false; // Synchronous response
    } 

    if (message.action === 'rescanEmail') {
      // Popup is requesting an instant email re-scan (bypass cooldown)
      if (isMailClient) {
        state.emailScanned = false;
        _lastEmailFingerprint = '';
        tryInitialEmailScan();
      }
      sendResponse({ success: true });
      return false;
    }

    if (message.action === 'hasVideoElement') {
      const hasVideo = Boolean(document.querySelector('video'));
      sendResponse({ success: true, hasVideo });
      return false;
    }
    
    if (message.action === 'stopDetection') {
      console.log('Stopping detection');
      stopDetection();
      sendResponse({ success: true });
      return false; // Synchronous response
    }
    
    return false; // Synchronous response
  });

  // Handle overlay messages
  window.addEventListener('message', (event) => {
    if (event.data.type === 'overlayClose' || event.data.type === 'overlayStop') {
      stopDetection();
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopDetection();
  });
  
  console.log('Deepfake Detection: Message listeners registered');
}

} // end window.__argusLoaded guard

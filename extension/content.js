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
];

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

async function scanEmailContent(rootEl) {
  const bodyText  = (rootEl.innerText || rootEl.textContent || '').slice(0, 8000);
  const links     = extractEmailLinks(rootEl);
  const kwHits    = detectPhishingKeywords(bodyText);

  // Ask background to scan each link
  const scanPromises = links.slice(0, 12).map(link =>
    new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'scanUrl', url: link.href }, result => {
        resolve({ link, result: result || {} });
      });
    })
  );

  const linkResults = await Promise.all(scanPromises);
  const malicious   = linkResults.filter(r => r.result.verdict === 'HIGH_RISK' || r.result.verdict === 'MALICIOUS');
  const suspicious  = linkResults.filter(r => r.result.verdict === 'SUSPICIOUS');
  const threats     = malicious.length + suspicious.length;

  // Annotate links inline
  linkResults.forEach(({ link, result }) => {
    if (result.verdict === 'HIGH_RISK' || result.verdict === 'MALICIOUS') {
      injectLinkBadge(link.el, 'danger', '⚠ MALICIOUS');
    } else if (result.verdict === 'SUSPICIOUS') {
      injectLinkBadge(link.el, 'warning', '? SUSPICIOUS');
    }
  });

  // Report to background → popup
  const topThreat = malicious[0] || suspicious[0];
  chrome.runtime.sendMessage({
    action: 'emailScanResult',
    result: {
      threats,
      linksFound: links.length,
      kwHits:     kwHits.length,
      summary:    topThreat
        ? `Suspicious link detected: ${topThreat.link.href.slice(0, 80)}`
        : kwHits.length > 0
        ? `Phishing keywords detected: "${kwHits[0]}"`
        : null,
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
function watchEmailClient() {
  if (!isMailClient) return;

  // Scan immediately if content already loaded
  tryInitialEmailScan();

  // MutationObserver for dynamically loaded email threads
  if (!state.emailObserver) {
    state.emailObserver = new MutationObserver(() => {
      if (!state.emailScanned) tryInitialEmailScan();
    });
    state.emailObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function tryInitialEmailScan() {
  let emailRoot = null;

  if (isGmail) {
    // Gmail: main reading pane
    emailRoot = document.querySelector('[role="main"]') ||
                document.querySelector('.a3s') ||
                document.querySelector('[data-message-id]');
  } else if (isOutlook) {
    emailRoot = document.querySelector('[aria-label="Message body"]') ||
                document.querySelector('.ReadingPaneContent') ||
                document.querySelector('[data-app-section="EmailReadingPane"]');
  }

  if (emailRoot && !state.emailScanned) {
    state.emailScanned = true;
    scanEmailContent(emailRoot);
    // Re-scan on email change (Gmail loads new emails via AJAX)
    setTimeout(() => { state.emailScanned = false; }, 8000);
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

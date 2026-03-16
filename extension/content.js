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
    lastBackendReset: 0,
    emailCapsule:   null,  // Email warning capsule element
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
function scanEmailContent(rootEl, fingerprint) {
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
  safeSendRuntimeMessage({
    action: 'emailScanResult',
    result: {
      threats:    totalThreats,
      linksFound: links.length,
      kwHits:     kwHits.length,
      summary,
    },
  });

  // Log to ARGUS dashboard via background service worker
  // (Content scripts cannot fetch localhost directly — route through background)
  try {
    if (isDuplicateEmailLog(fingerprint, summary)) {
      return;
    }
    const senderEl   = document.querySelector('[email], [data-hovercard-id], .gD, .go');
    const subjectEl  = document.querySelector('h2[data-thread-perm-id], .hP, [data-legacy-message-id] h2');
    const sender     = (senderEl && (senderEl.getAttribute('email') || senderEl.textContent)) || document.title || 'Unknown Sender';
    const subject    = (subjectEl && subjectEl.textContent) || document.title || 'No Subject';
    const topReason  = malicious[0]?.reason || suspicious[0]?.reason ||
                       (kwHits.length ? `Phishing keywords: ${kwHits.slice(0,3).join(', ')}` : 'No threats detected');
    const topScore   = malicious[0]?.score ?? suspicious[0]?.score ?? 0;
    const topVerdict = malicious.length  ? 'MALICIOUS' :
                       suspicious.length ? 'SUSPICIOUS' :
                       kwHits.length >= 3 ? 'SUSPICIOUS' : 'CLEAR';

    const logData = {
      action:  'logEmailScan',
      sender:  String(sender).trim().slice(0, 200),
      subject: String(subject).trim().slice(0, 300),
      verdict: String(topVerdict),
      score:   Math.min(Math.max(0, Number(topScore) || 0), 100),
      reason:  String(topReason).slice(0, 300),
      links:   links.map(l => l.href).slice(0, 20),
      signals: [
        `${links.length} links found`,
        malicious.length  ? `${malicious.length} malicious link(s)` : null,
        suspicious.length ? `${suspicious.length} suspicious link(s)` : null,
        kwHits.length     ? `${kwHits.length} phishing keyword(s)` : null,
      ].filter(Boolean),
    };

    console.log('[ARGUS Email] Sending log data to background:', JSON.stringify(logData, null, 2));
    
    safeSendRuntimeMessage(logData, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[ARGUS Email] Failed to send log to background:', chrome.runtime.lastError.message);
      } else {
        console.log('[ARGUS Email] Background acknowledged log:', response);
      }
    });
  } catch (err) { 
    console.error('[ARGUS Email] Error preparing log data:', err.message);
    console.error('[ARGUS Email] Error stack:', err.stack);
  }

  // Show email capsule if threats detected
  if (totalThreats > 0) {
    showEmailCapsule(totalThreats, summary, malicious.length > 0 ? 'danger' : 'warning');
  } else {
    // Hide capsule if no threats
    hideEmailCapsule();
  }
}

function isDuplicateEmailLog(fingerprint, summary) {
  if (!fingerprint) return false;
  const now = Date.now();
  const last = state.lastEmailLog;
  if (last && last.fingerprint === fingerprint && now - last.at < 20000) {
    return true;
  }
  state.lastEmailLog = { fingerprint, summary, at: now };
  return false;
}

function safeSendRuntimeMessage(message, callback) {
  try {
    if (!chrome?.runtime?.id) return false;
    chrome.runtime.sendMessage(message, callback);
    return true;
  } catch (error) {
    console.warn('[ARGUS] Runtime message failed:', error.message);
    return false;
  }
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

// ─── Email Warning Capsule ────────────────────────────────────────────────────

function showEmailCapsule(threatCount, summary, level) {
  // Remove existing capsule if any
  hideEmailCapsule();

  const capsule = document.createElement('div');
  capsule.id = 'argus-email-capsule';
  capsule.className = `argus-capsule argus-capsule-${level}`;
  
  const isDanger = level === 'danger';
  const bgColor = isDanger ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)';
  const borderColor = isDanger ? '#ef4444' : '#f59e0b';
  const textColor = '#ffffff';
  
  capsule.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999998;
    background: ${bgColor};
    border: 2px solid ${borderColor};
    border-radius: 24px;
    padding: 12px 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${borderColor}40;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: ${textColor};
    animation: argusSlideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    transition: all 0.3s ease;
    max-width: 600px;
  `;

  // Add animation keyframes
  if (!document.getElementById('argus-capsule-styles')) {
    const style = document.createElement('style');
    style.id = 'argus-capsule-styles';
    style.textContent = `
      @keyframes argusSlideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      @keyframes argusPulse {
        0%, 100% {
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${borderColor}40;
        }
        50% {
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px ${borderColor}80;
        }
      }
      .argus-capsule:hover {
        transform: translateX(-50%) scale(1.02);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 30px ${borderColor}60 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Eye icon
  const eyeIcon = document.createElement('div');
  eyeIcon.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
      <ellipse cx="12" cy="12" rx="10" ry="6" stroke="${textColor}" stroke-width="2"/>
      <circle cx="12" cy="12" r="3" fill="${textColor}"/>
      <circle cx="12" cy="12" r="1.2" fill="${bgColor}"/>
    </svg>
  `;
  eyeIcon.style.cssText = 'display: flex; align-items: center; flex-shrink: 0;';

  // Content
  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; min-width: 0;';
  
  const title = document.createElement('div');
  title.textContent = `ARGUS — ${isDanger ? 'Malicious' : 'Suspicious'} Email Detected`;
  title.style.cssText = `
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  `;

  const subtitle = document.createElement('div');
  subtitle.textContent = `${threatCount} threat${threatCount > 1 ? 's' : ''} found`;
  subtitle.style.cssText = `
    font-size: 11px;
    opacity: 0.9;
  `;

  content.appendChild(title);
  content.appendChild(subtitle);

  // Badge
  const badge = document.createElement('div');
  badge.textContent = threatCount.toString();
  badge.style.cssText = `
    background: ${textColor};
    color: ${bgColor};
    font-size: 14px;
    font-weight: 800;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: ${textColor};
    font-size: 24px;
    line-height: 1;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s ease;
  `;
  closeBtn.onmouseover = () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
  };
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    hideEmailCapsule();
  };

  capsule.appendChild(eyeIcon);
  capsule.appendChild(content);
  capsule.appendChild(badge);
  capsule.appendChild(closeBtn);

  // Add pulse animation for danger
  if (isDanger) {
    capsule.style.animation = 'argusSlideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1), argusPulse 2s ease-in-out infinite';
  }

  // Click to show details
  capsule.onclick = () => {
    if (summary) {
      alert(`ARGUS Email Threat Detection\n\n${summary}\n\nCheck the email content for suspicious links marked with warning badges.`);
    }
  };

  document.body.appendChild(capsule);
  state.emailCapsule = capsule;

  // Auto-hide after 10 seconds for warnings, 15 for danger
  setTimeout(() => {
    hideEmailCapsule();
  }, isDanger ? 15000 : 10000);
}

function hideEmailCapsule() {
  if (state.emailCapsule) {
    state.emailCapsule.style.animation = 'none';
    state.emailCapsule.style.opacity = '0';
    state.emailCapsule.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => {
      if (state.emailCapsule) {
        state.emailCapsule.remove();
        state.emailCapsule = null;
      }
    }, 300);
  }
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
    scanEmailContent(emailRoot, fingerprint); // synchronous — result reported instantly
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

// Capture current page as image using chrome.tabs.captureVisibleTab
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

      // Use chrome.tabs.captureVisibleTab to capture the entire visible tab
      // This bypasses CORS restrictions
      chrome.runtime.sendMessage({ 
        action: 'captureVisibleTab' 
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.dataUrl) {
          resolve(response.dataUrl);
        } else {
          reject(new Error('Failed to capture tab'));
        }
      });
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
  if (state.isCapturing) {
    console.log('[ARGUS DF] Already capturing, skipping start');
    return;
  }

  state.isCapturing = true;
  createOverlay();

  // Wait for overlay to load, then reset it
  setTimeout(() => {
    resetOverlay(); // Reset overlay to clear old fake probability window
  }, 100);

  // Reset backend state so we start completely fresh (no previous verdict)
  // Only reset if we haven't reset recently (prevent rapid resets)
  const now = Date.now();
  const lastReset = state.lastBackendReset || 0;
  const resetCooldown = 3000; // 3 seconds cooldown between resets
  
  if (now - lastReset > resetCooldown) {
    state.lastBackendReset = now;
    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'resetBackend' }, () => {
          if (chrome.runtime.lastError) {
            console.log('[ARGUS DF] Could not reset backend on start:', chrome.runtime.lastError.message);
          } else {
            console.log('[ARGUS DF] Backend detector reset on start');
          }
          resolve();
        });
      });
    } catch (e) {
      console.log('[ARGUS DF] Could not reset backend on start:', e);
    }
  } else {
    console.log('[ARGUS DF] Skipping backend reset (cooldown active)');
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
      console.error('[ARGUS DF] Detection error:', error);
      
      // Only update overlay with error if it's not a temporary issue
      if (error.message !== 'No video found on page' && 
          error.message !== 'Video not ready yet' &&
          error.message !== 'Video has ended') {
        // Update overlay with error/disconnected state so it doesn't show stale data
        updateOverlay({ 
          status: 'error',
          error_message: error.message 
        });

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
  if (!state.isCapturing) {
    console.log('[ARGUS DF] Not capturing, skipping stop');
    return;
  }
  
  console.log('[ARGUS DF] Stopping detection');
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
  // Only if we haven't reset very recently
  const now = Date.now();
  const lastReset = state.lastBackendReset || 0;
  const resetCooldown = 2000; // 2 seconds cooldown
  
  if (now - lastReset > resetCooldown) {
    state.lastBackendReset = now;
    try {
      chrome.runtime.sendMessage({ action: 'resetBackend' }, () => {
        if (chrome.runtime.lastError) {
          console.log('[ARGUS DF] Could not reset backend on stop:', chrome.runtime.lastError.message);
        } else {
          console.log('[ARGUS DF] Backend detector reset on stop');
        }
      });
    } catch (error) {
      console.log('[ARGUS DF] Could not reset backend on stop:', error);
    }
  } else {
    console.log('[ARGUS DF] Skipping backend reset on stop (cooldown active)');
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

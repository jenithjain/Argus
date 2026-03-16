// ARGUS v2 — Popup Controller
'use strict';

const DEFAULT_BACKEND = 'http://localhost:5000';

// ---- DOM refs ----
const protectedPill  = document.getElementById('protectedPill');
const dashboard      = document.getElementById('dashboard');
const expandBtn      = document.getElementById('expandBtn');
const collapseBtn    = document.getElementById('collapseBtn');
const pillLabel      = protectedPill.querySelector('.pill-label');
const themeToggle    = document.getElementById('themeToggle');
const themeToggleLabel = document.getElementById('themeToggleLabel');
const themeModeChip  = document.getElementById('themeModeChip');

// Status banner
const statusBanner   = document.getElementById('statusBanner');
const bannerIcon     = document.getElementById('bannerIcon');
const bannerTitle    = document.getElementById('bannerTitle');
const bannerSub      = document.getElementById('bannerSub');
const globalScore    = document.getElementById('globalScore');

// Module: Deepfake
const modDfCard      = document.getElementById('mod-deepfake');
const dfStatusDot    = document.getElementById('df-status-dot');
const dfState        = document.getElementById('df-state');
const dfResult       = document.getElementById('df-result');
const dfClass        = document.getElementById('df-class');
const dfConf         = document.getElementById('df-conf');
const dfFrames       = document.getElementById('df-frames');
const startDfBtn     = document.getElementById('startDeepfakeBtn');
const stopDfBtn      = document.getElementById('stopDeepfakeBtn');

// Module: URL
const modUrlCard     = document.getElementById('mod-url');
const urlStatusDot   = document.getElementById('url-status-dot');
const urlState       = document.getElementById('url-state');
const currentUrlText = document.getElementById('currentUrlText');
const urlResult      = document.getElementById('url-result');
const urlVerdict     = document.getElementById('url-verdict');
const urlScore       = document.getElementById('url-score');

// Module: Email
const modMailCard    = document.getElementById('mod-email');
const mailStatusDot  = document.getElementById('mail-status-dot');
const mailState      = document.getElementById('mail-state');
const mailResult     = document.getElementById('mail-result');
const mailVerdict    = document.getElementById('mail-verdict');
const mailLinks      = document.getElementById('mail-links');
const mailThreats    = document.getElementById('mail-threats');

// Module: Prompt Injection
const modPiCard      = document.getElementById('mod-pi');
const piStatusDot    = document.getElementById('pi-status-dot');
const piState        = document.getElementById('pi-state');
const piResult       = document.getElementById('pi-result');
const piVerdict      = document.getElementById('pi-verdict');
const piThreatType   = document.getElementById('pi-threat-type');
const piScore        = document.getElementById('pi-score');

// Threat feed
const threatFeedLabel= document.getElementById('threatFeedLabel');
const threatFeed     = document.getElementById('threatFeed');

// Config
const configToggle   = document.getElementById('configToggle');
const configPanel    = document.getElementById('configPanel');
const backendUrlInput= document.getElementById('backendUrl');
const testConnBtn    = document.getElementById('testConnection');
const connStatus     = document.getElementById('connectionStatus');
const connDot        = document.getElementById('connectionDot');

// Footer
const sessionCountEl = document.getElementById('sessionCount');

// Pill dots
const pillDots = {
  df:   protectedPill.querySelectorAll('.module-dot')[0],
  url:  protectedPill.querySelectorAll('.module-dot')[1],
  mail: protectedPill.querySelectorAll('.module-dot')[2],
  pi:   protectedPill.querySelectorAll('.module-dot')[3],
};

// ---- State ----
let isDfDetecting  = false;
let sessionEvents  = 0;
let highestRisk    = 0;
let currentTheme   = 'dark';

// ---- Init ----
chrome.storage.local.get(['backendUrl', 'argusView', 'dfDetecting', 'argusTheme'], (store) => {
  if (store.backendUrl) backendUrlInput.value = store.backendUrl;
  else backendUrlInput.value = DEFAULT_BACKEND;

  applyTheme(store.argusTheme || 'dark');

  if (store.dfDetecting) {
    isDfDetecting = true;
    setDfUI(true);
  } else {
    dfState.textContent = 'Auto mode: waiting for active video';
  }

  if (store.argusView === 'dashboard') showDashboard();
  else showPill();
});

themeToggle.addEventListener('click', () => {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  chrome.storage.local.set({ argusTheme: currentTheme });
});

function applyTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  const label = currentTheme === 'dark' ? 'Dark' : 'Light';
  themeToggleLabel.textContent = label;
  themeModeChip.textContent = `Theme: ${label}`;
}

// Load current tab URL into URL module + instantly load cached email results
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab && tab.url) {
    const url = tab.url;
    currentUrlText.textContent = url.length > 58 ? url.slice(0, 55) + '...' : url;
    // Check if we're on Gmail/Outlook
    const isMailSite = /mail\.google\.com|outlook\.(com|live|office)|yahoo\.com\/mail/i.test(url);
    if (isMailSite) {
      // 1. Immediately load cached email scan result from storage (instant)
      const storageKey = `emailScanResult_${tab.id}`;
      chrome.storage.local.get([storageKey], (store) => {
        const cached = store[storageKey];
        if (cached) {
          // Replay the cached result as if the message just arrived
          handleEmailScanResult(cached);
        } else {
          setMailModuleActive(true, 'Scanning email content...');
        }
      });

      // 2. Also trigger a fresh scan from the content script (will arrive via message)
      chrome.tabs.sendMessage(tab.id, { action: 'rescanEmail' }, () => {
        // ignore errors if content script not ready
        if (chrome.runtime.lastError) { /* ok */ }
      });
    }
  }
});

// ---- View toggling ----
function showPill() {
  protectedPill.style.display = 'flex';
  dashboard.style.display = 'none';
  chrome.storage.local.set({ argusView: 'pill' });
}
function showDashboard() {
  protectedPill.style.display = 'none';
  dashboard.style.display = 'block';
  chrome.storage.local.set({ argusView: 'dashboard' });
}

expandBtn.addEventListener('click', showDashboard);
collapseBtn.addEventListener('click', showPill);
protectedPill.addEventListener('click', (e) => {
  if (e.target === expandBtn || expandBtn.contains(e.target)) return;
  showDashboard();
});

// ---- Config ----
configToggle.addEventListener('click', () => {
  const visible = configPanel.style.display !== 'none';
  configPanel.style.display = visible ? 'none' : 'block';
});

backendUrlInput.addEventListener('change', () => {
  chrome.storage.local.set({ backendUrl: backendUrlInput.value.trim() });
});

testConnBtn.addEventListener('click', async () => {
  const url = (backendUrlInput.value || DEFAULT_BACKEND).trim().replace(/\/$/, '');
  connStatus.textContent = 'Testing...';
  connDot.className = 'connection-dot';
  try {
    const resp = await fetch(`${url}/health`, { method: 'GET' });
    if (resp.ok) {
      const data = await resp.json();
      connStatus.textContent = `OK — model ${data.model_loaded ? 'loaded' : 'not loaded'}`;
      connDot.className = 'connection-dot ok';
    } else {
      connStatus.textContent = `Error: ${resp.status}`;
      connDot.className = 'connection-dot error';
    }
  } catch (err) {
    connStatus.textContent = `Unreachable`;
    connDot.className = 'connection-dot error';
  }
});

// ---- Deepfake Module ----
startDfBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ action: 'startDetection', tabId: tab.id }, (resp) => {
    if (chrome.runtime.lastError || !resp?.success) {
      const msg = resp?.error || chrome.runtime.lastError?.message || 'Failed';
      addThreatFeedItem('warning', 'Deepfake Module', msg);
      return;
    }
    isDfDetecting = true;
    setDfUI(true);
    chrome.storage.local.set({ dfDetecting: true });
  });
});

stopDfBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopDetection' }, () => {
    isDfDetecting = false;
    setDfUI(false);
    chrome.storage.local.set({ dfDetecting: false });
    dfResult.style.display = 'none';
    dfState.textContent = 'Stopped';
  });
});

function setDfUI(active) {
  startDfBtn.disabled = active;
  stopDfBtn.disabled  = !active;
  if (active) {
    dfStatusDot.className = 'module-status-dot analyzing';
    dfState.textContent   = 'Analyzing frames...';
    modDfCard.className   = 'module-card active';
    pillDots.df.className = 'module-dot active';
  } else {
    dfStatusDot.className = 'module-status-dot';
    dfState.textContent   = 'Auto mode: waiting for active video';
    modDfCard.className   = 'module-card';
    pillDots.df.className = 'module-dot';
  }
}

// ---- Email Module ----
function setMailModuleActive(active, stateText) {
  if (active) {
    mailStatusDot.className = 'module-status-dot active';
    mailState.textContent   = stateText || 'Scanning email content...';
    modMailCard.className   = 'module-card active';
    pillDots.mail.className = 'module-dot active';
  }
}

// ---- Risk helpers ----
function updateGlobalRisk(score) {
  if (score > highestRisk) highestRisk = score;
  globalScore.textContent = highestRisk;

  if (highestRisk >= 70) {
    statusBanner.className     = 'status-banner danger';
    bannerTitle.textContent    = 'THREAT DETECTED';
    bannerSub.textContent      = 'Active threat requires your attention';
    protectedPill.className    = 'argus-pill threat';
    pillLabel.textContent      = 'ARGUS — THREAT DETECTED';
    setBannerIcon('danger');
  } else if (highestRisk >= 35) {
    statusBanner.className     = 'status-banner warning';
    bannerTitle.textContent    = 'Suspicious Activity';
    bannerSub.textContent      = 'Review flagged items below';
    protectedPill.className    = 'argus-pill';
    setBannerIcon('warning');
  }
}

function setBannerIcon(type) {
  const icons = {
    safe: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.36C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#00ff88" opacity="0.2"/><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.36C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="#00ff88" stroke-width="2"/><polyline points="9 12 11 14 15 10" stroke="#00ff88" stroke-width="2"/></svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="#f59e0b" opacity="0.15" stroke="#f59e0b" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="#f59e0b" stroke-width="2"/><circle cx="12" cy="17" r="1" fill="#f59e0b"/></svg>`,
    danger:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#ef4444" opacity="0.15" stroke="#ef4444" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" stroke-width="2"/><circle cx="12" cy="16" r="1" fill="#ef4444"/></svg>`,
  };
  bannerIcon.innerHTML = icons[type] || icons.safe;
}

// ---- Threat Feed ----
function addThreatFeedItem(level, title, desc) {
  threatFeedLabel.style.display = 'block';
  threatFeed.style.display = 'flex';
  sessionEvents++;
  sessionCountEl.textContent = `${sessionEvents} event${sessionEvents !== 1 ? 's' : ''} this session`;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const item = document.createElement('div');
  item.className = `threat-item ${level}`;
  item.innerHTML = `
    <div class="threat-badge ${level}">${level === 'danger' ? 'HIGH RISK' : 'WARNING'}</div>
    <div class="threat-content">
      <div class="threat-title">${escHtml(title)}</div>
      <div class="threat-desc">${escHtml(desc)}</div>
    </div>
    <div class="threat-time">${timeStr}</div>
  `;
  threatFeed.prepend(item);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Email Scan Result Handler (reusable — called from init cache + live messages) ----
function handleEmailScanResult(r) {
  if (!r) return;
  mailResult.style.display = 'flex';

  const threats = r.threats || 0;
  const kwHits  = r.kwHits  || 0;
  mailVerdict.textContent = threats > 0 ? `${threats} threat${threats > 1 ? 's' : ''} found` : 'Clean';
  mailLinks.textContent   = r.linksFound || 0;
  mailThreats.textContent = threats;
  mailVerdict.className   = `mr-val ${threats > 0 ? (threats >= 2 ? 'danger' : 'warning') : 'safe'}`;

  if (threats > 0) {
    const level = threats >= 2 ? 'danger' : 'warning';
    const stateText = `${threats} phishing link${threats > 1 ? 's' : ''} detected`;
    mailStatusDot.className = `module-status-dot ${level}`;
    modMailCard.className   = `module-card ${level}`;
    pillDots.mail.className = `module-dot ${level === 'danger' ? 'danger' : 'warn'}`;
    mailState.textContent   = stateText;
    updateGlobalRisk(threats >= 2 ? 80 : (kwHits >= 3 ? 60 : 50));
    addThreatFeedItem(
      level,
      'Phishing Email Detected',
      r.summary || `${threats} suspicious link${threats > 1 ? 's' : ''} found in email`
    );
  } else if (kwHits >= 3) {
    mailStatusDot.className = 'module-status-dot warning';
    modMailCard.className   = 'module-card warning';
    pillDots.mail.className = 'module-dot warn';
    mailState.textContent   = 'Suspicious language detected';
    updateGlobalRisk(35);
    addThreatFeedItem(
      'warning',
      'Suspicious Email Language',
      r.summary || `${kwHits} phishing phrases detected in email body`
    );
  } else {
    mailStatusDot.className = 'module-status-dot active';
    modMailCard.className   = 'module-card active';
    pillDots.mail.className = 'module-dot active';
    mailState.textContent   = '✓ Email verified clean';
  }
}

// ---- Message Listener (from background + content) ----
chrome.runtime.onMessage.addListener((msg) => {
  // Deepfake results
  if (msg.action === 'detectionResult' && msg.data) {
    const d = msg.data;
    dfResult.style.display = 'flex';

    const cls = d.confidence_level || 'UNCERTAIN';
    dfClass.textContent  = cls;
    dfConf.textContent   = d.fake_probability ? (d.fake_probability * 100).toFixed(1) + '%' : '-';
    dfFrames.textContent = d.frame_count || 0;

    if (cls === 'FAKE' || cls === 'HIGH_FAKE') {
      dfClass.className    = 'mr-val danger';
      dfStatusDot.className= 'module-status-dot danger';
      modDfCard.className  = 'module-card danger';
      pillDots.df.className= 'module-dot danger';
      dfState.textContent  = 'DEEPFAKE DETECTED';
      updateGlobalRisk(90);
      addThreatFeedItem('danger', 'Deepfake Detected', `Fake probability: ${dfConf.textContent} — ${d.frame_count || '?'} frames analyzed`);
    } else if (cls === 'REAL' || cls === 'HIGH_REAL') {
      dfClass.className    = 'mr-val safe';
      dfStatusDot.className= 'module-status-dot active';
      modDfCard.className  = 'module-card active';
      pillDots.df.className= 'module-dot active';
      dfState.textContent  = 'Authentic content confirmed';
    } else {
      dfClass.className    = 'mr-val';
      dfStatusDot.className= 'module-status-dot analyzing';
      dfState.textContent  = 'Analyzing frames...';
    }
  }

  if (msg.action === 'detectionStopped') {
    isDfDetecting = false;
    setDfUI(false);
    chrome.storage.local.set({ dfDetecting: false });
  }

  if (msg.action === 'deepfakeAutoStarted') {
    isDfDetecting = true;
    setDfUI(true);
    chrome.storage.local.set({ dfDetecting: true });
  }

  // URL scan results
  if (msg.action === 'urlScanResult') {
    const r = msg.result;
    urlResult.style.display = 'flex';
    const isMalicious = r.verdict === 'MALICIOUS' || r.verdict === 'HIGH_RISK';
    const isWarning   = r.verdict === 'SUSPICIOUS' || r.verdict === 'MEDIUM_RISK';

    urlVerdict.textContent  = r.verdict || 'CLEAR';
    urlScore.textContent    = (r.score !== undefined) ? r.score : '-';
    urlVerdict.className    = `mr-val ${isMalicious ? 'danger' : isWarning ? 'warning' : 'safe'}`;
    urlScore.className      = `mr-val ${isMalicious ? 'danger' : isWarning ? 'warning' : ''}`;

    if (isMalicious || isWarning) {
      urlStatusDot.className  = `module-status-dot ${isMalicious ? 'danger' : 'warning'}`;
      modUrlCard.className    = `module-card ${isMalicious ? 'danger' : 'warning'}`;
      pillDots.url.className  = `module-dot ${isMalicious ? 'danger' : 'warn'}`;
      urlState.textContent    = isMalicious ? 'BLOCKED — Malicious URL' : 'Warning — Suspicious URL';
      updateGlobalRisk(isMalicious ? 85 : 45);
      addThreatFeedItem(
        isMalicious ? 'danger' : 'warning',
        isMalicious ? 'Malicious URL Blocked' : 'Suspicious URL Detected',
        r.reason || r.url || ''
      );
    } else {
      urlStatusDot.className = 'module-status-dot active';
      modUrlCard.className   = 'module-card active';
      urlState.textContent   = 'URL verified safe';
    }

    const displayUrl = r.url ? (r.url.length > 55 ? r.url.slice(0, 52) + '...' : r.url) : '';
    if (displayUrl) currentUrlText.textContent = displayUrl;
  }

  // Email scan results
  if (msg.action === 'emailScanResult') {
    handleEmailScanResult(msg.result);
  }

  // Prompt Injection module
  if (msg.action === 'piModuleActive') {
    piStatusDot.className = 'module-status-dot active';
    modPiCard.className   = 'module-card active';
    pillDots.pi.className = 'module-dot active';
    piState.textContent   = `Active on ${msg.site || 'AI chatbot'}`;
  }

  if (msg.action === 'piScanResult') {
    handlePIScanResult(msg.result);
  }
});

// ---- Prompt Injection Result Handler ----
function handlePIScanResult(r) {
  if (!r) return;

  if (r.verdict === 'CLEAR') {
    piResult.style.display  = 'none';
    piStatusDot.className   = 'module-status-dot active';
    modPiCard.className     = 'module-card active';
    pillDots.pi.className   = 'module-dot active';
    piState.textContent     = '✓ Prompt verified clean';
    return;
  }

  // THREAT
  piResult.style.display = 'flex';
  const score = r.score || 0;
  const pct = Math.round(score * 100);
  const threatType = (r.threat_type || 'UNKNOWN').replace(/_/g, ' ');
  const isBlock = r.action === 'BLOCK';
  const level = isBlock ? 'danger' : 'warning';

  piVerdict.textContent   = r.verdict;
  piVerdict.className     = `mr-val ${level}`;
  piThreatType.textContent = threatType;
  piThreatType.className  = `mr-val ${level}`;
  piScore.textContent     = pct + '%';
  piScore.className       = `mr-val ${level}`;

  piStatusDot.className   = `module-status-dot ${level}`;
  modPiCard.className     = `module-card ${level}`;
  pillDots.pi.className   = `module-dot ${level === 'danger' ? 'danger' : 'warn'}`;
  piState.textContent     = isBlock ? 'INJECTION BLOCKED' : 'Suspicious prompt detected';

  updateGlobalRisk(isBlock ? 85 : 55);
  addThreatFeedItem(
    level,
    isBlock ? 'Prompt Injection Blocked' : 'Suspicious Prompt Detected',
    r.explanation?.summary || `${threatType} — Score: ${pct}%`
  );
}


// Script for blocked.html page
'use strict';

const params     = new URLSearchParams(window.location.search);
const blockedUrl = params.get('url') || '';
const reason     = params.get('reason') || 'Malicious URL detected by ARGUS AI analysis';
const parsedScore = Number.parseInt(params.get('score') || '85', 10);
const score = Number.isFinite(parsedScore) ? Math.max(0, Math.min(parsedScore, 100)) : 85;

// Apply theme from storage
chrome.storage.local.get(['argusTheme'], (result) => {
  const theme = result.argusTheme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
});

// Listen for theme changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.argusTheme) {
    document.documentElement.setAttribute('data-theme', changes.argusTheme.newValue || 'dark');
  }
});

// URLSearchParams already decodes values, so avoid decodeURIComponent again.
document.getElementById('blockedUrl').textContent   = blockedUrl || '(unknown)';
document.getElementById('threatReason').textContent = reason;
document.getElementById('scoreNum').textContent     = String(score);
setTimeout(() => {
  document.getElementById('scoreFill').style.width = score + '%';
}, 100);

function goBack() {
  if (window.history.length > 1) {
    window.history.go(-2); // -2 to skip the blocked page
  } else {
    window.close();
  }
}

function proceedAnyway() {
  if (!blockedUrl) return;
  const shouldProceed = window.confirm(
    'WARNING: You are about to visit a site flagged as MALICIOUS by ARGUS.\n\n' +
    'This site may steal your credentials, infect your device with malware, or perform phishing attacks.\n\n' +
    'Are you absolutely sure you want to proceed?'
  );
  if (shouldProceed) {
    window.location.href = blockedUrl;
  }
}

// Add event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const btnProceed = document.getElementById('proceedBtn');
  
  if (btnBack) {
    btnBack.addEventListener('click', goBack);
  }
  
  if (btnProceed) {
    btnProceed.addEventListener('click', proceedAnyway);
  }
  
  // Auto-hide proceed button after 5s to discourage click
  setTimeout(() => {
    if (btnProceed) btnProceed.style.opacity = '0.4';
  }, 5000);
});

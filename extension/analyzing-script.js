// Script for analyzing.html page
'use strict';

const params = new URLSearchParams(window.location.search);
const targetUrl = params.get('url') || '';
const tabId = params.get('tabId') || '';

console.log('[ARGUS Analyzing] Page loaded for URL:', targetUrl, 'TabID:', tabId);
document.getElementById('targetUrl').textContent = targetUrl || '(unknown)';

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

function redirectToBlocked(result) {
  console.log('[ARGUS Analyzing] URL is malicious, redirecting to blocked page');
  const blockedUrl = chrome.runtime.getURL('blocked.html') +
    `?url=${encodeURIComponent(targetUrl)}` +
    `&reason=${encodeURIComponent(result.reason || 'Malicious URL detected')}` +
    `&score=${result.score || 85}`;
  window.location.href = blockedUrl;
}

function redirectToTarget() {
  console.log('[ARGUS Analyzing] URL is safe, redirecting to target');
  document.getElementById('statusText').textContent = 'URL is safe! Redirecting...';
  setTimeout(() => {
    window.location.href = targetUrl;
  }, 500);
}

function handleAnalysisResult(result) {
  console.log('[ARGUS Analyzing] Processing result:', result);
  
  if (result.verdict === 'HIGH_RISK' || result.verdict === 'MALICIOUS') {
    redirectToBlocked(result);
  } else {
    redirectToTarget();
  }
}

// Listen for analysis result from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ARGUS Analyzing] Received message:', message);
  
  if (message.action === 'analysisComplete' && message.tabId === tabId) {
    const result = message.result;
    console.log('[ARGUS Analyzing] Analysis complete:', result);
    handleAnalysisResult(result);
    sendResponse({ received: true });
  }
  return true; // Keep message channel open
});

// Also request analysis result immediately in case message was sent before listener was ready
setTimeout(() => {
  console.log('[ARGUS Analyzing] Requesting analysis status from background');
  chrome.runtime.sendMessage({ 
    action: 'getAnalysisResult', 
    url: targetUrl,
    tabId: tabId 
  }, (response) => {
    console.log('[ARGUS Analyzing] Got analysis response:', response);
    if (response && response.hasResult) {
      handleAnalysisResult(response.result);
    }
  });
}, 100);

// Timeout fallback - if no response in 10 seconds, allow navigation
setTimeout(() => {
  console.log('[ARGUS Analyzing] Timeout reached, proceeding to URL');
  document.getElementById('statusText').textContent = 'Analysis timeout - proceeding...';
  setTimeout(() => {
    window.location.href = targetUrl;
  }, 1000);
}, 10000);

// Content script for tracking user interactions and sending to knowledge graph
'use strict';

const ARGUS_API = 'http://localhost:3000/api';
let interactionSent = false;

// Collect page interaction data
function collectInteractionData() {
  const url = window.location.href;
  const title = document.title;
  const timestamp = new Date().toISOString();

  // Check for login forms
  const hasLoginForm = detectLoginForm();

  // Collect links on page
  const links = collectLinks();

  // Detect suspicious patterns
  const suspiciousPatterns = detectSuspiciousPatterns();

  return {
    url,
    title,
    timestamp,
    links,
    hasLoginForm,
    suspiciousPatterns,
  };
}

// Detect login/password forms
function detectLoginForm() {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"], input[name*="username"]');
  
  return passwordInputs.length > 0 && emailInputs.length > 0;
}

// Collect all links on the page
function collectLinks() {
  const links = [];
  const anchors = document.querySelectorAll('a[href]');
  
  anchors.forEach((anchor) => {
    const href = anchor.href;
    if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      links.push({
        url: href,
        text: anchor.textContent.trim().substring(0, 100),
      });
    }
  });

  return links.slice(0, 50); // Limit to 50 links
}

// Detect suspicious patterns on the page
function detectSuspiciousPatterns() {
  const patterns = [];
  const bodyText = document.body.textContent.toLowerCase();

  // Urgency keywords
  const urgencyKeywords = [
    'urgent', 'immediate action', 'account suspended', 'verify now',
    'limited time', 'act now', 'confirm identity', 'unusual activity'
  ];

  urgencyKeywords.forEach((keyword) => {
    if (bodyText.includes(keyword)) {
      patterns.push(`urgency_keyword:${keyword}`);
    }
  });

  // Check for fake login pages
  if (detectLoginForm()) {
    const domain = window.location.hostname;
    const suspiciousBrands = ['paypal', 'amazon', 'google', 'microsoft', 'apple', 'netflix'];
    
    suspiciousBrands.forEach((brand) => {
      if (domain.includes(brand) && !domain.endsWith(`${brand}.com`)) {
        patterns.push(`fake_login:${brand}`);
      }
    });
  }

  // Check for excessive external links
  const externalLinks = Array.from(document.querySelectorAll('a[href]')).filter((a) => {
    try {
      const linkHost = new URL(a.href).hostname;
      return linkHost !== window.location.hostname;
    } catch {
      return false;
    }
  });

  if (externalLinks.length > 20) {
    patterns.push('excessive_external_links');
  }

  return patterns;
}

// Send interaction data to backend
// NOTE: Content scripts cannot fetch localhost directly (Chrome blocks loopback
// access from public origins). We route through the background service worker.
async function sendInteractionData() {
  if (interactionSent) return;

  try {
    const data = collectInteractionData();

    chrome.runtime.sendMessage({
      action: 'sendInteraction',
      data,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[ARGUS] Failed to send interaction data:', chrome.runtime.lastError.message);
        return;
      }
      if (response && response.ok) {
        console.log('[ARGUS] Interaction data sent to knowledge graph');
        interactionSent = true;
      }
    });
  } catch (error) {
    console.warn('[ARGUS] Failed to send interaction data:', error.message);
  }
}

// Send interaction data when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(sendInteractionData, 2000);
  });
} else {
  setTimeout(sendInteractionData, 2000);
}

// Also send on significant user interaction
let interactionTimeout;
function scheduleInteractionSend() {
  clearTimeout(interactionTimeout);
  interactionTimeout = setTimeout(() => {
    if (!interactionSent) {
      sendInteractionData();
    }
  }, 5000);
}

document.addEventListener('click', scheduleInteractionSend, { once: true });
document.addEventListener('scroll', scheduleInteractionSend, { once: true });

console.log('[ARGUS] Interaction tracker loaded');

// ARGUS v2 — Prompt Injection Monitor
// Runs on AI chatbot pages, monitors user input for prompt injection patterns
// Activated on: claude.ai, chat.openai.com, chatgpt.com, gemini.google.com,
//   perplexity.ai, copilot.microsoft.com, poe.com, character.ai,
//   huggingface.co/chat, mistral.ai, cohere.com/chat, and /chat /assistant /playground /prompt paths
'use strict';

(function () {
  // ─── Guard ──────────────────────────────────────────────────────────────────
  if (window.__argusPILoaded) return;
  window.__argusPILoaded = true;

  console.log('[ARGUS PI] Prompt Injection Monitor loaded —', window.location.href);

  // ─── Activation Context ─────────────────────────────────────────────────────
  const AI_DOMAINS = [
    'claude.ai',
    'chat.openai.com',
    'chatgpt.com',
    'www.chatgpt.com',
    'gemini.google.com',
    'perplexity.ai',
    'copilot.microsoft.com',
    'poe.com',
    'character.ai',
    'huggingface.co',
    'mistral.ai',
    'cohere.com',
  ];
  const AI_PATH_SEGMENTS = ['/chat', '/assistant', '/playground', '/prompt'];

  function isAIChatbotPage() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // Domain match
    if (AI_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return true;
    }

    // Path segment match
    if (AI_PATH_SEGMENTS.some(seg => pathname.includes(seg))) {
      return true;
    }

    return false;
  }

  if (!isAIChatbotPage()) {
    console.log('[ARGUS PI] Not an AI chatbot page — deactivated');
    return;
  }

  console.log('[ARGUS PI] AI chatbot page detected — activating monitor');

  // ─── State ──────────────────────────────────────────────────────────────────
  let debounceTimer = null;
  let lastAnalyzedText = '';
  let lastPasteTime = 0;
  let lastCharCount = 0;
  let lastTypingTime = 0;
  let currentCapsule = null;
  let currentVerdict = null;
  let inputObserver = null;
  let scanInterval = null;

  // ─── Input Element Detection ────────────────────────────────────────────────
  // Each AI chatbot uses different selectors for the input box
  const INPUT_SELECTORS = [
    // ChatGPT / OpenAI
    '#prompt-textarea',
    'textarea[data-id="root"]',
    'div[contenteditable="true"][id="prompt-textarea"]',
    // Claude
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"][data-placeholder]',
    // Gemini
    'div[contenteditable="true"].ql-editor',
    'div[contenteditable="true"].textarea',
    'rich-textarea div[contenteditable="true"]',
    // Perplexity
    'textarea[placeholder*="Ask"]',
    'textarea.overflow-auto',
    // Copilot
    'textarea[id="searchbox"]',
    '#searchbox',
    'cib-serp textarea',
    // Poe
    'textarea[class*="GrowingTextArea"]',
    'textarea[class*="TextArea"]',
    // Character.ai
    'textarea[id="user-input"]',
    'textarea[placeholder*="Message"]',
    // HuggingFace Chat
    'textarea[placeholder*="Ask"]',
    'textarea[enterkeyhint="send"]',
    // Mistral
    'textarea[placeholder*="Ask"]',
    // Cohere
    'textarea[placeholder*="Message"]',
    // Generic fallbacks
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Send"]',
    'textarea[placeholder*="Type"]',
    'textarea[placeholder*="ask"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][data-placeholder*="Message"]',
    'div[contenteditable="true"][aria-label*="Message"]',
    'div[contenteditable="true"][aria-label*="message"]',
    'div[contenteditable="true"][aria-label*="prompt"]',
  ];

  function findInputElement() {
    for (const selector of INPUT_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el) return el;
      } catch {
        // Invalid selector, skip
      }
    }
    return null;
  }

  function getInputText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value || '';
    }
    // contenteditable
    return el.innerText || el.textContent || '';
  }

  // ─── Trigger Words (fast heuristic) ─────────────────────────────────────────
  const TRIGGER_STRINGS = [
    'ignore', 'disregard', 'forget', 'override', 'bypass', 'jailbreak',
    'you are now', 'act as', 'pretend', 'from now on', 'new instructions',
    'repeat your', 'what are your instructions', 'system prompt',
    'developer mode', 'dan', 'no restrictions', 'unrestricted',
    'hypothetically', 'in a fictional', 'for research purposes only',
    'my grandmother', "let's play a game where you"
  ];

  const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\uFEFF]/;

  function fastCheck(text) {
    const lower = text.toLowerCase();
    const triggers = TRIGGER_STRINGS.filter(t => lower.includes(t));
    const hasZeroWidth = ZERO_WIDTH_REGEX.test(text);
    return { triggers, hasZeroWidth, hasSuspicion: triggers.length > 0 || hasZeroWidth };
  }

  // ─── Send to background/API for analysis ────────────────────────────────────
  function safeSendMessage(msg, callback) {
    try {
      if (!chrome?.runtime?.id) return;
      chrome.runtime.sendMessage(msg, callback);
    } catch {
      // Extension context invalidated
    }
  }

  function analyzeText(text) {
    if (!text || text.length < 10) {
      hidePICapsule();
      currentVerdict = null;
      // Report CLEAR to popup
      safeSendMessage({ action: 'piScanResult', result: { verdict: 'CLEAR', score: 0, threat_type: null } });
      return;
    }

    // Avoid re-analyzing same text
    if (text === lastAnalyzedText) return;
    lastAnalyzedText = text;

    // Quick pre-check: if no triggers and no anomalies, skip API call
    const { triggers, hasZeroWidth, hasSuspicion } = fastCheck(text);
    if (!hasSuspicion && text.length < 2000) {
      hidePICapsule();
      currentVerdict = null;
      safeSendMessage({ action: 'piScanResult', result: { verdict: 'CLEAR', score: 0, threat_type: null } });
      return;
    }

    // Build input payload
    const now = Date.now();
    const pasteDetected = (now - lastPasteTime) < 2000;
    const typeDelta = now - lastTypingTime;
    const charDelta = text.length - lastCharCount;
    const typingVelocity = typeDelta > 0 ? (charDelta / (typeDelta / 1000)) : 0;

    const payload = {
      text: text.slice(0, 4000),
      site: window.location.hostname,
      char_count: text.length,
      typing_velocity: Math.max(0, typingVelocity),
      paste_detected: pasteDetected,
    };

    lastCharCount = text.length;
    lastTypingTime = now;

    // Route through background service worker (content scripts can't fetch localhost)
    safeSendMessage({ action: 'analyzePromptInjection', payload }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[ARGUS PI] Analysis failed:', chrome.runtime.lastError.message);
        return;
      }
      if (!response) return;

      currentVerdict = response;

      // Forward to popup
      safeSendMessage({ action: 'piScanResult', result: response });

      // Show/hide capsule based on verdict
      if (response.verdict === 'THREAT') {
        showPICapsule(response);
      } else {
        hidePICapsule();
      }
    });
  }

  // ─── Prompt Injection Capsule (inline pill, same style as email capsule) ────
  function showPICapsule(verdict) {
    hidePICapsule();

    const capsule = document.createElement('div');
    capsule.id = 'argus-pi-capsule';

    const score = verdict.score || 0;
    const isBlock = verdict.action === 'BLOCK';
    const bgColor = isBlock ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)';
    const borderColor = isBlock ? '#ef4444' : '#f59e0b';
    const textColor = '#ffffff';

    capsule.style.cssText = `
      position: fixed;
      bottom: 80px;
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
      animation: argusPISlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      transition: all 0.3s ease;
      max-width: 620px;
    `;

    // Add animation keyframes
    if (!document.getElementById('argus-pi-capsule-styles')) {
      const style = document.createElement('style');
      style.id = 'argus-pi-capsule-styles';
      style.textContent = `
        @keyframes argusPISlideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        @keyframes argusPIPulse {
          0%, 100% {
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${borderColor}40;
          }
          50% {
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px ${borderColor}80;
          }
        }
        #argus-pi-capsule:hover {
          transform: translateX(-50%) scale(1.02);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 30px ${borderColor}60 !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Shield icon
    const shieldIcon = document.createElement('div');
    shieldIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.36C17.25 22.15 21 17.25 21 12V7L12 2z" 
              stroke="${textColor}" stroke-width="2" fill="none"/>
        <line x1="12" y1="8" x2="12" y2="13" stroke="${textColor}" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="12" cy="16" r="1.2" fill="${textColor}"/>
      </svg>
    `;
    shieldIcon.style.cssText = 'display: flex; align-items: center; flex-shrink: 0;';

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; min-width: 0;';

    const title = document.createElement('div');
    const threatLabel = (verdict.threat_type || 'UNKNOWN').replace(/_/g, ' ');
    title.textContent = `ARGUS — ${isBlock ? 'Prompt Injection Blocked' : 'Suspicious Prompt Detected'}`;
    title.style.cssText = `
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    `;

    const subtitle = document.createElement('div');
    const explanationSummary = verdict.explanation?.summary || threatLabel;
    subtitle.textContent = explanationSummary.length > 70
      ? explanationSummary.slice(0, 67) + '...'
      : explanationSummary;
    subtitle.style.cssText = `
      font-size: 11px;
      opacity: 0.9;
    `;

    content.appendChild(title);
    content.appendChild(subtitle);

    // Score badge
    const badge = document.createElement('div');
    badge.textContent = Math.round(score * 100) + '%';
    badge.style.cssText = `
      background: ${textColor};
      color: ${bgColor};
      font-size: 12px;
      font-weight: 800;
      min-width: 44px;
      height: 28px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 0 8px;
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
    closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(255, 255, 255, 0.3)'; };
    closeBtn.onmouseout = () => { closeBtn.style.background = 'rgba(255, 255, 255, 0.2)'; };
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      hidePICapsule();
    };

    capsule.appendChild(shieldIcon);
    capsule.appendChild(content);
    capsule.appendChild(badge);
    capsule.appendChild(closeBtn);

    // Pulse animation for block
    if (isBlock) {
      capsule.style.animation = 'argusPISlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1), argusPIPulse 2s ease-in-out infinite';
    }

    // Click to show details
    capsule.onclick = () => {
      const details = verdict.explanation;
      if (details) {
        const evidence = details.evidence ? details.evidence.join('\n  • ') : 'N/A';
        alert(
          `ARGUS Prompt Injection Detection\n\n` +
          `Type: ${verdict.threat_type || 'Unknown'}\n` +
          `Score: ${Math.round(score * 100)}%\n` +
          `Severity: ${details.severity || 'Unknown'}\n\n` +
          `${details.summary || ''}\n\n` +
          `Evidence:\n  • ${evidence}\n\n` +
          `${details.recommended_action || ''}`
        );
      }
    };

    document.body.appendChild(capsule);
    currentCapsule = capsule;

    // Send notification through background
    safeSendMessage({
      action: 'piThreatNotification',
      threat_type: verdict.threat_type,
      summary: verdict.explanation?.summary || 'Prompt injection detected',
      score: score,
      site: window.location.hostname,
    });
  }

  function hidePICapsule() {
    if (currentCapsule) {
      currentCapsule.style.animation = 'none';
      currentCapsule.style.opacity = '0';
      currentCapsule.style.transform = 'translateX(-50%) translateY(20px)';
      const ref = currentCapsule;
      setTimeout(() => {
        if (ref && ref.parentNode) ref.remove();
      }, 300);
      currentCapsule = null;
    }
  }

  // ─── Input Monitoring ───────────────────────────────────────────────────────

  function startMonitoring(inputEl) {
    if (!inputEl) return;

    console.log('[ARGUS PI] Monitoring input element:', inputEl.tagName, inputEl.id || inputEl.className);

    // Listen for paste events
    inputEl.addEventListener('paste', () => {
      lastPasteTime = Date.now();
      // Analyze immediately after paste
      setTimeout(() => {
        const text = getInputText(inputEl);
        analyzeText(text);
      }, 100);
    });

    // Listen for input events (debounced at 800ms)
    const handleInput = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const text = getInputText(inputEl);
        analyzeText(text);
      }, 800);
    };

    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      inputEl.addEventListener('input', handleInput);
    } else {
      // For contentEditable divs
      inputEl.addEventListener('input', handleInput);
      inputEl.addEventListener('keyup', handleInput);
    }

    // Clear verdict when input is submitted successfully
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Only clear if NOT blocked (blocking is handled globally on capture phase)
        if (!currentVerdict || currentVerdict.action !== 'BLOCK') {
          setTimeout(() => {
            lastAnalyzedText = '';
            currentVerdict = null;
            hidePICapsule();
          }, 500);
        }
      }
    });
  }

  // ─── Global Strict Blocking (Capture Phase) ─────────────────────────────────
  function blockIfThreat(e) {
    if (currentVerdict && currentVerdict.action === 'BLOCK') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Provide visual feedback that input is locked
      if (currentCapsule) {
        currentCapsule.style.transform = 'translateX(-50%) scale(1.05)';
        currentCapsule.style.filter = 'brightness(1.2)';
        setTimeout(() => {
          if (currentCapsule) {
            currentCapsule.style.transform = 'translateX(-50%) scale(1)';
            currentCapsule.style.filter = 'brightness(1)';
          }
        }, 150);
      }
      return true;
    }
    return false;
  }

  // Intercept Enter key at the document level BEFORE the chat framework sees it
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Check if the target is within an input/textarea/contenteditable (catches nested <p> tags in Claude)
      const isInputNode = e.target.closest && e.target.closest('textarea, input, [contenteditable="true"]');
      if (isInputNode) {
        blockIfThreat(e);
      }
    }
  }, true); // true = capture phase (intercepts before React/Next.js)

  // Intercept Clicks on Send Buttons
  document.addEventListener('click', (e) => {
    if (currentVerdict && currentVerdict.action === 'BLOCK') {
      // Ignore clicks on our own warning capsule
      if (currentCapsule && currentCapsule.contains(e.target)) return;
      
      // If clicking anything near the chat box (buttons, arrows, SVGs)
      const clickableGroup = e.target.closest('button, [role="button"], svg');
      if (clickableGroup) {
        blockIfThreat(e);
      }
    }
  }, true);

  // ─── Periodic scan for the input element (may not exist on initial load) ───
  let monitoredEl = null;

  function tryAttachMonitor(focusEl = null) {
    // If the focused element allows text input, prioritize it over hardcoded selectors
    let el = focusEl;
    if (!el || !(el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
      el = findInputElement();
    }
    
    if (el && el !== monitoredEl) {
      monitoredEl = el;
      startMonitoring(el);
      console.log('[ARGUS PI] Attached to input element');
      // Notify popup that PI module is active
      safeSendMessage({ action: 'piModuleActive', site: window.location.hostname });
    }
  }

  // Fallback: intercept focus events. If the user clicks into an input field, attach to it.
  document.addEventListener('focusin', (e) => {
    const inputNode = e.target.closest && e.target.closest('textarea, input, [contenteditable="true"]');
    if (inputNode) {
      tryAttachMonitor(inputNode);
    }
  });

  // Try immediately, then periodically
  tryAttachMonitor();

  // Use MutationObserver to detect when input appears (e.g. SPA navigation)
  const bodyObserver = new MutationObserver(() => {
    if (!monitoredEl || !document.body.contains(monitoredEl)) {
      monitoredEl = null;
      tryAttachMonitor();
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });

  // Also poll every 2s as a fallback
  scanInterval = setInterval(() => {
    if (!monitoredEl || !document.body.contains(monitoredEl)) {
      monitoredEl = null;
      tryAttachMonitor();
    }
  }, 2000);

  // ─── Listen for messages from popup/background ─────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getPIStatus') {
      sendResponse({
        active: !!monitoredEl,
        site: window.location.hostname,
        currentVerdict: currentVerdict,
      });
      return false;
    }
    return false;
  });

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    if (scanInterval) clearInterval(scanInterval);
    if (bodyObserver) bodyObserver.disconnect();
    clearTimeout(debounceTimer);
  });

})();

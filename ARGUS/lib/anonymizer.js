// ARGUS Data Anonymization Agent
// Sanitizes threat event objects before they are written to Neo4j.
// Applies 5 strict rules: DROP → HASH → BUCKET → KEEP → ADD.

// ─── SHA-256 Hashing (Web Crypto API for Node 18+) ───────────────────────────
async function sha256(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(input));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function sha256Truncated(hash) {
  return `sha256:${hash.slice(0, 8)}...[truncated]`;
}

// ─── PII Detection Regexes ───────────────────────────────────────────────────
const PATTERNS = {
  email:      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  fullName:   /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,4}$/,
  creditCard: /\b(?:\d[ -]*?){13,19}\b/,
  phone:      /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}/,
  aadhaar:    /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  pan:        /\b[A-Z]{5}\d{4}[A-Z]\b/,
};

function containsPII(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return (
    PATTERNS.email.test(v) ||
    PATTERNS.fullName.test(v) ||
    PATTERNS.creditCard.test(v) ||
    PATTERNS.phone.test(v) ||
    PATTERNS.aadhaar.test(v) ||
    PATTERNS.pan.test(v)
  );
}

// ─── RULE 1: DROP Keys ──────────────────────────────────────────────────────
const DROP_KEY_FRAGMENTS = [
  'email', 'name', 'username', 'user_id', 'recipient',
  'body', 'text', 'content', 'message', 'subject',
  'password', 'token', 'session_id', 'user_agent',
  'city', 'street', 'full_url', 'query_params', 'path', 'cookie',
];

function shouldDropKey(key) {
  const lower = key.toLowerCase();
  return DROP_KEY_FRAGMENTS.some(frag => lower.includes(frag));
}

// ─── RULE 2: HASH Keys ─────────────────────────────────────────────────────
const HASH_KEY_FRAGMENTS = [
  'ip_address', 'sender_domain', 'domain', 'url_domain',
  'device_id', 'mac_address', 'device_fingerprint',
];

function shouldHashKey(key) {
  const lower = key.toLowerCase();
  return HASH_KEY_FRAGMENTS.some(frag => lower.includes(frag));
}

// ─── RULE 3: BUCKET Helpers ─────────────────────────────────────────────────
const TIMESTAMP_KEY_FRAGMENTS = [
  'timestamp', 'detected_at', 'detectedat', 'created_at',
  'createdat', 'updated_at', 'updatedat', 'expires_at',
  'expiresat', 'lastseen', 'last_seen', 'first_seen', 'firstseen',
  'enrichedat', 'enriched_at',
];

const GEO_KEY_FRAGMENTS = [
  'latitude', 'longitude', 'lat', 'lng', 'lon',
];

const COUNT_KEY_FRAGMENTS = [
  'age', 'count', 'attempts', 'hit_count', 'hitcount',
];

function isTimestampKey(key) {
  const lower = key.toLowerCase();
  return TIMESTAMP_KEY_FRAGMENTS.some(frag => lower.includes(frag));
}

function isGeoKey(key) {
  const lower = key.toLowerCase();
  return GEO_KEY_FRAGMENTS.some(frag => lower === frag || lower.endsWith('_' + frag));
}

function isCountKey(key) {
  const lower = key.toLowerCase();
  return COUNT_KEY_FRAGMENTS.some(frag => lower.includes(frag));
}

function bucketTimestamp(value) {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    // Round DOWN to nearest hour
    d.setMinutes(0, 0, 0);
    return d.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00Z');
  } catch {
    return value;
  }
}

function bucketGeo(value) {
  const n = parseFloat(value);
  if (isNaN(n)) return value;
  return Math.round(n * 100) / 100; // 2 decimal places
}

function bucketCount(value) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return value;
  return Math.round(n / 5) * 5; // Round to nearest 5
}

// ─── RULE 4: KEEP Keys (safe threat metadata) ──────────────────────────────
const KEEP_KEYS = new Set([
  'threat_type', 'threattype', 'score', 'confidence', 'severity',
  'action_taken', 'actiontaken', 'action',
  'spf_valid', 'spfvalid', 'dkim_valid', 'dkimvalid',
  'has_redirect', 'hasredirect', 'urgency_detected', 'urgencydetected',
  'entropy', 'domain_age_days', 'domainagedays', 'failed_attempts', 'failedattempts',
  'site', 'site_domain', 'sitedomain',
  'injection_category', 'injectioncategory', 'trigger_pattern', 'triggerpattern',
  'verdict', 'risk_score', 'riskscore',
  'detection_type', 'detectiontype', 'detection_source', 'detectionsource',
  'status', 'source', 'reason',
  'pipeline_version', 'pipelineversion',
  'node_id', 'nodeid', 'expires_at', 'expiresat',
  // Boolean / numeric feature scores
  'is_threat', 'isthreat', 'allow_override', 'allowoverride',
  'confidence_label', 'confidencelabel',
  'attack_technique', 'attacktechnique',
]);

function isKeptKey(key) {
  return KEEP_KEYS.has(key.toLowerCase());
}

// ─── RULE 5: ADD Metadata ───────────────────────────────────────────────────
function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Main Sanitizer ─────────────────────────────────────────────────────────

/**
 * Sanitizes a raw threat event object for safe Neo4j storage.
 * Applies rules strictly in order: DROP → HASH → BUCKET → KEEP → ADD.
 * 
 * @param {Object} rawEvent — the raw threat event JSON
 * @returns {Object} — the sanitized event (safe for graph storage)
 */
export async function sanitizeThreatEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== 'object') return {};

  const sanitized = {};

  for (const [key, value] of Object.entries(rawEvent)) {
    // Skip null / undefined
    if (value === null || value === undefined) continue;

    // ── RULE 1: DROP ──────────────────────────────────────────
    if (shouldDropKey(key)) {
      continue; // Completely removed
    }

    // If value is a string, check for PII patterns
    if (typeof value === 'string' && containsPII(value)) {
      continue; // DROP value containing PII
    }

    // ── RULE 4: KEEP (checked before HASH/BUCKET) ────────────
    if (isKeptKey(key)) {
      sanitized[key] = value;
      continue;
    }

    // ── RULE 2: HASH ──────────────────────────────────────────
    if (shouldHashKey(key)) {
      if (typeof value === 'string' && value.length > 0) {
        const hash = await sha256(value);
        sanitized[key] = sha256Truncated(hash);
      } else {
        sanitized[key] = value;
      }
      continue;
    }

    // ── RULE 3: BUCKET ────────────────────────────────────────
    if (isTimestampKey(key)) {
      sanitized[key] = bucketTimestamp(value);
      continue;
    }

    if (isGeoKey(key)) {
      sanitized[key] = bucketGeo(value);
      continue;
    }

    if (isCountKey(key)) {
      sanitized[key] = bucketCount(value);
      continue;
    }

    // ── Nested objects: recurse ───────────────────────────────
    if (typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = await sanitizeThreatEvent(value);
      continue;
    }

    // ── Arrays: sanitize each element ─────────────────────────
    if (Array.isArray(value)) {
      const cleanedArr = [];
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          cleanedArr.push(await sanitizeThreatEvent(item));
        } else if (typeof item === 'string') {
          if (!containsPII(item)) {
            cleanedArr.push(item);
          }
        } else {
          cleanedArr.push(item);
        }
      }
      sanitized[key] = cleanedArr;
      continue;
    }

    // ── Default: pass through (numbers, booleans, etc.) ───────
    sanitized[key] = value;
  }

  // ── RULE 5: ADD metadata ────────────────────────────────────
  const threatType = sanitized.threat_type || sanitized.threattype || sanitized.threatType || 'unknown';
  const timestamp  = sanitized.detectedAt || sanitized.detected_at || sanitized.timestamp || new Date().toISOString();
  const bucketedTs = bucketTimestamp(timestamp);
  const salt       = generateSalt();
  const nodeHash   = await sha256(`${threatType}|${bucketedTs}|${salt}`);

  sanitized.node_id          = `sha256:${nodeHash.slice(0, 8)}...[truncated]`;
  sanitized.pipeline_version = '1.0';

  // expires_at: today + 30 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  sanitized.expires_at = expiresAt.toISOString().split('T')[0];

  return sanitized;
}

/**
 * Batch-sanitize an array of threat events.
 * @param {Array<Object>} events
 * @returns {Array<Object>}
 */
export async function sanitizeBatch(events) {
  if (!Array.isArray(events)) return [];
  return Promise.all(events.map(e => sanitizeThreatEvent(e)));
}

export default sanitizeThreatEvent;

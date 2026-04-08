# ARGUS: Adaptive Risk and Generative Understanding System

ARGUS is a multi-module cyber defense platform focused on real-world, AI-era threats. It combines browser-side telemetry, AI-assisted threat analysis, deepfake frame inference, graph intelligence, and user-facing analytics into one integrated system.

## Technical Tags

`Next.js 16` `React 19` `NextAuth` `MongoDB` `Mongoose` `Neo4j` `Gemini API` `Flask` `PyTorch` `MTCNN` `OpenCV` `Manifest V3` `Threat Intelligence` `Prompt Injection Detection` `Deepfake Detection` `Explainable Security AI`

## 1) Vision and Scope

ARGUS aims to detect and explain high-risk digital threats through a combined strategy:

- URL threat classification
- Email phishing analysis
- Prompt-injection detection in AI chat interfaces
- Real-time deepfake signal detection
- Knowledge graph enrichment and campaign correlation
- Dashboard-grade analytics for visibility and response

The platform is built for practical security workflows where detection quality and explainability both matter.

## Core Features and Implementation Mapping

### URL Threat Detection

- Performs lexical and context-based URL risk analysis.
- Produces verdict, confidence score, reason, and signals.
- Supports persistent analytics entries for dashboard visibility.

Implemented in:

- `extension/background.js`
- `ARGUS/app/api/analyze-url/route.js`
- `ARGUS/app/api/security-analytics/route.js`

### Email Phishing Detection

- Evaluates sender, subject, body, and suspicious patterns.
- Combines AI and deterministic guardrails for explainable output.
- Integrates with campaign intelligence and event logging routes.

Implemented in:

- `extension/background.js`
- `ARGUS/app/api/analyze-email/route.js`
- `ARGUS/app/api/email-logs/route.js`

### Prompt Injection Defense

- Detects instruction override, jailbreak behavior, and prompt abuse patterns.
- Returns threat type, score, confidence, action, and evidence.
- Built for AI chatbot interaction surfaces.

Implemented in:

- `extension/content-prompt-injection.js`
- `ARGUS/app/api/analyze-prompt/route.js`

### Real-Time Deepfake Analysis

- Captures frames from active tabs via extension runtime.
- Uses face-driven and forensic fallback analysis modes.
- Adds temporal confidence tracking for stable decisions.

Implemented in:

- `extension/background.js`
- `backend/server.py`
- `backend/core/deepfake_detection.py`
- `backend/core/frame_analysis.py`
- `ARGUS/app/api/ingest-result/route.js`

### Graph Intelligence and Campaign Correlation

- Builds relationships between users, domains, interactions, and threat campaigns.
- Supports campaign clustering and node-level explanation.
- Bridges event-level detections to intelligence-level context.

Implemented in:

- `ARGUS/app/api/graph-data/route.js`
- `ARGUS/app/api/campaign-clusters/route.js`
- `ARGUS/app/api/explain-node/route.js`
- `ARGUS/app/api/user-domains/route.js`

### Analytics and Explainability

- Converts detections into operational dashboards and summaries.
- Preserves severity, confidence, signals, and recommended action metadata.
- Supports historical visibility and trend-based monitoring.

Implemented in:

- `ARGUS/app/api/security-analytics/route.js`
- `ARGUS/app/api/analytics/route.js`
- `ARGUS/lib/models/SecurityAnalytics.js`

## 2) Repository Map

From this folder (`argus`):

```text
argus/
	ARGUS/                     # Main Next.js platform (UI + APIs + auth + analytics)
	backend/                   # Flask deepfake inference backend for extension frame analysis
	chatbot/                   # Additional chatbot web app package and launcher
	extension/                 # Browser extension (Manifest V3)
	QUICK_FIX_TEST.md
	TEST_EMAIL_LOGGING.md
	report.html
```

Sibling service in workspace root:

```text
hf_deepfake/                 # Hugging Face Space-compatible deepfake API service
```

## 3) Technology Stack

### Main web platform (`ARGUS`)

- Next.js 16 (App Router)
- React 19
- NextAuth
- MongoDB + Mongoose
- Neo4j driver
- Gemini API (`@google/generative-ai`)
- Tailwind CSS + Radix UI + chart/graph libs

### Extension (`extension`)

- Manifest V3
- Background service worker
- Content scripts and overlay interfaces
- Popup control center

### Python backend (`backend`)

- Flask + Flask-CORS
- PyTorch + torchvision
- facenet-pytorch (MTCNN)
- OpenCV + PIL + numpy
- Forensic + temporal scoring pipeline

### Hugging Face service (`hf_deepfake`)

- Docker-based API deployment for `/analyze`, `/health`, `/reset`

## 4) System Architecture

At a high level:

1. Extension and web clients send threat context and telemetry.
2. Next.js API routes run classification, enrichment, and persistence logic.
3. Python backend processes video frames for deepfake probability and temporal consistency.
4. MongoDB stores analytics/history; Neo4j supports graph-based relationship intelligence.
5. Dashboard pages render analysis results and trends for users.

Core runtime split:

- Browser-facing control: `extension/*`
- Application and APIs: `ARGUS/app/*`, `ARGUS/app/api/*`
- ML inference service: `backend/server.py`, `backend/core/*`

## 5) Module Deep Dive

### A) ARGUS platform (`ARGUS`)

Main app areas:

- Landing and product pages
- Login/auth pages
- Dashboard and analytics pages
- Knowledge graph visualization pages
- Assistant and profile pages

Important app paths:

- `ARGUS/app/page.js`
- `ARGUS/app/dashboard/*`
- `ARGUS/app/analytics/*`
- `ARGUS/app/knowledge-graph/*`
- `ARGUS/app/profile/*`

Operational scripts:

```bash
cd ARGUS
npm install
npm run dev
npm run build
npm run start
npm run lint
npm run init-graph
npm run test-graph
npm run diagnose
```

### B) Browser extension (`extension`)

Primary files:

- `manifest.json` - permissions and entry points
- `background.js` - central event/router runtime
- `content.js` - in-page analysis bootstrap
- `content-interaction-tracker.js` - browsing interaction signals
- `content-prompt-injection.js` - prompt-injection client signals
- `popup.html`, `popup.js`, `popup.css` - operator interface
- `overlay.html`, `overlay-script.js`, `overlay.css` - in-page overlays
- `blocked.html`, `blocked-script.js` - block experience
- `analyzing.html`, `analyzing-script.js` - in-progress analysis UI

Core extension behavior:

- Monitors navigation events and suspicious patterns
- Sends URL/email/prompt/deepfake context to backend APIs
- Displays threat posture in popup and overlays
- Supports local backend URL configuration

### C) Deepfake inference backend (`backend`)

Entry point:

- `backend/server.py`

Core pipeline modules:

- `backend/core/deepfake_detection.py`
- `backend/core/frame_analysis.py`
- `backend/core/face_detection.py`
- `backend/core/model.py`

Processing strategy:

- Face detection + face model score when face exists
- Frame-level forensic analysis always available
- Temporal tracker for stable confidence output over consecutive frames
- Health/reset/stats endpoints for observability and control

### D) Chatbot module (`chatbot`)

Structure:

- `chatbot/package.json` (launcher wrapper)
- `chatbot/chatbot/*` (nested Next.js app)

Common commands:

```bash
cd chatbot
npm install
npm run install:app
npm run dev
```

### E) Hugging Face deepfake service (`../hf_deepfake`)

Designed for hosted inference compatibility with extension backend integrations.

Expected endpoints:

- `GET /`
- `GET /health`
- `POST /analyze`
- `POST /reset`

## 6) API Reference (Current Routes)

Routes below are based on current files in `ARGUS/app/api`.

### Analysis and detection

- `/api/analyze-url`
- `/api/analyze-email`
- `/api/analyze-prompt`
- `/api/ingest-result`
- `/api/security-analytics`
- `/api/email-logs`
- `/api/analytics`

### Graph and campaign intelligence

- `/api/graph-data`
- `/api/campaign-clusters`
- `/api/user-domains`
- `/api/explain-node`
- `/api/reset-graph`
- `/api/merkle-tree`

### Workflow and profile

- `/api/workflows/list`
- `/api/workflows/save`
- `/api/user/profile`

### Utility and testing

- `/api/anonymize-event`
- `/api/test-db`
- `/api/tmp-images/[filename]`

### Auth

- `/api/auth/[...nextauth]`

## 7) Data Models and Storage

MongoDB models currently present in `ARGUS/lib/models`:

- `User`
- `SecurityAnalytics`
- `AnalyticsData`
- `ThreatLog`
- `InteractionLog`
- `EnrichmentLog`
- `Campaign`
- `CampaignLog`
- `PastWorkflow`
- `Tool`

Storage responsibilities:

- Detection and analytics history
- Interaction and enrichment events
- Campaign-level aggregation
- Workflow persistence

Neo4j is used as an additional intelligence layer for relationship-driven graph queries and campaign clustering.

## 8) Environment Variables

Create `ARGUS/.env.local`.

```env
# NextAuth
NEXTAUTH_SECRET=replace_with_a_long_random_secret
NEXTAUTH_URL=http://localhost:3000

# Optional Google OAuth provider
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/argus

# Neo4j (optional but needed for full graph features)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=neo4j

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Optional fallback alias used in one route
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
```

## 9) Local Setup and Run Guide

### Prerequisites

- Node.js 20+
- npm
- Python 3.9+
- MongoDB
- Optional Neo4j for graph features

### Step 1: Run ARGUS web app

```bash
cd argus/ARGUS
npm install
npm run dev
```

Default: `http://localhost:3000`

### Step 2: Run deepfake backend

```bash
cd argus/backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Default: `http://localhost:5000`

### Step 3: Optional chatbot app

```bash
cd argus/chatbot
npm install
npm run install:app
npm run dev
```

## 10) Extension Setup

1. Open browser extensions page.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `argus/extension`.
5. Open extension popup and verify backend URL points to `http://localhost:5000`.

Recommended validation after load:

- Confirm popup loads module states.
- Confirm background worker has no startup errors.
- Confirm threat page overlays render.

## 11) Threat Analysis Workflows

### URL analysis

- Extension observes navigation and lexical risk indicators.
- URL context sent to web API.
- API computes verdict/score/reason and can persist analytics.

### Email analysis

- Email content and metadata signals are captured.
- API evaluates phishing/scam patterns with explainable output.

### Prompt-injection analysis

- Prompt text and context are evaluated for jailbreak/override indicators.
- Results include threat type, score, evidence, and action guidance.

### Deepfake analysis

- Extension captures frame snapshots from active tabs.
- Flask backend returns fake probability + temporal confidence.
- ARGUS ingest routes can store and stream outcome signals.

## 12) Development and Testing

### Useful commands

```bash
cd argus/ARGUS
npm run lint
npm run diagnose
npm run test-graph
```

### Manual checks

- Login session health in web app
- URL/email/prompt route response validity
- Deepfake backend `/health`, `/analyze`, `/stats`
- Dashboard data refresh and graph pages
- Extension popup + overlay rendering

## 13) Deployment Notes

### Local-first design

Current setup is optimized for local development and testing with localhost services.

### Hugging Face deepfake serving

For hosted deepfake inference, deploy `hf_deepfake` and update extension backend URL to your Space endpoint.

### Production hardening checklist

- Restrict CORS to trusted origins
- Remove or protect destructive/test endpoints
- Enforce strict auth on write routes
- Rate-limit sensitive APIs by identity and IP
- Add centralized logging and monitoring

## 14) Security Considerations

ARGUS contains advanced security logic but should still be treated as an evolving platform.

Before production usage:

- Audit auth enforcement per API route
- Ensure no client-trusted identity fallback in writes
- Protect graph reset and test endpoints
- Rotate and secure API secrets
- Apply strict extension permission review

## 15) Troubleshooting

### Web app does not start

- Re-run `npm install` inside `ARGUS`
- Verify `.env.local` exists
- Check MongoDB connectivity

### Extension shows no detections

- Check backend URL in popup settings
- Confirm `backend/server.py` is running
- Inspect extension service worker logs

### Deepfake endpoint errors

- Confirm Python env has all packages from `requirements.txt`
- Verify model files are present and compatible
- Check `/health` response first

### Graph features not working

- Validate Neo4j credentials
- Run `npm run init-graph`
- Run `npm run diagnose`

## 16) Credits

All major architecture, orchestration, implementation direction, and product shaping for this ARGUS project are credited to you, including:

- Platform concept and threat-defense strategy
- Multi-module integration across web app, extension, backend, and graph workflows
- Security analytics and explainability direction
- Deepfake + AI detection integration strategy
- Product documentation and presentation direction

If you want, I can also generate a second README variant optimized for:

- Hackathon submission style
- Portfolio/recruiter style
- Government/enterprise proposal style


<div align="center">

# ARGUS

### Adaptive Risk and Generative Understanding System

*Government-Grade AI Cyber Defense Intelligence Platform*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Flask](https://img.shields.io/badge/Flask-2.0-000000?style=flat-square&logo=flask)](https://flask.palletsprojects.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-1.9+-EE4C2C?style=flat-square&logo=pytorch)](https://pytorch.org/)
[![Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)
[![Neo4j](https://img.shields.io/badge/Neo4j-Graph-008CC1?style=flat-square&logo=neo4j)](https://neo4j.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Deployed](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)

**Real-Time Threat Detection | Deepfake Analysis | Knowledge Graph Intelligence | Explainable AI Security**

**Live Demo:** https://argus-dashboard-tan.vercel.app/

[Features](#core-capabilities) | [Quick Start](#quick-start) | [Architecture](#system-architecture) | [Tech Stack](#technology-stack)

</div>

---

## Overview

ARGUS is a unified cyber intelligence platform designed for high-risk environments including Finance, Defense, External Affairs, and Public Administration. It monitors emails, URLs, communication streams, and video content in real-time to detect AI-driven threats, explain risk evidence, and recommend mitigation actions before escalation.

Unlike generic security tools, ARGUS delivers deep threat intelligence through multi-vector analysis with persistent graph-based memory. The platform combines browser-side telemetry, AI-assisted classification, real-time deepfake detection, and knowledge graph correlation into a single integrated defense system.

---

## The Problem

| Challenge | Impact |
|-----------|--------|
| AI-Generated Deception | Deepfakes, synthetic voices, and fabricated communications bypass traditional detection |
| Fragmented Security Tools | Analysts juggle separate tools for email, URL, video, and behavioral analysis |
| Generic Detection Systems | Standard solutions cannot explain why something is suspicious or provide evidence trails |
| Coordinated Attack Campaigns | Individual threats are detected but campaign-level patterns go unnoticed |
| Prompt Injection Attacks | AI assistants within organizations are vulnerable to instruction hijacking |

## The Solution

ARGUS provides an integrated, explainability-first defense platform:

- **Multi-Vector Threat Detection** — Unified analysis of URLs, emails, video content, and AI prompts
- **Real-Time Deepfake Analysis** — Frame-by-frame video forensics with face detection and temporal tracking
- **Knowledge Graph Intelligence** — Neo4j-powered relationship mapping to correlate threats into campaigns
- **Explainable AI Decisions** — Every detection includes evidence trails, confidence scores, and recommended actions
- **Browser-Native Protection** — Chrome extension monitors browsing activity and blocks threats in real-time

---

## Core Capabilities

### Multi-Vector Threat Detection

ARGUS monitors six distinct threat vectors through a unified detection engine:

| Threat Vector | Detection Approach |
|---------------|-------------------|
| **Phishing Communications** | NLP models detect urgency language, authority abuse, and policy-inconsistent requests |
| **Malicious URLs** | Domain reputation, lexical entropy, redirect chains, and infrastructure analysis |
| **Deepfake Impersonation** | Face consistency analysis, temporal artifacts, and forensic video evaluation |
| **Prompt Injection** | Defense policies inspect AI prompts for instruction hijacking and data exfiltration |
| **Behavioral Anomalies** | User baselines highlight impossible travel, off-hours access, and privilege escalation |
| **AI-Generated Deception** | Classifiers flag synthetic narratives, fabricated directives, and misinformation |

### Real-Time Deepfake Detection

The deepfake detection engine uses a dual-signal approach that works with or without visible faces:

**Face-Based Analysis**
- MTCNN face detection extracts facial regions from video frames
- PyTorch neural network evaluates face authenticity
- EfficientNet backbone provides robust feature extraction

**Forensic Frame Analysis**
- Compression artifact detection identifies manipulation signatures
- Temporal consistency tracking across consecutive frames
- Rolling confidence averaging for stable verdicts

**Output Signals**
- Fake probability (0-100%)
- Confidence level (REAL / FAKE / UNCERTAIN)
- Stability score across frame sequence
- Processing time metrics

### Explainable AI Security

Every threat detection includes four layers of explainability:

| Layer | Description |
|-------|-------------|
| **Why Suspicious** | Highlights abnormal patterns that violate policy, communication norms, or baselines |
| **Evidence Trail** | Provides concrete indicators: suspicious headers, URL chains, model forensics, timeline context |
| **Confidence Score** | Calibrated probability with model agreement levels for risk-based decisions |
| **Recommended Action** | Suggests immediate actions: isolate, block, verify identity, trigger workflow, escalate to SOC |

### Knowledge Graph Intelligence

Neo4j-powered relationship mapping connects individual detections into campaign-level intelligence:

**Node Types**
- Users, Domains, IP Addresses, Organizations, Threats, Attack Campaigns

**Relationship Tracking**
- User visited domain patterns
- Threat correlation across domains
- Campaign clustering by shared infrastructure
- Brand impersonation detection

**Campaign Detection**
- Automatic clustering by shared IP, registrar, or target brand
- Attack pattern recognition across multiple indicators
- Threat actor attribution support

### Browser Extension

The Chrome extension (Manifest V3) provides real-time protection during browsing:

**Active Monitoring**
- Navigation event interception
- Email interface scanning (Gmail, Outlook)
- AI chat interface monitoring
- Form submission tracking

**Threat Response**
- In-page warning overlays for suspicious content
- Full-page blocks for malicious domains
- Real-time deepfake analysis via popup controls
- Backend connection status and configuration

**User Interface**
- Popup dashboard with threat module status
- Configurable backend URL
- Dark/light theme support
- Session event tracking

---

## Department Coverage

ARGUS is architected for high-risk public sector operations:

| Department | Focus Areas | Use Cases |
|------------|-------------|-----------|
| **Ministry of Finance** | Budget systems, treasury portals, procurement | Invoice fraud, executive impersonation, payment-diversion phishing |
| **Ministry of Defense** | Secure comms, command dashboards, classified endpoints | Deepfake command impersonation, privileged access anomalies, social engineering |
| **External Affairs** | Diplomatic mailboxes, mission tools, public communications | Deception campaigns, spoofed diplomatic requests, manipulated cross-border content |
| **Public Administration** | e-Governance portals, identity systems, inter-department platforms | Citizen-service abuse, credential misuse, insider anomalies |

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER EXTENSION                           │
│  Manifest V3 | Service Worker | Content Scripts | Popup UI     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │     URL      │ │    Email     │ │   Deepfake   │            │
│  │   Monitor    │ │   Scanner    │ │   Capture    │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ARGUS WEB PLATFORM                           │
│  Next.js 16 + React 19 + NextAuth + Tailwind CSS               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  Dashboard   │ │  Knowledge   │ │  Analytics   │            │
│  │   & Alerts   │ │    Graph     │ │   Reports    │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API & AI LAYER                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  URL/Email   │ │   Prompt     │ │   Gemini     │            │
│  │  Analysis    │ │  Injection   │ │ Explanation  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌───────────────────┐ ┌───────────────┐ ┌───────────────┐
│   FLASK BACKEND   │ │    MongoDB    │ │     Neo4j     │
│  ┌─────────────┐  │ │               │ │               │
│  │   MTCNN     │  │ │  Analytics    │ │   Knowledge   │
│  │  Detection  │  │ │  Threat Logs  │ │     Graph     │
│  │  PyTorch    │  │ │  User Data    │ │   Campaigns   │
│  │  Forensics  │  │ │               │ │               │
│  └─────────────┘  │ │               │ │               │
└───────────────────┘ └───────────────┘ └───────────────┘
```

### Data Flow

1. **Browser Capture** — Extension monitors navigation, emails, video content, and AI chats
2. **API Analysis** — Next.js routes process threats with Gemini AI classification
3. **Deepfake Processing** — Flask backend performs frame-level video forensics
4. **Storage** — MongoDB stores analytics and logs; Neo4j builds relationship graph
5. **Visualization** — Dashboard displays real-time alerts, graphs, and trend analysis

---

## Technology Stack

### Frontend Platform

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16.1.6 (App Router) |
| UI Library | React 19.2.0 |
| Styling | TailwindCSS 4.2.1 |
| Components | Radix UI (Avatar, Dialog, Dropdown, Tabs, Popover) |
| State | Zustand 5.0.8 |
| Visualization | React Force Graph 2D/3D, ReactFlow 11.11.4, Recharts 2.15.4 |
| 3D Rendering | Three.js 0.180.0, React Three Fiber |
| Animation | Framer Motion 12.23.24, GSAP 3.13.0 |

### Backend Services

| Component | Technology |
|-----------|------------|
| Web API | Next.js API Routes |
| Authentication | NextAuth 4.24.13, bcryptjs |
| AI Classification | Google Generative AI 0.24.1 (Gemini) |
| Deepfake Detection | Flask 2.0.0+, PyTorch 1.9.0+, MTCNN |
| Computer Vision | OpenCV 4.5.3+, Pillow 10.4.0, albumentations |

### Data Layer

| Component | Technology |
|-----------|------------|
| Primary Database | MongoDB 9.0.0 (Mongoose) |
| Graph Database | Neo4j 6.0.1 |
| Domain Enrichment | WHOIS (whois-json 2.0.4), GeoIP (geoip-lite 1.4.10) |

### Browser Extension

| Component | Technology |
|-----------|------------|
| Manifest | Manifest V3 |
| Runtime | Service Worker + Content Scripts |
| Permissions | storage, tabs, scripting, webNavigation, webRequest, notifications |

---

## Key Features

### Live Dashboard

The security dashboard provides real-time visibility into threat activity:

- **Server-Sent Events** — Live detection results stream to connected dashboards
- **Probability History** — Rolling visualization of deepfake confidence over time
- **Risk Distribution** — Breakdown of safe, low, medium, high, and critical detections
- **Timeline Analysis** — Daily aggregation of interactions and threats
- **Top Risky Domains** — Ranked list of suspicious domains by risk score

### Security Analytics

Comprehensive analytics across all detection types:

- Total interactions and unique domains tracked
- Threats detected with severity breakdown
- Active campaign identification
- Brand impersonation attempts
- Historical trend monitoring

### Domain Enrichment

Automatic enrichment for analyzed domains:

- **WHOIS Data** — Domain age, registrar, creation/expiration dates
- **DNS Records** — IP addresses, nameservers
- **Geolocation** — Country, region, city, coordinates
- **Hosting Provider** — Infrastructure identification
- **Brand Impersonation** — Fuzzy matching against known brands
- **Risk Scoring** — Composite score based on multiple factors

### Data Anonymization

Five-layer anonymization for privacy-compliant graph storage:

1. **DROP** — Remove PII fields (email, name, password, content)
2. **HASH** — SHA-256 hash of IPs, domains, device IDs
3. **BUCKET** — Timestamp bucketing, geolocation generalization
4. **KEEP** — Preserve threat metadata (verdict, severity, source)
5. **ADD** — Synthetic IDs, anonymization flags, retention metadata

### Cryptographic Integrity

Merkle tree implementation for detection audit trails:

- Tamper-proof event logging
- Verifiable threat history
- Integrity verification for compliance

---

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Python 3.9+
- MongoDB (local or Atlas)
- Neo4j (optional, for graph features)
- Google Gemini API key

### 1. Start ARGUS Web Platform

```bash
cd argus/ARGUS
npm install
npm run dev
```

Access at: `http://localhost:3000`

### 2. Start Deepfake Backend

```bash
cd argus/backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
python server.py
```

Access at: `http://localhost:5000`

### 3. Load Browser Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `argus/extension` directory
5. Click extension icon and verify backend URL is `http://localhost:5000`

### 4. Initialize Knowledge Graph (Optional)

```bash
cd argus/ARGUS
npm run init-graph
npm run test-graph
```

---

## Environment Configuration

Create `ARGUS/.env.local`:

```env
# Authentication
NEXTAUTH_SECRET=your_long_random_secret_here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/argus

# Neo4j Graph Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=neo4j

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key
```

---

## Repository Structure

```
argus/
├── ARGUS/                      # Next.js web platform
│   ├── app/                    # Pages and API routes
│   │   ├── api/                # 20+ API endpoints
│   │   ├── dashboard/          # Security dashboard
│   │   ├── analytics/          # Analytics views
│   │   ├── knowledge-graph/    # Graph visualization
│   │   ├── assistant/          # AI assistant
│   │   └── profile/            # User management
│   ├── components/             # React components
│   ├── lib/                    # Utilities and models
│   │   ├── models/             # 10 MongoDB schemas
│   │   ├── auth-options.js     # NextAuth config
│   │   ├── mongodb.js          # Database connection
│   │   ├── neo4j.js            # Graph driver
│   │   ├── graph-builder.js    # Graph operations
│   │   ├── domain-enrichment.js # WHOIS/DNS/GeoIP
│   │   └── anonymizer.js       # PII protection
│   └── scripts/                # Utility scripts
│
├── backend/                    # Flask deepfake service
│   ├── server.py               # Flask application
│   ├── core/
│   │   ├── deepfake_detection.py
│   │   ├── face_detection.py
│   │   ├── frame_analysis.py
│   │   └── model.py
│   └── requirements.txt
│
├── extension/                  # Chrome extension
│   ├── manifest.json           # Manifest V3 config
│   ├── background.js           # Service worker
│   ├── content.js              # Primary content script
│   ├── content-interaction-tracker.js
│   ├── content-prompt-injection.js
│   ├── popup.html/js/css       # Extension popup
│   ├── overlay.html/js/css     # In-page warnings
│   ├── blocked.html            # Block page
│   └── analyzing.html          # Analysis progress
│
└── chatbot/                    # Optional chatbot module
```

---

## Data Models

ARGUS uses 10 MongoDB collections for operational data:

| Model | Purpose |
|-------|---------|
| **User** | Authentication, profile, KYC data, API keys |
| **SecurityAnalytics** | Detection events with verdicts, scores, signals |
| **ThreatLog** | Threat identification and action tracking |
| **InteractionLog** | User browsing interactions and risk indicators |
| **EnrichmentLog** | WHOIS, DNS, GeoIP, and brand impersonation data |
| **CampaignLog** | Attack campaign clustering and correlation |
| **Campaign** | Workflow state and execution logs |
| **AnalyticsData** | Time-series analytics |
| **PastWorkflow** | Completed workflow history |
| **Tool** | AI agent capability registry |

---

## Development Commands

```bash
# ARGUS Platform
cd ARGUS
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run init-graph   # Initialize Neo4j schema
npm run test-graph   # Test graph connectivity
npm run diagnose     # Diagnose graph issues

# Backend Service
cd backend
python server.py     # Start Flask server
```

---

## Security Considerations

### Production Hardening

- Remove test endpoints (`/api/test-db`, `/api/reset-graph`)
- Implement strict CORS policies
- Enable HTTPS for all services
- Add rate limiting to public endpoints
- Rotate API keys regularly
- Implement centralized logging and monitoring

### Authentication

- bcryptjs password hashing (10 salt rounds)
- JWT session tokens (30-day expiry)
- NextAuth middleware protection
- Google OAuth integration support

---

## Troubleshooting

### Web App Issues

- Re-run `npm install` inside `ARGUS`
- Verify `.env.local` exists with all required variables
- Check MongoDB connectivity

### Extension Issues

- Verify backend URL in popup settings
- Confirm `backend/server.py` is running
- Check service worker logs in `chrome://extensions/`

### Deepfake Backend Issues

- Confirm Python environment has all packages from `requirements.txt`
- Verify model files are present
- Test `/health` endpoint first

### Graph Features

- Validate Neo4j credentials in `.env.local`
- Run `npm run init-graph` to create schema
- Run `npm run diagnose` for detailed diagnostics

---

## License

This project is proprietary software.

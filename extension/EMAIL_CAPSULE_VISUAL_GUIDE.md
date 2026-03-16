# Email Warning Capsule - Visual Guide

## Capsule Appearance

### Malicious Email (Red/Danger)
```
┌────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ╔═══════════════════════════════════════════════════════╗    │
│   ║  👁️  ARGUS — Malicious Email Detected          [3]  ×  ║    │
│   ║      3 threats found                                   ║    │
│   ╚═══════════════════════════════════════════════════════╝    │
│                                                                  │
│   Color: Red (#ef4444)                                          │
│   Border: 2px solid red                                         │
│   Shadow: Glowing red with pulse animation                      │
│   Auto-hide: 15 seconds                                         │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### Suspicious Email (Orange/Warning)
```
┌────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ╔═══════════════════════════════════════════════════════╗    │
│   ║  👁️  ARGUS — Suspicious Email Detected         [1]  ×  ║    │
│   ║      1 threat found                                    ║    │
│   ╚═══════════════════════════════════════════════════════╝    │
│                                                                  │
│   Color: Orange (#f59e0b)                                       │
│   Border: 2px solid orange                                      │
│   Shadow: Glowing orange (no pulse)                             │
│   Auto-hide: 10 seconds                                         │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  [Eye Icon]  [Title Text]                    [Badge]  [Close]   │
│              [Subtitle]                                          │
│                                                                   │
│  ┌────────┐  ┌──────────────────────────┐  ┌──────┐  ┌──────┐ │
│  │   👁️   │  │ ARGUS — Malicious Email  │  │  3   │  │  ×   │ │
│  │        │  │ Detected                 │  │      │  │      │ │
│  │ 24x24  │  │ 3 threats found          │  │ 28px │  │ 28px │ │
│  │  SVG   │  │                          │  │ round│  │ round│ │
│  └────────┘  └──────────────────────────┘  └──────┘  └──────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Positioning

```
Browser Window
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│                    [ARGUS Email Capsule]                         │
│                    ↑ 20px from top                               │
│                    ↑ Centered horizontally                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                           │   │
│  │                  Email Content                            │   │
│  │                                                           │   │
│  │  From: suspicious@phishing.tk                            │   │
│  │  Subject: Urgent: Verify Your Account                    │   │
│  │                                                           │   │
│  │  Dear User,                                               │   │
│  │                                                           │   │
│  │  Click here ⚠ MALICIOUS to verify your account...       │   │
│  │              ↑ Inline badge on link                      │   │
│  │                                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Animation Sequence

### 1. Entrance (0.4s)
```
Frame 1 (0.0s):  Invisible, 20px above final position
                 opacity: 0, translateY(-20px)

Frame 2 (0.2s):  Fading in, moving down
                 opacity: 0.5, translateY(-10px)

Frame 3 (0.4s):  Fully visible at final position
                 opacity: 1, translateY(0)
```

### 2. Pulse (Malicious only, 2s loop)
```
Frame 1 (0.0s):  Normal shadow
                 box-shadow: 0 0 20px rgba(239,68,68,0.4)

Frame 2 (1.0s):  Glowing shadow
                 box-shadow: 0 0 30px rgba(239,68,68,0.8)

Frame 3 (2.0s):  Back to normal
                 box-shadow: 0 0 20px rgba(239,68,68,0.4)
```

### 3. Hover Effect
```
Normal:          scale(1.0)
                 box-shadow: 0 8px 32px rgba(0,0,0,0.4)

Hover:           scale(1.02)
                 box-shadow: 0 12px 40px rgba(0,0,0,0.5)
                 cursor: pointer
```

### 4. Exit (0.3s)
```
Frame 1 (0.0s):  Fully visible
                 opacity: 1, translateY(0)

Frame 2 (0.15s): Fading out, moving up
                 opacity: 0.5, translateY(-10px)

Frame 3 (0.3s):  Invisible, removed from DOM
                 opacity: 0, translateY(-20px)
```

## Color Schemes

### Malicious (Danger)
```
Background:  rgba(239, 68, 68, 0.95)  // Red with 95% opacity
Border:      #ef4444                   // Solid red
Text:        #ffffff                   // White
Badge BG:    #ffffff                   // White
Badge Text:  rgba(239, 68, 68, 0.95)  // Red
Shadow:      0 0 20px rgba(239,68,68,0.4) // Red glow
```

### Suspicious (Warning)
```
Background:  rgba(245, 158, 11, 0.95) // Orange with 95% opacity
Border:      #f59e0b                   // Solid orange
Text:        #ffffff                   // White
Badge BG:    #ffffff                   // White
Badge Text:  rgba(245, 158, 11, 0.95) // Orange
Shadow:      0 0 20px rgba(245,158,11,0.4) // Orange glow
```

## Responsive Behavior

### Desktop (> 600px)
```
Width:       Auto (content-based)
Max-width:   600px
Padding:     12px 24px
Font-size:   Title: 13px, Subtitle: 11px
```

### Mobile (< 600px)
```
Width:       90% of viewport
Max-width:   600px
Padding:     12px 24px (same)
Font-size:   Title: 13px, Subtitle: 11px (same)
```

## Interaction States

### Default State
```
┌─────────────────────────────────────────────────┐
│ 👁️  ARGUS — Malicious Email Detected    [3]  × │
│     3 threats found                             │
└─────────────────────────────────────────────────┘
Cursor: pointer
```

### Hover State
```
┌─────────────────────────────────────────────────┐
│ 👁️  ARGUS — Malicious Email Detected    [3]  × │
│     3 threats found                             │
└─────────────────────────────────────────────────┘
Scale: 1.02 (slightly larger)
Shadow: Enhanced glow
Cursor: pointer
```

### Close Button Hover
```
┌─────────────────────────────────────────────────┐
│ 👁️  ARGUS — Malicious Email Detected    [3]  ⊗ │
│     3 threats found                             │
└─────────────────────────────────────────────────┘
Close button background: Lighter (30% opacity)
Cursor: pointer
```

### Click State (Alert Dialog)
```
┌─────────────────────────────────────────────────┐
│                                                   │
│  ARGUS Email Threat Detection                    │
│                                                   │
│  🚨 Malicious link: http://paypa1-verify.tk/... │
│  — Uses a high-risk top-level domain             │
│                                                   │
│  Check the email content for suspicious links    │
│  marked with warning badges.                     │
│                                                   │
│                              [OK]                 │
└─────────────────────────────────────────────────┘
```

## Z-Index Layering

```
Layer 5: Email Capsule (z-index: 999998)
         ↑ Appears above email content
         ↓ Below deepfake overlay

Layer 4: Deepfake Overlay (z-index: 999999)
         ↑ Highest priority

Layer 3: Email Content (z-index: auto)
         ↑ Normal page content

Layer 2: Link Badges (z-index: auto)
         ↑ Inline with links

Layer 1: Page Background (z-index: auto)
         ↑ Base layer
```

## Typography

```
Title:
  Font: 'Segoe UI', system-ui, sans-serif
  Size: 13px
  Weight: 800 (Extra Bold)
  Letter-spacing: 0.05em
  Color: #ffffff

Subtitle:
  Font: 'Segoe UI', system-ui, sans-serif
  Size: 11px
  Weight: 400 (Regular)
  Opacity: 0.9
  Color: #ffffff

Badge:
  Font: 'Segoe UI', system-ui, sans-serif
  Size: 14px
  Weight: 800 (Extra Bold)
  Color: Inverted (red/orange)
```

## Spacing & Layout

```
Capsule:
  Padding: 12px 24px
  Gap: 12px (between elements)
  Border-radius: 24px
  Border-width: 2px

Eye Icon:
  Size: 24x24px
  Flex-shrink: 0

Content:
  Flex: 1
  Min-width: 0
  Gap: 2px (title to subtitle)

Badge:
  Size: 28x28px
  Border-radius: 50%
  Flex-shrink: 0

Close Button:
  Size: 28x28px
  Border-radius: 50%
  Flex-shrink: 0
```

## Example Scenarios

### Scenario 1: Single Malicious Link
```
Email contains: http://192.168.1.1/admin

Capsule displays:
┌─────────────────────────────────────────────────┐
│ 👁️  ARGUS — Malicious Email Detected    [1]  × │
│     1 threat found                              │
└─────────────────────────────────────────────────┘

Click shows:
"🚨 Malicious link: http://192.168.1.1/admin
— Uses raw IP address instead of a trusted domain"
```

### Scenario 2: Multiple Suspicious Links
```
Email contains:
- http://verify-account.xyz/login
- http://secure-update.tk/confirm

Capsule displays:
┌─────────────────────────────────────────────────┐
│ 👁️  ARGUS — Suspicious Email Detected   [2]  × │
│     2 threats found                             │
└─────────────────────────────────────────────────┘

Click shows:
"⚠ Suspicious link: http://verify-account.xyz/login
— Uses a high-risk top-level domain"
```

### Scenario 3: Phishing Keywords
```
Email contains:
"Urgent: Your account will be suspended"

Capsule displays:
┌─────────────────────────────────────────────────┐
│ 👁️  ARGUS — Suspicious Email Detected   [1]  × │
│     1 threat found                              │
└─────────────────────────────────────────────────┘

Click shows:
"Phishing keywords detected: 'urgent', 'account', 'suspended'"
```

## Browser Rendering

The capsule is rendered as a single DOM element with inline styles, ensuring:
- ✅ No external CSS dependencies
- ✅ No layout shift (fixed positioning)
- ✅ No content blocking (can be dismissed)
- ✅ Consistent appearance across browsers
- ✅ Fast rendering (< 100ms)
- ✅ Smooth animations (GPU-accelerated)

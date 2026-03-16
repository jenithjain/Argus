# ARGUS Knowledge Graph - User Guide

## Overview
The Knowledge Graph provides a visual representation of threat intelligence data, showing relationships between domains, IPs, threats, and attack campaigns.

## Features Implemented

### 1. **Node Click Details Sidebar** ✅
- Click any node to open a detailed sidebar
- Shows node properties (risk score, domain age, location, etc.)
- Displays AI-powered explanations using Gemini
- Toggle sidebar visibility with the "Show/Hide Sidebar" button

### 2. **Filtering System** ✅
- Click "Filters" button in the header to show filter panel
- Filter by node type (User, Domain, IP, Threat, etc.)
- Multiple filters can be active simultaneously
- "Clear All" button to reset filters
- Active filter count badge

### 3. **Dark/Light Mode** ✅
- Fully integrated with the app's theme system
- Uses BackgroundWrapper with LiquidEther effect
- Consistent styling with landing page
- Theme toggle in header

### 4. **Enhanced UI** ✅
- Glassmorphism effects with backdrop blur
- Improved card opacity (95% vs 90%)
- Better visual hierarchy
- Smooth transitions and animations

## How to Use

### Testing the System
1. Run the test script:
   ```bash
   cd argus/ARGUS
   node test-knowledge-graph-v2.js
   ```

2. Visit: http://localhost:3000/knowledge-graph

### Interacting with the Graph

#### View Node Details
1. Click any node in the graph
2. Sidebar opens automatically with:
   - Node type and properties
   - Risk score visualization
   - Location information (for IPs)
   - AI-generated explanation

#### Filter Nodes
1. Click "Filters" button in header
2. Select node types to display
3. Graph updates in real-time
4. Click "Clear All" to reset

#### Toggle Views
- **2D View**: Better for detailed analysis, supports centering on nodes
- **3D View**: Immersive visualization, better for understanding relationships

#### Live Updates
- Click "Live/Paused" to enable auto-refresh (every 5 seconds)
- Manual refresh with "Refresh" button

### Node Types & Colors
- 🔵 **User** - Blue (#3b82f6)
- 🟠 **Domain** - Orange (#f97316)
- 🟣 **IP** - Purple (#a855f7)
- 🟢 **Organization** - Green (#22c55e)
- 🔴 **Threat** - Red (#ef4444)
- 🔴 **AttackCampaign** - Dark Red (#991b1b)
- 🔵 **Registrar** - Cyan (#06b6d4)
- 🟣 **HostingProvider** - Violet (#8b5cf6)
- ⚪ **InteractionEvent** - Gray (#64748b)

## Test Scenarios Included

The test script includes 5 realistic scenarios:

1. **Phishing Campaign - PayPal** (3 domains)
2. **Phishing Campaign - Amazon** (2 domains)
3. **Legitimate Sites** (3 domains)
4. **Malware Distribution** (2 domains)
5. **Social Engineering** (2 domains)

## API Endpoints Tested

- `POST /api/interaction` - Record user interactions
- `GET /api/graph-data` - Fetch graph nodes and links
- `GET /api/campaign-clusters` - Get attack campaigns
- `POST /api/explain-node` - Get AI explanation for a node
- `GET /api/analytics` - Fetch analytics data

## Troubleshooting

### Sidebar Not Opening
- Ensure you're clicking directly on a node (not empty space)
- Check browser console for errors
- Try toggling sidebar with the button in header

### Filters Not Working
- Click "Filters" button to show filter panel
- Ensure at least one filter is selected
- Use "Clear All" to reset if needed

### AI Explanations Not Loading
- Check that GEMINI_API_KEY is set in .env.local
- Fallback explanations are provided if API fails
- Check browser console for API errors

### Graph Not Centering
- Centering only works in 2D view
- Switch to 2D view before clicking nodes
- 3D view doesn't support programmatic centering

## Performance Tips

1. **Use Filters**: Reduce visual complexity by filtering node types
2. **Pause Live Updates**: Disable auto-refresh when analyzing
3. **2D for Analysis**: Use 2D view for detailed work
4. **3D for Overview**: Use 3D view for understanding relationships

## Next Steps

- Add more test data with `test-knowledge-graph-v2.js`
- Explore different filter combinations
- Analyze attack campaigns in the sidebar
- Use AI explanations to understand threats

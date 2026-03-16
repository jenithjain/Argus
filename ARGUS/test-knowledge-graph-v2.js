/**
 * ARGUS Knowledge Graph Test Script v2
 * Tests the threat intelligence knowledge graph system with realistic data
 */

const BASE_URL = 'http://localhost:3000';

// Test data with various threat scenarios
const testScenarios = [
  {
    name: 'Phishing Campaign - PayPal',
    interactions: [
      { url: 'https://paypal-secure-login.xyz', riskScore: 85, threatType: 'phishing' },
      { url: 'https://paypal-verify-account.tk', riskScore: 90, threatType: 'phishing' },
      { url: 'https://secure-paypal-login.ml', riskScore: 88, threatType: 'phishing' },
    ]
  },
  {
    name: 'Phishing Campaign - Amazon',
    interactions: [
      { url: 'https://amazon-account-verify.xyz', riskScore: 82, threatType: 'phishing' },
      { url: 'https://secure-amazon-login.top', riskScore: 87, threatType: 'phishing' },
    ]
  },
  {
    name: 'Legitimate Sites',
    interactions: [
      { url: 'https://github.com/user/repo', riskScore: 5, threatType: null },
      { url: 'https://stackoverflow.com/questions', riskScore: 3, threatType: null },
      { url: 'https://www.google.com', riskScore: 2, threatType: null },
    ]
  },
  {
    name: 'Malware Distribution',
    interactions: [
      { url: 'https://free-software-download.tk', riskScore: 95, threatType: 'malware' },
      { url: 'https://crack-tools.xyz', riskScore: 92, threatType: 'malware' },
    ]
  },
  {
    name: 'Social Engineering',
    interactions: [
      { url: 'https://urgent-security-alert.com', riskScore: 78, threatType: 'social_engineering' },
      { url: 'https://verify-your-identity-now.net', riskScore: 81, threatType: 'social_engineering' },
    ]
  }
];

// Helper function to send interaction
async function sendInteraction(url, riskScore, threatType) {
  try {
    const response = await fetch(`${BASE_URL}/api/interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        action: 'visit',
        riskScore,
        threatType,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper function to fetch graph data
async function fetchGraphData() {
  try {
    const response = await fetch(`${BASE_URL}/api/graph-data`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch graph data: ${error.message}`);
  }
}

// Helper function to fetch campaigns
async function fetchCampaigns() {
  try {
    const response = await fetch(`${BASE_URL}/api/campaign-clusters`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch campaigns: ${error.message}`);
  }
}

// Helper function to test node explanation
async function testNodeExplanation(node) {
  try {
    const response = await fetch(`${BASE_URL}/api/explain-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, explanation: data.explanation };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Main test function
async function runTests() {
  console.log('🚀 ARGUS Knowledge Graph Test Suite v2\n');
  console.log('=' .repeat(60));

  // Test 1: Send interactions
  console.log('\n📡 TEST 1: Sending Test Interactions');
  console.log('-'.repeat(60));
  
  let successCount = 0;
  let failCount = 0;

  for (const scenario of testScenarios) {
    console.log(`\n  Scenario: ${scenario.name}`);
    for (const interaction of scenario.interactions) {
      const result = await sendInteraction(
        interaction.url,
        interaction.riskScore,
        interaction.threatType
      );
      
      if (result.success) {
        console.log(`    ✓ ${interaction.url} (Risk: ${interaction.riskScore})`);
        successCount++;
      } else {
        console.log(`    ✗ ${interaction.url} - ${result.error}`);
        failCount++;
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`\n  Summary: ${successCount} succeeded, ${failCount} failed`);

  // Wait for domain enrichment
  console.log('\n⏳ Waiting for domain enrichment (5 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 2: Fetch and validate graph data
  console.log('\n📊 TEST 2: Fetching Graph Data');
  console.log('-'.repeat(60));
  
  try {
    const graphData = await fetchGraphData();
    console.log(`  ✓ Nodes: ${graphData.nodes?.length || 0}`);
    console.log(`  ✓ Links: ${graphData.links?.length || 0}`);
    
    // Show node type breakdown
    const nodeTypes = {};
    graphData.nodes?.forEach(node => {
      nodeTypes[node.label] = (nodeTypes[node.label] || 0) + 1;
    });
    
    console.log('\n  Node Type Breakdown:');
    Object.entries(nodeTypes).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count}`);
    });

    // Test filtering
    console.log('\n  Testing Filters:');
    const threatNodes = graphData.nodes?.filter(n => n.label === 'Threat') || [];
    console.log(`    - Threat nodes: ${threatNodes.length}`);
    const domainNodes = graphData.nodes?.filter(n => n.label === 'Domain') || [];
    console.log(`    - Domain nodes: ${domainNodes.length}`);
    
  } catch (error) {
    console.log(`  ✗ ${error.message}`);
  }

  // Test 3: Fetch and validate campaigns
  console.log('\n🎯 TEST 3: Fetching Attack Campaigns');
  console.log('-'.repeat(60));
  
  try {
    const campaignData = await fetchCampaigns();
    console.log(`  ✓ Campaigns detected: ${campaignData.campaigns?.length || 0}`);
    
    if (campaignData.campaigns && campaignData.campaigns.length > 0) {
      console.log('\n  Campaign Details:');
      campaignData.campaigns.forEach((campaign, idx) => {
        console.log(`\n    Campaign ${idx + 1}:`);
        console.log(`      - Domains: ${campaign.domainCount}`);
        console.log(`      - Shared Infrastructure: ${campaign.sharedInfrastructure?.join(', ') || 'N/A'}`);
        console.log(`      - Sample domains:`);
        campaign.domains.slice(0, 3).forEach(domain => {
          console.log(`        • ${domain}`);
        });
      });
    }
  } catch (error) {
    console.log(`  ✗ ${error.message}`);
  }

  // Test 4: Test AI explanations
  console.log('\n🧠 TEST 4: Testing AI Node Explanations');
  console.log('-'.repeat(60));
  
  try {
    const graphData = await fetchGraphData();
    
    // Test explanation for different node types
    const testNodes = [
      graphData.nodes?.find(n => n.label === 'Domain'),
      graphData.nodes?.find(n => n.label === 'Threat'),
      graphData.nodes?.find(n => n.label === 'IP'),
    ].filter(Boolean);

    for (const node of testNodes) {
      console.log(`\n  Testing ${node.label}: ${node.name || node.id}`);
      const result = await testNodeExplanation(node);
      
      if (result.success) {
        console.log(`    ✓ Explanation received (${result.explanation.length} chars)`);
        console.log(`    Preview: ${result.explanation.substring(0, 100)}...`);
      } else {
        console.log(`    ✗ Failed: ${result.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.log(`  ✗ ${error.message}`);
  }

  // Test 5: Analytics endpoint
  console.log('\n📈 TEST 5: Testing Analytics Endpoint');
  console.log('-'.repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}/api/analytics?range=7d`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const analytics = await response.json();
    
    console.log(`  ✓ Total interactions: ${analytics.totalInteractions || 0}`);
    console.log(`  ✓ Total threats: ${analytics.totalThreats || 0}`);
    console.log(`  ✓ Average risk score: ${analytics.averageRiskScore?.toFixed(2) || 0}`);
    console.log(`  ✓ Timeline entries: ${analytics.timeline?.length || 0}`);
  } catch (error) {
    console.log(`  ✗ ${error.message}`);
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test Suite Complete!');
  console.log('='.repeat(60));
  console.log('\n📍 Next Steps:');
  console.log('  1. Visit http://localhost:3000/knowledge-graph');
  console.log('  2. Click on nodes to see AI explanations');
  console.log('  3. Use filters to view specific node types');
  console.log('  4. Toggle between 2D and 3D views');
  console.log('  5. Check the sidebar for campaign details');
  console.log('\n');
}

// Run the tests
runTests().catch(console.error);

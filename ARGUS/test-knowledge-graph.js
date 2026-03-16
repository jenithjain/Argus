// Test script for Knowledge Graph system
// Run with: node test-knowledge-graph.js

const testDomains = [
  // PayPal phishing campaign
  { url: 'https://paypal-secure-login.xyz', title: 'PayPal Account Verification', hasLoginForm: true },
  { url: 'https://paypal-verify-account.tk', title: 'Verify Your PayPal', hasLoginForm: true },
  { url: 'https://secure-paypal-login.ml', title: 'PayPal Security Check', hasLoginForm: true },
  
  // Amazon phishing campaign
  { url: 'https://amazon-account-verify.xyz', title: 'Amazon Account Suspended', hasLoginForm: true },
  { url: 'https://secure-amazon-login.top', title: 'Amazon Security Alert', hasLoginForm: true },
  
  // Legitimate sites
  { url: 'https://github.com/user/repo', title: 'GitHub Repository', hasLoginForm: false },
  { url: 'https://stackoverflow.com/questions', title: 'Stack Overflow', hasLoginForm: false },
];

async function sendInteraction(domain) {
  try {
    const response = await fetch('http://localhost:3000/api/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: domain.url,
        title: domain.title,
        timestamp: new Date().toISOString(),
        hasLoginForm: domain.hasLoginForm,
        links: [],
        suspiciousPatterns: domain.hasLoginForm ? ['urgency_keyword:verify', 'fake_login'] : [],
      }),
    });

    const data = await response.json();
    console.log(`✓ Sent: ${domain.url}`);
    return data;
  } catch (error) {
    console.error(`✗ Failed: ${domain.url}`, error.message);
  }
}

async function checkGraphData() {
  try {
    const response = await fetch('http://localhost:3000/api/graph-data');
    const data = await response.json();
    console.log('\n📊 Graph Statistics:');
    console.log(`   Nodes: ${data.stats.nodeCount}`);
    console.log(`   Links: ${data.stats.linkCount}`);
    console.log(`   Node Types: ${data.stats.nodeTypes.join(', ')}`);
  } catch (error) {
    console.error('Failed to fetch graph data:', error.message);
  }
}

async function checkCampaigns() {
  try {
    const response = await fetch('http://localhost:3000/api/campaign-clusters');
    const data = await response.json();
    console.log(`\n🎯 Attack Campaigns Detected: ${data.totalCampaigns}`);
    
    data.campaigns.forEach((campaign, i) => {
      console.log(`\n   Campaign ${i + 1}:`);
      console.log(`   - Domains: ${campaign.domainCount}`);
      campaign.domains.forEach(d => console.log(`     • ${d}`));
    });
  } catch (error) {
    console.error('Failed to fetch campaigns:', error.message);
  }
}

async function runTest() {
  console.log('🚀 Testing ARGUS Knowledge Graph System\n');
  console.log('📡 Sending test interactions...\n');

  // Send all interactions with delays
  for (const domain of testDomains) {
    await sendInteraction(domain);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Wait for enrichment to complete
  console.log('\n⏳ Waiting for domain enrichment (10 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Check results
  await checkGraphData();
  await checkCampaigns();

  console.log('\n✅ Test complete! Visit http://localhost:3000/knowledge-graph to visualize\n');
}

runTest().catch(console.error);

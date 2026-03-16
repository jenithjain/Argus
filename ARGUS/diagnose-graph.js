// Diagnostic script for Knowledge Graph
// Run with: node diagnose-graph.js

async function diagnose() {
  console.log('🔍 ARGUS Knowledge Graph Diagnostics\n');

  // Test 1: Check if app is running
  console.log('1️⃣  Testing if app is running...');
  try {
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('   ✅ App is running on http://localhost:3000\n');
    } else {
      console.log('   ❌ App returned error:', response.status, '\n');
    }
  } catch (error) {
    console.log('   ❌ App is NOT running. Start with: npm run dev\n');
    return;
  }

  // Test 2: Check graph data
  console.log('2️⃣  Checking graph data...');
  try {
    const response = await fetch('http://localhost:3000/api/graph-data');
    const data = await response.json();
    
    if (data.error) {
      console.log('   ❌ Error:', data.error, '\n');
    } else {
      console.log(`   ✅ Nodes: ${data.nodes?.length || 0}`);
      console.log(`   ✅ Links: ${data.links?.length || 0}`);
      console.log(`   ✅ Node Types: ${data.stats?.nodeTypes?.join(', ') || 'none'}\n`);
      
      if (data.nodes?.length === 0) {
        console.log('   ⚠️  Graph is empty. Run: npm run test-graph\n');
      }
      
      if (data.links?.length === 0 && data.nodes?.length > 0) {
        console.log('   ⚠️  No links found. This might be a data issue.\n');
      }
    }
  } catch (error) {
    console.log('   ❌ Failed to fetch graph data:', error.message, '\n');
  }

  // Test 3: Check campaigns
  console.log('3️⃣  Checking campaigns...');
  try {
    const response = await fetch('http://localhost:3000/api/campaign-clusters');
    const data = await response.json();
    
    if (data.error) {
      console.log('   ❌ Error:', data.error, '\n');
    } else {
      console.log(`   ✅ Campaigns: ${data.campaigns?.length || 0}\n`);
    }
  } catch (error) {
    console.log('   ❌ Failed to fetch campaigns:', error.message, '\n');
  }

  // Test 4: Test AI explanation
  console.log('4️⃣  Testing AI explanation...');
  try {
    const testNode = {
      label: 'Domain',
      name: 'test-domain.com',
      riskScore: 75,
      domainAge: 15
    };
    
    const response = await fetch('http://localhost:3000/api/explain-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: testNode }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.log('   ❌ Error:', data.error);
      console.log('   💡 Check GEMINI_API_KEY in .env.local\n');
    } else if (data.explanation) {
      console.log('   ✅ AI explanation working');
      console.log('   📝 Sample:', data.explanation.substring(0, 100) + '...\n');
    }
  } catch (error) {
    console.log('   ❌ Failed to test AI:', error.message, '\n');
  }

  // Test 5: Check analytics
  console.log('5️⃣  Checking analytics...');
  try {
    const response = await fetch('http://localhost:3000/api/analytics?range=7d');
    const data = await response.json();
    
    if (data.error) {
      console.log('   ❌ Error:', data.error, '\n');
    } else {
      console.log(`   ✅ Total Interactions: ${data.stats?.totalInteractions || 0}`);
      console.log(`   ✅ Unique Domains: ${data.stats?.uniqueDomains || 0}`);
      console.log(`   ✅ Threats Detected: ${data.stats?.threatsDetected || 0}\n`);
    }
  } catch (error) {
    console.log('   ❌ Failed to fetch analytics:', error.message, '\n');
  }

  // Summary
  console.log('📊 Summary:');
  console.log('   • App: http://localhost:3000');
  console.log('   • Knowledge Graph: http://localhost:3000/knowledge-graph');
  console.log('   • Analytics: http://localhost:3000/analytics');
  console.log('\n💡 Next Steps:');
  console.log('   1. If graph is empty: npm run test-graph');
  console.log('   2. If no links: Check Neo4j connection');
  console.log('   3. If AI fails: Check GEMINI_API_KEY');
  console.log('   4. View graph: http://localhost:3000/knowledge-graph\n');
}

diagnose().catch(console.error);

/**
 * Test script for Security Analytics APIs
 * Run with: node test-security-analytics.js
 */

const BASE_URL = 'http://localhost:3000';

async function testUrlAnalysis() {
  console.log('\n=== Testing URL Analysis ===');
  
  const testUrls = [
    'https://google.com',
    'https://paypa1-secure-login.tk/verify',
    'http://192.168.1.1/admin',
  ];

  for (const url of testUrls) {
    try {
      console.log(`\nAnalyzing: ${url}`);
      const response = await fetch(`${BASE_URL}/api/analyze-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const result = await response.json();
      console.log(`Verdict: ${result.verdict}`);
      console.log(`Score: ${result.score}`);
      console.log(`Reason: ${result.reason}`);
      console.log(`Signals: ${result.signals.join(', ')}`);
    } catch (error) {
      console.error(`Error analyzing ${url}:`, error.message);
    }
  }
}

async function testEmailAnalysis() {
  console.log('\n\n=== Testing Email Analysis ===');
  
  const testEmails = [
    {
      sender: 'support@google.com',
      subject: 'Your Google Account Security Update',
      body: 'We have updated our security policies.'
    },
    {
      sender: 'urgent@paypal-verify.tk',
      subject: 'URGENT: Your account will be suspended',
      body: 'Click here immediately to verify your account or it will be closed!'
    },
    {
      sender: 'noreply@bank-security.com',
      subject: 'Unusual activity detected',
      body: 'We detected unusual activity. Please confirm your password and SSN.'
    }
  ];

  for (const email of testEmails) {
    try {
      console.log(`\nAnalyzing email from: ${email.sender}`);
      const response = await fetch(`${BASE_URL}/api/analyze-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email)
      });
      
      const result = await response.json();
      console.log(`Verdict: ${result.verdict}`);
      console.log(`Score: ${result.score}`);
      console.log(`Reason: ${result.reason}`);
      console.log(`Signals: ${result.signals.join(', ')}`);
    } catch (error) {
      console.error(`Error analyzing email:`, error.message);
    }
  }
}

async function testFetchAnalytics() {
  console.log('\n\n=== Testing Fetch Analytics ===');
  
  try {
    const response = await fetch(`${BASE_URL}/api/security-analytics?days=30&limit=10`);
    const analytics = await response.json();
    
    if (analytics.success) {
      console.log('\nSummary:');
      console.log(`Total Detections: ${analytics.summary.total}`);
      console.log(`Recent Threats: ${analytics.summary.recentThreats}`);
      console.log(`Average Score: ${analytics.summary.avgScore}`);
      console.log('\nBy Type:');
      console.log(`  URL: ${analytics.summary.byType.url || 0}`);
      console.log(`  Email: ${analytics.summary.byType.email || 0}`);
      console.log(`  Deepfake: ${analytics.summary.byType.deepfake || 0}`);
      console.log('\nBy Severity:');
      console.log(`  Critical: ${analytics.summary.bySeverity.CRITICAL || 0}`);
      console.log(`  High: ${analytics.summary.bySeverity.HIGH || 0}`);
      console.log(`  Medium: ${analytics.summary.bySeverity.MEDIUM || 0}`);
      console.log(`  Low: ${analytics.summary.bySeverity.LOW || 0}`);
      
      if (analytics.recentDetections.length > 0) {
        console.log(`\nRecent Detections: ${analytics.recentDetections.length} records`);
        console.log('Latest:', analytics.recentDetections[0]);
      }
    } else {
      console.error('Failed to fetch analytics:', analytics.error);
    }
  } catch (error) {
    console.error('Error fetching analytics:', error.message);
  }
}

async function runTests() {
  console.log('Starting Security Analytics Tests...');
  console.log('Make sure the Next.js server is running on http://localhost:3000');
  
  await testUrlAnalysis();
  await testEmailAnalysis();
  
  // Wait a bit for database writes to complete
  console.log('\n\nWaiting 2 seconds for database writes...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testFetchAnalytics();
  
  console.log('\n\n=== Tests Complete ===');
  console.log('Check the dashboard at http://localhost:3000/dashboard');
  console.log('Navigate to the "Security Analytics" tab to see the results');
}

runTests().catch(console.error);

// Test script to verify email logging to MongoDB
import connectDB from './lib/mongodb.js';
import SecurityAnalytics from './lib/models/SecurityAnalytics.js';

async function testEmailLog() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Connected successfully!');

    const testData = {
      userId: null,
      detectionType: 'email',
      detectedAt: new Date(),
      verdict: 'SUSPICIOUS',
      score: 65,
      severity: 'MEDIUM',
      emailSender: 'test@example.com',
      emailSubject: 'Test Email Subject',
      reason: 'Test reason for email detection',
      signals: ['Test signal 1', 'Test signal 2'],
      action: 'Proceed with caution',
      sessionId: `email-test-${Date.now()}`
    };

    console.log('Creating test log entry:', testData);
    const result = await SecurityAnalytics.create(testData);
    console.log('Successfully created log entry:', result._id);

    // Query to verify
    const count = await SecurityAnalytics.countDocuments({ detectionType: 'email' });
    console.log(`Total email logs in database: ${count}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testEmailLog();

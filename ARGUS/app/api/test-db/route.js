// Test endpoint to verify MongoDB connection
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SecurityAnalytics from '@/lib/models/SecurityAnalytics';

export async function GET() {
  try {
    console.log('[Test DB] Attempting to connect to MongoDB...');
    await connectDB();
    console.log('[Test DB] Connected successfully!');

    // Try to count documents
    const count = await SecurityAnalytics.countDocuments();
    console.log('[Test DB] Total SecurityAnalytics documents:', count);

    // Try to create a test document
    const testDoc = {
      userId: null,
      detectionType: 'email',
      detectedAt: new Date(),
      verdict: 'CLEAR',
      score: 0,
      severity: 'LOW',
      emailSender: 'test@test.com',
      emailSubject: 'Test Subject',
      reason: 'Test connection',
      signals: ['test'],
      action: 'No action needed',
      sessionId: `test-${Date.now()}`
    };

    console.log('[Test DB] Creating test document...');
    const result = await SecurityAnalytics.create(testDoc);
    console.log('[Test DB] Test document created with ID:', result._id.toString());

    // Delete the test document
    await SecurityAnalytics.deleteOne({ _id: result._id });
    console.log('[Test DB] Test document deleted');

    return NextResponse.json({
      success: true,
      message: 'MongoDB connection successful',
      totalDocuments: count,
      testDocumentId: result._id.toString()
    });
  } catch (error) {
    console.error('[Test DB] Error:', error.message);
    console.error('[Test DB] Stack:', error.stack);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

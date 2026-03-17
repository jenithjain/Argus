// Next.js API Route: /api/anonymize-event
// Accepts a raw threat event JSON and returns the sanitized version.
// Used for testing the anonymization pipeline and by internal services.
import { NextResponse } from 'next/server';
import { sanitizeThreatEvent, sanitizeBatch } from '@/lib/anonymizer';

export async function POST(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Support single event or batch
    if (Array.isArray(body)) {
      const sanitized = await sanitizeBatch(body);
      return NextResponse.json(
        { count: sanitized.length, events: sanitized },
        { headers: corsHeaders }
      );
    }

    const sanitized = await sanitizeThreatEvent(body);
    return NextResponse.json(sanitized, { headers: corsHeaders });

  } catch (error) {
    console.error('[ARGUS Anonymizer] Error:', error);
    return NextResponse.json(
      { error: 'Anonymization failed', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

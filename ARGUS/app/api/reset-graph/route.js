// DELETE /api/reset-graph - Clear all graph data
import { NextResponse } from 'next/server';
import { resetGraph } from '@/lib/graph-builder';

export async function DELETE(request) {
  try {
    const result = await resetGraph();
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge graph reset successfully',
    });

  } catch (error) {
    console.error('[Reset Graph API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset graph' },
      { status: 500 }
    );
  }
}

// Also support POST for easier testing
export async function POST(request) {
  return DELETE(request);
}

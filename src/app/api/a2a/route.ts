import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Validate standard A2A envelope (basic validation)
    if (!payload || !payload.sender || !payload.message) {
      return NextResponse.json(
        { error: 'Invalid A2A payload. Missing sender or message.' },
        { status: 400 }
      );
    }

    // Example logic: Log the incoming A2A message
    console.log('Received A2A Message from:', payload.sender);
    console.log('Message content:', payload.message);

    // Return an appropriate response indicating receipt
    return NextResponse.json({
      status: 'received',
      timestamp: new Date().toISOString(),
      receiptId: crypto.randomUUID()
    }, { status: 202 });
    
  } catch (error) {
    console.error('A2A processing error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error processing A2A payload' },
      { status: 500 }
    );
  }
}

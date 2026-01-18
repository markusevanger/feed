import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { parseBody } from 'next-sanity/webhook';

const SANITY_WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    if (!SANITY_WEBHOOK_SECRET) {
      return NextResponse.json({ message: 'Missing webhook secret' }, { status: 500 });
    }

    const { isValidSignature } = await parseBody<{ _type: string }>(
      request,
      SANITY_WEBHOOK_SECRET
    );

    if (!isValidSignature) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    // Revalidate the home page
    revalidatePath('/');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}

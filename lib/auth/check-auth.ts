/**
 * Admin auth check for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from './middleware';

/**
 * Check admin authentication for API routes
 * Returns null if authenticated, or a 401 Response if not
 */
export async function checkAdminAuth(request?: NextRequest): Promise<NextResponse | null> {
  const session = await getAdminSessionFromRequest(request);
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin login required' },
      { status: 401 }
    );
  }
  
  return null;
}

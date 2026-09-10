import {admin} from '@/lib/supabase/server';
import {getUser} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_r: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    if (!/^[a-f0-9-]{36}$/.test(id)) return new Response('Not found', {status: 404});
    
    const db = admin();
    const {data: exists} = await db.from('listings').select('id,status,posted_by,claimed_by').eq('id', id).maybeSingle();
    if (!exists) return new Response('Not found', {status: 404});

    // If the listing is claimed/donated, only allow the owner or claimant to view the full photo
    if (exists.status !== 'available') {
      const user = await getUser();
      if (!user || (exists.posted_by !== user.userId && exists.claimed_by !== user.userId)) {
        return new Response('Not found', {status: 404});
      }
    }

    const {data, error} = await db.storage.from('listing-photos').download(`${id}.jpg`);
    if (error || !data) return new Response('Not found', {status: 404});

    return new Response(data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch {
    return new Response('Server error', {status: 500});
  }
}

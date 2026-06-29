import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, role_ids, jabatan, atasan_jabatan } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID wajib diisi.' }, { status: 400 });
    }

    // 1. Update the public.users table using admin privileges
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({
        role_ids,
        role_id: role_ids && role_ids.length > 0 ? role_ids[0] : null, // Fallback
        jabatan: jabatan || null,
        atasan_jabatan: atasan_jabatan || null
      })
      .eq('id', userId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

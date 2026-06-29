import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase admin client
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
    const { email, password, nama, niy, jabatan, role_ids, atasan_jabatan } = body;

    // Validate required fields
    if (!email || !password || !nama || !niy || !role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      return NextResponse.json(
        { error: 'Email, Password, Nama, NIY, dan minimal satu Hak Akses wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nama
      }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Gagal membuat user auth' }, { status: 500 });
    }

    // 2. Insert into public.users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: authData.user.id,
          nama,
          niy,
          email, // Save email so pre-flight lookup can find it
          role_ids, // Use role_ids array
          role_id: role_ids[0], // Maintain backward compatibility if needed temporarily
          jabatan: jabatan || null,
          atasan_jabatan: atasan_jabatan || null
        }
      ]);

    if (dbError) {
      // If db insert fails, we should ideally rollback the auth user creation
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json({ error: 'Gagal menyimpan data pengguna: ' + dbError.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: 'Pengguna berhasil ditambahkan', user: authData.user },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}

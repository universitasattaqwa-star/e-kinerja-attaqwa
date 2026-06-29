import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID dan Password baru wajib diisi.' },
        { status: 400 }
      );
    }

    // Menggunakan Service Role Key sangat penting untuk mem-bypass RLS
    // dan mengizinkan modifikasi data autentikasi (auth.users) pengguna lain
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
      return NextResponse.json(
        { error: 'Sistem belum dikonfigurasi dengan aman untuk tindakan ini (Service Role Key tidak ditemukan).' },
        { status: 500 }
      );
    }

    // Inisialisasi Supabase Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Melakukan update password menggunakan Admin Auth API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      console.error('Supabase Admin Error:', error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: 'Password berhasil diatur ulang.', user: data.user },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Server error resetting password:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal server.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Robot akan melakukan query super ringan (ambil 1 data saja dari tabel jabatan)
    const { data, error } = await supabase.from('master_jabatan').select('id').limit(1);
    
    if (error) throw error;
    
    return NextResponse.json({ 
      status: 'success', 
      message: 'Supabase is awake!',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
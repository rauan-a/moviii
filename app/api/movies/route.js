import { NextResponse } from 'next/server';
import { db } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const fail = (msg, e, status = 500) =>
  NextResponse.json({ error: msg, details: e?.message || String(e || '') }, { status });

export async function GET() {
  try {
    const { data, error } = await db()
      .from('movies')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) return fail('Не удалось загрузить список', error);
    return NextResponse.json(data);
  } catch (e) {
    return fail('Ошибка сервера', e);
  }
}

export async function POST(req) {
  try {
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || '').trim().slice(0, 200);
    const status = b.status === 'watched' ? 'watched' : b.status === 'wishlist' ? 'wishlist' : null;
    if (!title || !status) {
      return NextResponse.json({ error: 'Нужны название и статус' }, { status: 400 });
    }
    const rating = Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 10 ? b.rating : null;
    const row = {
      title,
      status,
      rating: status === 'watched' ? rating : null,
      watched_at:
        status === 'watched'
          ? /^\d{4}-\d{2}-\d{2}$/.test(b.watched_at || '')
            ? b.watched_at
            : new Date().toISOString().slice(0, 10)
          : null,
    };
    const { data, error } = await db().from('movies').insert(row).select().single();
    if (error) return fail('Не удалось сохранить', error);
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return fail('Ошибка сервера', e);
  }
}

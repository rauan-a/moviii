import { NextResponse } from 'next/server';
import { db } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

const fail = (msg, e, status = 500) =>
  NextResponse.json({ error: msg, details: e?.message || String(e || '') }, { status });

// Перенос в «Посмотрели» (с оценкой и датой)
export async function PATCH(req, { params }) {
  try {
    const b = await req.json().catch(() => ({}));
    const patch = {};
    if (b.status === 'watched' || b.status === 'wishlist') patch.status = b.status;
    if (b.rating === null || (Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 10)) {
      patch.rating = b.rating;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(b.watched_at || '')) patch.watched_at = b.watched_at;
    if (patch.status === 'watched' && !patch.watched_at) {
      patch.watched_at = new Date().toISOString().slice(0, 10);
    }
    if (patch.status === 'wishlist') {
      patch.watched_at = null;
      patch.rating = null;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Нечего менять' }, { status: 400 });
    }
    const { data, error } = await db()
      .from('movies')
      .update(patch)
      .eq('id', params.id)
      .is('deleted_at', null)
      .select()
      .single();
    if (error) return fail('Не удалось обновить', error);
    return NextResponse.json(data);
  } catch (e) {
    return fail('Ошибка сервера', e);
  }
}

// Мягкое удаление: строка остаётся в базе, просто скрывается
export async function DELETE(req, { params }) {
  try {
    const { error } = await db()
      .from('movies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return fail('Не удалось удалить', error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail('Ошибка сервера', e);
  }
}

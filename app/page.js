'use client';

import { useEffect, useMemo, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
const plural = (n, [one, few, many]) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const base = data.error || 'Что-то пошло не так';
    throw new Error(data.details ? `${base}: ${data.details}` : base);
  }
  return data;
}

function Modal({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Закрыть">×</button>
        {children}
      </div>
    </div>
  );
}

function RatingSelect({ value, onChange }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Без оценки</option>
      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
        <option key={n} value={n}>{n} из 10</option>
      ))}
    </select>
  );
}

function AddModal({ defaultStatus, onClose, onDone }) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [rating, setRating] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      await api('/api/movies', {
        method: 'POST',
        body: {
          title,
          status,
          rating: status === 'watched' && rating ? Number(rating) : null,
          watched_at: status === 'watched' ? date : null,
        },
      });
      await onDone();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2>Добавить фильм</h2>
      <input
        className="input"
        autoFocus
        placeholder="Название фильма"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && title.trim() && !saving && save()}
      />

      <div className="seg">
        <button className={status === 'watched' ? 'on' : ''} onClick={() => setStatus('watched')}>Уже смотрели</button>
        <button className={status === 'wishlist' ? 'on' : ''} onClick={() => setStatus('wishlist')}>Хотим посмотреть</button>
      </div>

      {status === 'watched' && (
        <div className="row">
          <label className="field">
            <span>Оценка</span>
            <RatingSelect value={rating} onChange={setRating} />
          </label>
          <label className="field">
            <span>Дата просмотра</span>
            <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
      )}

      {err && <p className="error">{err}</p>}
      <div className="actions">
        <button className="btn primary" disabled={saving || !title.trim()} onClick={save}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </Modal>
  );
}

function DetailModal({ movie, onClose, onDone, onReroll }) {
  const [rating, setRating] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      await onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const markWatched = () =>
    run(() =>
      api('/api/movies/' + movie.id, {
        method: 'PATCH',
        body: { status: 'watched', rating: rating ? Number(rating) : null, watched_at: date },
      })
    );
  const remove = () => run(() => api('/api/movies/' + movie.id, { method: 'DELETE' }));

  return (
    <Modal onClose={onClose}>
      <h2>{movie.title}</h2>
      {movie.status === 'watched' ? (
        <p className="muted">
          Посмотрели {fmtDate(movie.watched_at)}
          {movie.rating ? ` · оценка ${movie.rating}/10` : ''}
        </p>
      ) : (
        <div className="row">
          <label className="field">
            <span>Оценка</span>
            <RatingSelect value={rating} onChange={setRating} />
          </label>
          <label className="field">
            <span>Дата просмотра</span>
            <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
      )}

      {err && <p className="error">{err}</p>}

      <div className="actions">
        {movie.status === 'wishlist' && (
          <button className="btn primary" disabled={busy} onClick={markWatched}>Мы посмотрели</button>
        )}
        {movie.random && (
          <button className="btn" disabled={busy} onClick={onReroll}>Другой фильм</button>
        )}
        {!confirmDel ? (
          <button className="btn danger" disabled={busy} onClick={() => setConfirmDel(true)}>Удалить</button>
        ) : (
          <button className="btn danger" disabled={busy} onClick={remove}>
            {busy ? 'Удаляем…' : 'Точно удалить'}
          </button>
        )}
      </div>
    </Modal>
  );
}

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [tab, setTab] = useState('watched');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      setMovies(await api('/api/movies'));
      setLoadErr('');
    } catch (e) {
      setLoadErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const watched = useMemo(
    () =>
      movies
        .filter((m) => m.status === 'watched')
        .sort((a, b) => (b.watched_at || '').localeCompare(a.watched_at || '') || b.id - a.id),
    [movies]
  );
  const wishlist = useMemo(() => movies.filter((m) => m.status === 'wishlist'), [movies]);
  const list = tab === 'watched' ? watched : wishlist;

  const pickRandom = (excludeId) => {
    const pool = wishlist.filter((m) => m.id !== excludeId);
    const src = pool.length ? pool : wishlist;
    return src.length ? src[Math.floor(Math.random() * src.length)] : null;
  };
  const onRandom = () => {
    const m = pickRandom();
    if (!m) {
      setNotice('В списке «Хотим посмотреть» пока пусто. Добавьте туда пару фильмов.');
      setTimeout(() => setNotice(''), 4000);
      return;
    }
    setSelected({ ...m, random: true });
  };
  const onReroll = () => {
    const m = pickRandom(selected?.id);
    if (m) setSelected({ ...m, random: true });
  };
  const afterChange = async () => {
    setAdding(false);
    setSelected(null);
    await load();
  };

  return (
    <main className="wrap">
      <section className="hero">
        <p className="hero-label">Мы посмотрели вместе</p>
        <p className="hero-count">{watched.length}</p>
        <p className="hero-unit">{plural(watched.length, ['фильм', 'фильма', 'фильмов'])}</p>
        <div className="hero-actions">
          <button className="btn primary" onClick={() => setAdding(true)}>Добавить фильм</button>
          <button className="btn" onClick={onRandom}>Случайный фильм</button>
        </div>
        {notice && <p className="notice">{notice}</p>}
      </section>

      <div className="tabs" role="tablist">
        <button className={'tab' + (tab === 'watched' ? ' active' : '')} onClick={() => setTab('watched')}>
          Посмотрели<span>{watched.length}</span>
        </button>
        <button className={'tab' + (tab === 'wishlist' ? ' active' : '')} onClick={() => setTab('wishlist')}>
          Хотим посмотреть<span>{wishlist.length}</span>
        </button>
      </div>

      {loading ? (
        <p className="empty-state">Загружаем…</p>
      ) : loadErr ? (
        <p className="empty-state">{loadErr}</p>
      ) : list.length === 0 ? (
        <p className="empty-state">
          {tab === 'watched' ? 'Пока ничего не отмечено. Добавьте первый фильм.' : 'Список пуст. Добавьте фильм, который хотите посмотреть.'}
        </p>
      ) : (
        <div className="list">
          {list.map((m) => (
            <button key={m.id} className="item" onClick={() => setSelected(m)}>
              <span>
                <p className="item-title">{m.title}</p>
                <p className="item-meta">{m.status === 'watched' ? fmtDate(m.watched_at) : 'Хотим посмотреть'}</p>
              </span>
              {m.status === 'watched' && m.rating ? <span className="badge">{m.rating}</span> : null}
            </button>
          ))}
        </div>
      )}

      {adding && (
        <AddModal defaultStatus={tab} onClose={() => setAdding(false)} onDone={afterChange} />
      )}
      {selected && (
        <DetailModal
          key={selected.id}
          movie={selected}
          onClose={() => setSelected(null)}
          onDone={afterChange}
          onReroll={onReroll}
        />
      )}
    </main>
  );
}

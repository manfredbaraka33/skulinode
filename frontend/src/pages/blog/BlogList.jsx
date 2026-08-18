import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BLOG_API as API } from '../../config/api';
import { Search, ArrowLeft} from 'lucide-react';

export default function BlogList() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [posts, setPosts] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    axios.get(`${API}/categories/`).then(r => setCategories(r.data));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page, page_size: 10 });
    if (category) params.append('category', category);
    if (q) params.append('q', q);
    axios.get(`${API}/list/?${params}`).then(r => setPosts(r.data));
  }, [category, q, page]);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="min-h-screen bg-[#faf8f3]">
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#142a44] px-4 py-12 text-center">
         <center>
          <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#b3c6de] mb-6">
          <ArrowLeft size={15}/> Rudi Nyumbani
        </button>
         </center>
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl font-semibold text-white mb-2">
          Blogu ya SkuliNode
        </h1>
        <p className="text-blue-100 text-sm">Uchambuzi, takwimu na maarifa kuhusu elimu Tanzania</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
         
          <button onClick={() => { setCategory(''); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              !category ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}>
            Zote
          </button>
          {categories.map(c => (
            <button key={c.slug} onClick={() => { setCategory(c.slug); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                category === c.slug ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}>
              {c.name} ({c.post_count})
            </button>
          ))}
        </div>

        <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 mb-6 bg-white">
          <Search size={15} className="text-slate-400 mr-2"/>
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Tafuta makala..." className="flex-1 outline-none text-sm"/>
        </div>

        {posts?.results?.length ? (
          <div className="space-y-5">
            {posts.results.map(p => (
              <button key={p.slug} onClick={() => navigate(`/blog/${p.slug}`)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-sm transition">
                {p.cover_image && (
                  <img src={p.cover_image} alt={p.title} className="w-full h-48 object-cover"/>
                )}
                <div className="p-5">
                  {p.category && (
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{p.category}</span>
                  )}
                  <h2 style={{ fontFamily: "'Fraunces', serif" }} className="text-xl font-semibold text-[#1e3a5f] mt-1 mb-2">
                    {p.title}
                  </h2>
                  <p className="text-sm text-slate-500 line-clamp-2">{p.excerpt}</p>
                  <div className="text-xs text-slate-400 mt-3">
                    {p.published_at && new Date(p.published_at).toLocaleDateString('sw-TZ')} · {p.view_count} watazamaji
                  </div>
                </div>
              </button>
            ))}
            <div className="flex justify-center gap-2 pt-4">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs border rounded disabled:opacity-40">Nyuma</button>
              <span className="text-xs text-slate-500">Ukurasa {posts.page} / {posts.total_pages}</span>
              <button disabled={page >= posts.total_pages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs border rounded disabled:opacity-40">Mbele</button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400 text-sm">Hakuna makala bado.</div>
        )}
      </div>
    </div>
  );
}
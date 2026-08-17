import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BLOG_API as API } from '../../config/api';
import { ArrowLeft, Link2 } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/post/${slug}/`).then(r => setPost(r.data)).catch(() => setPost(false));
  }, [slug]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (post === false) {
    return <div className="text-center py-16 text-slate-400">Makala haipatikani.</div>;
  }
  if (!post) {
    return <div className="text-center py-16 text-slate-400">Inapakia...</div>;
  }

  <Helmet>
  <title>{post.title} — Blogu ya SkuliNode</title>
  <meta name="description" content={post.excerpt} />
  {post.cover_image && <meta property="og:image" content={post.cover_image} />}
</Helmet>

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="min-h-screen bg-[#faf8f3]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/blog')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1e3a5f] mb-6">
          <ArrowLeft size={15}/> Rudi kwenye Blogu
        </button>

        {post.category && (
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{post.category}</span>
        )}
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl font-semibold text-[#1e3a5f] mt-2 mb-3">
          {post.title}
        </h1>
        <div className="flex items-center gap-3 text-xs text-slate-400 mb-6">
          <span>{post.published_at && new Date(post.published_at).toLocaleDateString('sw-TZ')}</span>
          <span>· {post.view_count} watazamaji</span>
          <button onClick={copyLink} className="flex items-center gap-1 text-blue-600 hover:underline">
            <Link2 size={12}/> {copied ? 'Kimenakiliwa!' : 'Nakili Kiungo'}
          </button>
        </div>

        {post.cover_image && (
          <img src={post.cover_image} alt={post.title} className="w-full rounded-2xl mb-8"/>
        )}

        <article className="prose prose-slate max-w-none prose-headings:font-['Fraunces'] prose-headings:text-[#1e3a5f] prose-a:text-blue-600 prose-img:rounded-xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
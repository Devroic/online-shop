import { useParams } from 'react-router-dom';
import { useFetch } from '../lib/useFetch.js';
import { renderMarkdown } from '../lib/markdown.js';
import { PageLoader, useTitle } from '../components/ui.jsx';
import NotFound from './NotFound.jsx';

export default function ContentPage() {
  const { slug } = useParams();
  const { data, loading, error } = useFetch(`/pages/${slug}`, { keepPrevious: false });
  useTitle(data?.title);
  if (error) return <NotFound />;
  if (loading || !data) return <PageLoader />;
  return (
    <div className="container narrow">
      <article className="prose content-page">
        <h1>{data.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content) }} />
      </article>
    </div>
  );
}

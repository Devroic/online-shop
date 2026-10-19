import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { t } from '../lib/i18n.js';
import { EmptyState, useTitle } from '../components/ui.jsx';

export default function NotFound() {
  useTitle(t('Page not found'));
  return (
    <div className="container narrow">
      <EmptyState
        icon={Compass}
        title={t('Page not found')}
        text={t('The page you are looking for does not exist or has moved.')}
        action={
          <Link to="/" className="btn btn-primary">
            {t('Back to home')}
          </Link>
        }
      />
    </div>
  );
}

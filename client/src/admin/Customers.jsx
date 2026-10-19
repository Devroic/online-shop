import { useSearchParams, Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { date, money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, PageLoader, Pagination } from '../components/ui.jsx';
import { PageHeader, SearchInput } from './components.jsx';

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const role = params.get('role') || '';
  const page = Number(params.get('page') || 1);
  const { data, reload } = useFetch(`/admin/customers${qs({ q, role, page })}`);
  const { user } = useAuth();
  const toast = useToast();
  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  const setRole = async (c, newRole) => {
    const msg = newRole === 'admin' ? t('Give {email} full access to the admin panel?') : t('Remove admin access from {email}?');
    if (!window.confirm(msg.replace('{email}', c.email))) return;
    try {
      await api.put(`/admin/customers/${c.id}/role`, { role: newRole });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader title={t('Customers')} subtitle={data && t('{n} accounts', { n: data.total })} />
      <div className="a-filters">
        <SearchInput value={q} onChange={(v) => update({ q: v })} placeholder={t('Name, email or phone…')} />
        <select className="input" value={role} onChange={(e) => update({ role: e.target.value })}>
          <option value="">{t('All accounts')}</option>
          <option value="customer">{t('Customers')}</option>
          <option value="admin">{t('Admins')}</option>
        </select>
      </div>
      <p className="muted small">{t('Guests who order without an account are listed in Orders.')}</p>
      {!data ? (
        <PageLoader />
      ) : !data.items.length ? (
        <EmptyState icon={Users} title={t('No customers yet')} />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Customer')}</th>
                  <th>{t('Phone')}</th>
                  <th>{t('Orders')}</th>
                  <th className="num">{t('Spent')}</th>
                  <th>{t('Joined')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name || '—'}</strong> {c.role === 'admin' && <span className="status status-shipped">Admin</span>}
                      <div className="muted small">{c.email}</div>
                    </td>
                    <td>{c.phone || '—'}</td>
                    <td>
                      {c.orderCount > 0 ? (
                        <Link to={`/admin/orders?customer=${c.id}`} className="link-btn">
                          {c.orderCount}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="num">{money(c.spent)}</td>
                    <td className="nowrap">{date(c.createdAt)}</td>
                    <td className="num">
                      {c.id !== user.id && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setRole(c, c.role === 'admin' ? 'customer' : 'admin')}>
                          {c.role === 'admin' ? t('Remove admin') : t('Make admin')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && <Pagination page={page} pages={data.pages} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />}
    </>
  );
}

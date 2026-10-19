import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingCart, Users, Package, AlertTriangle } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { money, date, dateTime } from '../lib/format.js';
import { t, ORDER_STATUS } from '../lib/i18n.js';
import { PageLoader } from '../components/ui.jsx';
import { PageHeader } from './components.jsx';

function RevenueChart({ series }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...series.map((d) => d.revenue), 1);
  const w = 100 / series.length;
  return (
    <div className="chart">
      <div className="chart-tip">
        {hover != null ? (
          <>
            <strong>{money(series[hover].revenue)}</strong>
            <span className="muted">
              {' '}
              · {series[hover].orders} {t('orders')} · {date(series[hover].day)}
            </span>
          </>
        ) : (
          <span className="muted">{t('Hover a bar for details')}</span>
        )}
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={t('Revenue per day')}>
        {series.map((d, i) => {
          const h = (d.revenue / max) * 38;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * w} y="0" width={w} height="40" fill="transparent" />
              <rect
                x={i * w + w * 0.15}
                y={40 - Math.max(h, 0.4)}
                width={w * 0.7}
                height={Math.max(h, 0.4)}
                rx="0.4"
                className={hover === i ? 'bar active' : 'bar'}
              />
            </g>
          );
        })}
      </svg>
      <div className="chart-axis muted small">
        <span>{date(series[0].day)}</span>
        <span>{date(series[series.length - 1].day)}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data } = useFetch(`/admin/stats?days=${days}`);
  if (!data) return <PageLoader />;

  const avg = data.period.orders ? Math.round(data.period.revenue / data.period.orders) : 0;
  const cards = [
    [TrendingUp, t('Revenue'), money(data.period.revenue), t('Today: {v}', { v: money(data.today.revenue) })],
    [ShoppingCart, t('Orders'), data.period.orders, t('Today: {v}', { v: data.today.orders })],
    [Package, t('Average order'), money(avg), t('{n} products in catalog', { n: data.products })],
    [Users, t('Customers'), data.customers, t('registered accounts')],
  ];

  return (
    <>
      <PageHeader
        title={t('Dashboard')}
        actions={
          <div className="seg">
            {[7, 30, 90].map((d) => (
              <button key={d} className={d === days ? 'active' : ''} onClick={() => setDays(d)}>
                {t('{n} days', { n: d })}
              </button>
            ))}
          </div>
        }
      />
      <div className="stat-grid">
        {cards.map(([Icon, label, value, sub]) => (
          <div key={label} className="card stat">
            <div className="stat-label">
              <Icon size={16} /> {label}
            </div>
            <div className="stat-value">{value}</div>
            <div className="muted small">{sub}</div>
          </div>
        ))}
      </div>

      {data.statusCounts.pending > 0 && (
        <Link to="/admin/orders?status=pending" className="a-alert">
          <ShoppingCart size={18} /> {t('{n} orders waiting to be processed', { n: data.statusCounts.pending })} →
        </Link>
      )}

      <div className="a-grid">
        <section className="card">
          <h3>{t('Revenue')}</h3>
          <RevenueChart series={data.series} />
        </section>
        <section className="card">
          <h3>{t('Best sellers')}</h3>
          {data.topProducts.length ? (
            <ol className="rank">
              {data.topProducts.map((p) => (
                <li key={`${p.id}-${p.name}`}>
                  <span className="grow">{p.name}</span>
                  <span className="muted small">×{p.quantity}</span>
                  <strong>{money(p.revenue)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">{t('No sales in this period yet.')}</p>
          )}
        </section>
      </div>

      <div className="a-grid">
        <section className="card">
          <div className="card-head">
            <h3>{t('Recent orders')}</h3>
            <Link to="/admin/orders" className="link-btn">
              {t('View all')}
            </Link>
          </div>
          {data.recentOrders.length ? (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/admin/orders/${o.id}`} className="strong-link">
                          #{o.number}
                        </Link>
                        <div className="muted small">{dateTime(o.createdAt)}</div>
                      </td>
                      <td>{o.customerName}</td>
                      <td>
                        <span className={`status status-${o.status}`}>{t(ORDER_STATUS[o.status])}</span>
                      </td>
                      <td className="num">{money(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">{t('No orders yet. Share your shop link to get the first one!')}</p>
          )}
        </section>
        <section className="card">
          <h3>
            <AlertTriangle size={18} className="warn-icon" /> {t('Low stock')}
          </h3>
          {data.lowStock.length ? (
            <ul className="rank">
              {data.lowStock.map((p, i) => (
                <li key={i}>
                  <Link to={`/admin/products/${p.id}`} className="grow">
                    {p.name}
                    {p.variant && <span className="muted"> · {p.variant}</span>}
                  </Link>
                  <span className={`stock-pill ${p.stock === 0 ? 'zero' : ''}`}>{p.stock}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('All products are well stocked.')}</p>
          )}
        </section>
      </div>
    </>
  );
}

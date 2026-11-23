import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingCart, Users, Package, AlertTriangle, Eye, Percent, UserRound } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { money, date, dateTime } from '../lib/format.js';
import { t, ORDER_STATUS, statusName, getLanguage } from '../lib/i18n.js';
import { PageLoader } from '../components/ui.jsx';
import { PageHeader } from './components.jsx';
import { countryName } from '../lib/countries.js';

/** Bars per day; `value` picks the number from a day, `tip` describes a hovered day. */
function BarChart({ series, value, tip, label }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...series.map(value), 1);
  const w = 100 / series.length;
  return (
    <div className="chart">
      <div className="chart-tip">
        {hover != null ? (
          tip(series[hover])
        ) : (
          <span className="muted">{t('Hover a bar for details')}</span>
        )}
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label}>
        {series.map((d, i) => {
          const h = (value(d) / max) * 38;
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

const revenueTip = (d) => (
  <>
    <strong>{money(d.revenue)}</strong>
    <span className="muted">
      {' '}
      · {t('{n} orders', { n: d.orders })} · {date(d.day)}
    </span>
  </>
);
const visitorTip = (d) => (
  <>
    <strong>{t('{n} visitors', { n: d.visitors })}</strong>
    <span className="muted">
      {' '}
      · {t('{n} page views', { n: d.views })} · {date(d.day)}
    </span>
  </>
);

const DEVICE = { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Computer' };

/** A short list with a bar showing each row's share of the visitors. */
function ShareList({ title, rows, name, total }) {
  return (
    <div className="share">
      <h4>{title}</h4>
      {rows.length ? (
        <ul>
          {rows.map((r) => {
            const pct = total ? Math.round((r.visitors / total) * 100) : 0;
            return (
              <li key={r.key || '-'}>
                <span className="share-bar" style={{ width: `${pct}%` }} />
                <span className="grow">{name(r.key)}</span>
                <span className="muted small">{pct}%</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">—</p>
      )}
    </div>
  );
}

/**
 * Visitors: the shop's own counting (no cookies, see server/src/services/analytics.js),
 * for the same period as the rest of the dashboard.
 */
function Visitors({ days }) {
  const { data } = useFetch(`/admin/analytics?days=${days}`);
  if (!data) return null;
  if (!data.since) {
    return (
      <section className="card">
        <h3>{t('Visitors')}</h3>
        <p className="muted">{t('Visitors are counted from now on: the first numbers appear after the first visits to the shop.')}</p>
      </section>
    );
  }
  // Numbers as the admin's language writes them ("2,5" in Greek).
  const num = (x) => x.toLocaleString(getLanguage() === 'el' ? 'el-GR' : 'en-GB', { maximumFractionDigits: 1 });
  const pct = (x) => `${num(x * 100)}%`;
  const cards = [
    [UserRound, t('Visitors'), data.visitors, t('Each visitor counts once a day')],
    [Eye, t('Page views'), data.views, data.visitors ? t('{n} pages per visitor', { n: num(data.views / data.visitors) }) : ''],
    [Percent, t('Conversion rate'), pct(data.conversion), t('{n} orders', { n: data.orders })],
  ];
  return (
    <>
      <div className="stat-grid stat-grid-3">
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
      <div className="a-grid">
        <section className="card">
          <h3>{t('Visitors')}</h3>
          <BarChart series={data.series} value={(d) => d.visitors} tip={visitorTip} label={t('Visitors per day')} />
        </section>
        <section className="card">
          <h3>{t('Most viewed products')}</h3>
          {data.topProducts.length ? (
            <ol className="rank">
              {data.topProducts.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/products/${p.id}`} className="grow">
                    {p.name}
                  </Link>
                  <span className="muted small">{t('{n} views', { n: p.views })}</span>
                  <strong className="small">{t('{n} sold', { n: p.sold })}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">{t('No product views in this period yet.')}</p>
          )}
        </section>
      </div>
      <section className="card share-grid">
        <ShareList title={t('Where they come from')} rows={data.sources} name={(k) => k || t('Direct')} total={data.visitors} />
        <ShareList title={t('Countries')} rows={data.countries} name={(k) => (k ? countryName(k) : t('Unknown'))} total={data.visitors} />
        <ShareList title={t('Devices')} rows={data.devices} name={(k) => t(DEVICE[k] || k)} total={data.visitors} />
      </section>
    </>
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
    [Users, t('Customers'), data.customers, t('registered accounts', { n: data.customers })],
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
          <BarChart series={data.series} value={(d) => d.revenue} tip={revenueTip} label={t('Revenue per day')} />
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

      <Visitors days={days} />

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
              <table className="table clickable">
                <tbody>
                  {data.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/admin/orders/${o.id}`} className="strong-link row-link">
                          #{o.number}
                        </Link>
                        <div className="muted small">{dateTime(o.createdAt)}</div>
                      </td>
                      <td>{o.customerName}</td>
                      <td>
                        <span className={`status status-${o.status}`}>{statusName(o.status, o)}</span>
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

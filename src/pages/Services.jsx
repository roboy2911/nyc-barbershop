import { Link } from 'react-router-dom';
import { useShop } from '../App.jsx';
import Icon, { serviceIcon } from '../components/Icon.jsx';

export const money = (cents) => (cents == null ? '' : `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`);

export default function Services() {
  const { data } = useShop();
  const services = data.services.filter((s) => s.active);
  return (
    <>
      <div className="page-head">
        <div className="container">
          <h1>Services &amp; Prices</h1>
          <p>Walk-ins welcome · Book online to skip the wait</p>
        </div>
      </div>
      <div className="container page">
        <p className="center" style={{ marginBottom: 24 }}>
          <span className="placeholder-tag">Placeholder prices</span>
        </p>
        <div className="services">
          {services.map((s) => (
            <div className={`service${s.popular ? ' popular' : ''}`} key={s.id}>
              {s.popular && <span className="pop-tag">Most popular</span>}
              <span className="svc-ico"><Icon name={serviceIcon(s.name)} size={28} /></span>
              <h3>{s.name}</h3>
              <div className="price">{money(s.priceCents)}</div>
              <div className="dur"><Icon name="clock" size={14} /> {s.duration} minutes</div>
              <p>{s.description}</p>
              <Link className="btn ghost" to={`/book?service=${s.id}`}>Book {s.name}</Link>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

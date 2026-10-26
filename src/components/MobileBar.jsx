import { Link } from 'react-router-dom';
import { useShop } from '../App.jsx';
import { telHref } from '../content.js';
import Icon from './Icon.jsx';

// Always-visible Book / Call buttons at the bottom of phone screens.
export default function MobileBar() {
  const { data } = useShop();
  return (
    <div className="mobile-bar">
      <a className="btn ghost" href={telHref(data.settings.phone)}><Icon name="phone" size={16} /> Call</a>
      <Link className="btn" to="/book"><Icon name="calendar" size={16} /> Book now</Link>
    </div>
  );
}

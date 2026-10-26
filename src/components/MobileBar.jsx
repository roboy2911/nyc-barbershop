import { Link } from 'react-router-dom';
import { useShop } from '../App.jsx';
import { telHref } from '../content.js';

// Always-visible Book / Call buttons at the bottom of phone screens.
export default function MobileBar() {
  const { data } = useShop();
  return (
    <div className="mobile-bar">
      <a className="btn ghost" href={telHref(data.settings.phone)}>☎ Call</a>
      <Link className="btn" to="/book">Book now</Link>
    </div>
  );
}

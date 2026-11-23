import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <NavLink to="/" className="brand">ChronoVault</NavLink>
          <nav className="links" aria-label="Main">
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/create">New capsule</NavLink>
            <NavLink to="/checkin">Check-in</NavLink>
            <NavLink to="/contacts">Contacts</NavLink>
          </nav>
          <div className="who">
            <span className="who-name">{user?.name}</span>
            <button className="btn ghost sm" onClick={() => { logout(); nav('/login'); }}>Log out</button>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

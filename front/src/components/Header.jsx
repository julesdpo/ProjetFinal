import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <div className="brand">SecureDesk</div>
      <nav>
        {user && (
          <>
            <Link to="/">Tableau de bord</Link>
            {user.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
          </>
        )}
      </nav>
      <div className="session">
        {user ? (
          <>
            <span className="pill">{user.email} · {user.role}</span>
            <button className="ghost" onClick={handleLogout}>Se déconnecter</button>
          </>
        ) : (
          <>
            <Link to="/login">Connexion</Link>
            <Link to="/register">Inscription</Link>
          </>
        )}
      </div>
    </header>
  );
}

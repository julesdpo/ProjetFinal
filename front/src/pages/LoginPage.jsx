import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await login(email, password);
      setUser(res.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de connexion');
    }
  };

  return (
    <div className="auth-grid">
      <div className="hero">
        <h1>SecureDesk</h1>
        <p>Centre de tickets sécurisé pour équipes exigeantes.</p>
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <h2>Connexion</h2>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Se connecter</button>
        <p className="muted">Pas de compte ? <Link to="/register">Créer un compte</Link></p>
      </form>
    </div>
  );
}

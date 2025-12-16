import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(email, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="auth-grid">
      <div className="hero">
        <h1>Onboard sécurisé</h1>
        <p>Les nouveaux comptes sont isolés et protégés.</p>
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <h2>Créer un compte</h2>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Mot de passe (8+ caractères)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">Compte créé. Vous pouvez vous connecter.</p>}
        <button type="submit">S'inscrire</button>
        <p className="muted">Déjà inscrit ? <Link to="/login">Connexion</Link></p>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { listUsers, setUserStatus, listAudit } from '../api';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [u, a] = await Promise.all([listUsers(), listAudit()]);
      setUsers(u);
      setAudit(a);
    } catch (err) {
      setError('Chargement admin impossible');
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id, current) => {
    await setUserStatus(id, !current);
    load();
  };

  return (
    <div className="layout">
      <div className="card">
        <h3>Utilisateurs</h3>
        {error && <p className="error">{error}</p>}
        <table className="table">
          <thead>
            <tr><th>Email</th><th>Rôle</th><th>Actif</th><th>Action</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td><span className={`badge ${u.is_active ? 'success' : 'danger'}`}>{u.is_active ? 'Actif' : 'Désactivé'}</span></td>
                <td><button onClick={() => toggle(u.id, u.is_active)}>{u.is_active ? 'Désactiver' : 'Activer'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Journal d'activité</h3>
        <div className="audit-list">
          {audit.map((a) => (
            <div key={a.id} className="audit-item">
              <span className="pill">{a.action}</span>
              <div className="muted">{JSON.stringify(a.metadata)} · {new Date(a.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

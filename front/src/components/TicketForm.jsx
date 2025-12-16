import { useEffect, useState } from 'react';

const defaultState = { title: '', description: '', priority: 'medium', status: 'open' };

export default function TicketForm({ onSubmit, editing }) {
  const [form, setForm] = useState(defaultState);

  useEffect(() => {
    if (editing) setForm({ ...editing });
    else setForm(defaultState);
  }, [editing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h3>{editing ? 'Modifier un ticket' : 'Nouveau ticket'}</h3>
      <label>Titre
        <input name="title" value={form.title} onChange={handleChange} required minLength={3} />
      </label>
      <label>Description
        <textarea name="description" value={form.description} onChange={handleChange} required minLength={3} />
      </label>
      <div className="grid two">
        <label>Priorité
          <select name="priority" value={form.priority} onChange={handleChange}>
            <option value="low">Basse</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute</option>
          </select>
        </label>
        <label>Statut
          <select name="status" value={form.status} onChange={handleChange}>
            <option value="open">Ouvert</option>
            <option value="in_progress">En cours</option>
            <option value="closed">Fermé</option>
          </select>
        </label>
      </div>
      <div className="actions">
        <button type="submit">{editing ? 'Mettre à jour' : 'Créer'}</button>
      </div>
    </form>
  );
}

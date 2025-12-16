import { useEffect, useState } from 'react';
import TicketCard from '../components/TicketCard';
import TicketForm from '../components/TicketForm';
import { listTickets, createTicket, updateTicket, deleteTicket } from '../api';

export default function DashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await listTickets();
      setTickets(data);
    } catch (err) {
      setError('Impossible de charger les tickets');
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (payload) => {
    try {
      if (editing) {
        await updateTicket(editing.id, payload);
        setEditing(null);
      } else {
        await createTicket(payload);
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce ticket ?')) return;
    await deleteTicket(id);
    load();
  };

  return (
    <div className="layout">
      <div>
        <TicketForm onSubmit={handleCreate} editing={editing} />
      </div>
      <div className="list">
        <div className="card"><h3>Vos tickets</h3>{error && <p className="error">{error}</p>}</div>
        <div className="grid three">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} onEdit={setEditing} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}

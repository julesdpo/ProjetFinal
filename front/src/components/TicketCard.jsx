export default function TicketCard({ ticket, onEdit, onDelete }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{ticket.title}</h3>
        <span className={`badge ${ticket.status}`}>{ticket.status}</span>
      </div>
      <p className="muted">{ticket.description}</p>
      <div className="meta">
        <span>Priorité: {ticket.priority}</span>
        <span>MAJ: {new Date(ticket.updated_at).toLocaleString()}</span>
      </div>
      <div className="actions">
        <button onClick={() => onEdit(ticket)}>Modifier</button>
        <button className="danger" onClick={() => onDelete(ticket.id)}>Supprimer</button>
      </div>
    </div>
  );
}

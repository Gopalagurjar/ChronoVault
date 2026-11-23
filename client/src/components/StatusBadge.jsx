const MAP = { LOCKED: ['Locked', '🔒'], UNLOCKED: ['Unlocked', '🔓'], DELIVERED: ['Delivered', '✉'], TAMPERED: ['Tampered', '⚠'] };
/** Status is shown as text AND colour (not colour alone). */
export default function StatusBadge({ status }) {
  const [label, icon] = MAP[status] || [status, ''];
  return <span className={`badge ${status}`}><span aria-hidden="true">{icon}</span> {label}</span>;
}

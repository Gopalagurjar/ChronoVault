import { useNow, parts } from '../time.js';

/** Live countdown driven by the server clock. */
export default function Countdown({ target, offset }) {
  const now = useNow(offset);
  const left = new Date(target).getTime() - now;
  if (left <= 0) return <span className="cd">Releasing shortly</span>;
  const { d, h, m, s } = parts(left);
  return <span className="cd" aria-label={`${d} days ${h} hours ${m} minutes ${s} seconds`}>{d}d {String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s</span>;
}

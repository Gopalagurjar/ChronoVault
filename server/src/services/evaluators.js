/**
 * Unlock-condition evaluators. Pure functions: they never read the clock themselves,
 * the caller passes in the SERVER time (`now`), so users cannot unlock early by changing their device clock.
 */
const DAY = 24 * 60 * 60 * 1000;

const toMs = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

function evaluateDate(capsule, now) {
  return !!capsule.unlockDate && toMs(now) >= toMs(capsule.unlockDate);
}

function evaluateEvent(capsule) {
  return capsule.eventConfirmed === true;
}

function inactivityDeadline(capsule, lastCheckIn) {
  if (!lastCheckIn || !capsule.inactivityDays) return null;
  return new Date(toMs(lastCheckIn) + capsule.inactivityDays * DAY);
}

function evaluateInactivity(capsule, lastCheckIn, now) {
  const deadline = inactivityDeadline(capsule, lastCheckIn);
  return !!deadline && toMs(now) >= deadline.getTime();
}

/** Exactly one unlock mode per capsule. Anything unexpected -> false (fail safe: stay LOCKED). */
function isDue(capsule, lastCheckIn, now) {
  switch (capsule.unlockMode) {
    case 'date': return evaluateDate(capsule, now);
    case 'event': return evaluateEvent(capsule);
    case 'inactivity': return evaluateInactivity(capsule, lastCheckIn, now);
    default: return false;
  }
}

/** Warn the creator before an inactivity release: within `windowDays` of the deadline. */
function needsReminder(capsule, lastCheckIn, now, windowDays = 3) {
  if (capsule.unlockMode !== 'inactivity' || capsule.reminderSentAt) return false;
  const deadline = inactivityDeadline(capsule, lastCheckIn);
  if (!deadline) return false;
  const left = deadline.getTime() - toMs(now);
  return left > 0 && left <= windowDays * DAY;
}

module.exports = { evaluateDate, evaluateEvent, evaluateInactivity, inactivityDeadline, isDue, needsReminder, DAY };

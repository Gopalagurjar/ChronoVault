const { evaluateDate, evaluateEvent, evaluateInactivity, inactivityDeadline, isDue, needsReminder, DAY } = require('../src/services/evaluators');

const T = new Date('2027-03-15T09:00:00.000Z');

describe('Date evaluator (boundary times)', () => {
  const cap = { unlockMode: 'date', unlockDate: T };
  test('one millisecond before -> not due', () => expect(evaluateDate(cap, new Date(T.getTime() - 1))).toBe(false));
  test('exactly at the unlock time -> due', () => expect(evaluateDate(cap, T)).toBe(true));
  test('after -> due', () => expect(evaluateDate(cap, new Date(T.getTime() + 1))).toBe(true));
  test('missing date -> never due (fail safe)', () => expect(evaluateDate({ unlockMode: 'date' }, T)).toBe(false));
  test('accepts ISO strings', () => expect(evaluateDate({ unlockDate: T.toISOString() }, T.toISOString())).toBe(true));
});

describe('Inactivity evaluator (boundary times)', () => {
  const cap = { unlockMode: 'inactivity', inactivityDays: 30 };
  const last = new Date('2027-01-01T00:00:00.000Z');
  const deadline = new Date(last.getTime() + 30 * DAY);
  test('deadline is lastCheckIn + days', () => expect(inactivityDeadline(cap, last).getTime()).toBe(deadline.getTime()));
  test('just before the deadline -> not due', () => expect(evaluateInactivity(cap, last, new Date(deadline.getTime() - 1))).toBe(false));
  test('at the deadline -> due', () => expect(evaluateInactivity(cap, last, deadline)).toBe(true));
  test('a check-in restarts the countdown', () => {
    const newLast = new Date(deadline.getTime() - 1000);
    expect(evaluateInactivity(cap, newLast, deadline)).toBe(false);
  });
  test('missing data -> not due and no deadline', () => {
    expect(evaluateInactivity({ inactivityDays: 5 }, null, deadline)).toBe(false);
    expect(inactivityDeadline({}, last)).toBeNull();
  });
});

describe('Event evaluator', () => {
  test('due only after confirmation', () => {
    expect(evaluateEvent({ eventConfirmed: false })).toBe(false);
    expect(evaluateEvent({})).toBe(false);
    expect(evaluateEvent({ eventConfirmed: true })).toBe(true);
  });
});

describe('isDue dispatch', () => {
  test('uses exactly the capsule mode', () => {
    expect(isDue({ unlockMode: 'date', unlockDate: T }, null, T)).toBe(true);
    expect(isDue({ unlockMode: 'event', eventConfirmed: true }, null, T)).toBe(true);
    expect(isDue({ unlockMode: 'inactivity', inactivityDays: 1 }, new Date(T.getTime() - DAY), T)).toBe(true);
  });
  test('an event capsule does not unlock because a date passed', () => {
    expect(isDue({ unlockMode: 'event', unlockDate: T, eventConfirmed: false }, null, new Date(T.getTime() + DAY))).toBe(false);
  });
  test('unknown mode -> never due', () => expect(isDue({ unlockMode: 'weird' }, null, T)).toBe(false));
});

describe('Check-in reminder', () => {
  const cap = { unlockMode: 'inactivity', inactivityDays: 10 };
  const last = new Date('2027-01-01T00:00:00.000Z');
  test('inside the 3-day window -> remind', () => expect(needsReminder(cap, last, new Date(last.getTime() + 8 * DAY))).toBe(true));
  test('outside the window -> no reminder', () => expect(needsReminder(cap, last, new Date(last.getTime() + 2 * DAY))).toBe(false));
  test('after the deadline -> no reminder', () => expect(needsReminder(cap, last, new Date(last.getTime() + 11 * DAY))).toBe(false));
  test('already sent or other modes -> no reminder', () => {
    expect(needsReminder({ ...cap, reminderSentAt: new Date() }, last, new Date(last.getTime() + 8 * DAY))).toBe(false);
    expect(needsReminder({ unlockMode: 'date' }, last, last)).toBe(false);
    expect(needsReminder({ unlockMode: 'inactivity', inactivityDays: 5 }, null, last)).toBe(false);
  });
});

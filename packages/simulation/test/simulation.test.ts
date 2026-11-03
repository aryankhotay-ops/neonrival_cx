import { test } from 'node:test';
import { deepStrictEqual, equal } from 'node:assert';
import { createInitialState, step } from '../src/index';

test('fixed steps are deterministic and do not mutate their input', () => {
  const initial = createInitialState();
  let a = initial;
  let b = createInitialState();
  for (let i = 0; i < 120; i++) { a = step(a); b = step(b); }
  deepStrictEqual(a, b);
  equal(a.frame, 120);
  equal(initial.frame, 0);
});

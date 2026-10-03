import test from 'node:test';
import assert from 'node:assert/strict';
import { mafia } from '../server/games/mafia.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

test('Mafia accepts four players and assigns a complete role set', () => {
  const s = mafia.create(players(4));
  assert.equal(mafia.min, 4);
  assert.equal(Object.keys(s.roles).length, 4);
  assert.equal(Object.values(s.roles).filter((role) => role === 'mafia').length, 1);
  assert.equal(Object.values(s.roles).filter((role) => role === 'doctor').length, 1);
  assert.equal(Object.values(s.roles).filter((role) => role === 'commissioner').length, 1);
});

test('Mafia accepts twenty players and scales the mafia team', () => {
  const s = mafia.create(players(20));
  assert.equal(mafia.max, 20);
  assert.equal(Object.keys(s.roles).length, 20);
  assert.equal(Object.values(s.roles).filter((role) => role === 'mafia').length, 5);
  assert.equal(Object.values(s.roles).filter((role) => role === 'civilian').length, 13);
});


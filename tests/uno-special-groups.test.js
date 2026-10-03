import test from 'node:test';
import assert from 'node:assert/strict';
import { uno } from '../server/games/uno.js';

const c = (id, color, value) => ({ id, color, value });
function specialState(value, color = 'red') {
  const s = uno.create([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  s.turn = 'a';
  s.color = color;
  s.discard = [c('top', color, '5')];
  s.hands.a = [c('one', 'red', value), c('two', 'blue', value), c('three', 'green', value), c('keep', 'yellow', '9')];
  return s;
}

test('same-value Skip cards group across colors and apply once', () => {
  const s = specialState('skip');
  uno.act(s, 'a', { type: 'play', cardIds: ['one', 'two', 'three'], uno: true });
  assert.equal(s.turn, 'c');
  assert.equal(s.hands.a.length, 1);
  assert.equal(s.discard.at(-1).value, 'skip');
});

test('same-value Reverse cards group across colors and reverse once', () => {
  const s = specialState('reverse');
  uno.act(s, 'a', { type: 'play', cardIds: ['one', 'two', 'three'], uno: true });
  assert.equal(s.direction, -1);
  assert.equal(s.turn, 'c');
});

test('+2 and +4 groups apply their penalty once', () => {
  const plusTwo = specialState('+2');
  const beforeTwo = plusTwo.hands.b.length;
  uno.act(plusTwo, 'a', { type: 'play', cardIds: ['one', 'two', 'three'], uno: true });
  assert.equal(plusTwo.hands.b.length, beforeTwo + 2);

  const plusFour = specialState('+4');
  plusFour.hands.a = [c('one', 'wild', '+4'), c('two', 'wild', '+4'), c('keep', 'yellow', '9')];
  const beforeFour = plusFour.hands.b.length;
  uno.act(plusFour, 'a', { type: 'play', cardIds: ['one', 'two'], color: 'blue', uno: true });
  assert.equal(plusFour.hands.b.length, beforeFour + 4);
  assert.equal(plusFour.color, 'blue');
});

test('same-value Wild cards group and keep the chosen or current color', () => {
  const s = specialState('wild');
  s.hands.a = [c('one', 'wild', 'wild'), c('two', 'wild', 'wild'), c('keep', 'yellow', '9')];
  uno.act(s, 'a', { type: 'play', cardIds: ['one', 'two'], color: 'green', uno: true });
  assert.equal(s.color, 'green');
  assert.equal(s.hands.a.length, 1);

  const fallback = specialState('wild');
  fallback.hands.a = [c('one', 'wild', 'wild'), c('two', 'wild', 'wild'), c('keep', 'yellow', '9')];
  uno.act(fallback, 'a', { type: 'play', cardIds: ['one', 'two'], uno: true });
  assert.equal(fallback.color, 'red');
});

test('bot groups same-value special cards', () => {
  const s = specialState('skip');
  const move = uno.bot(s, 'a', 'hard');
  assert.deepEqual(move.cardIds, ['one', 'two', 'three']);
});


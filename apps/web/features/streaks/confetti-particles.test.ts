import { describe, expect, it } from 'vitest';

import { createParticles, stepParticles } from './confetti-particles';

const burst = (random = () => 0.5) =>
  createParticles({
    count: 4,
    origin: { x: 100, y: 200 },
    colors: ['#a', '#b'],
    random,
  });

describe('createParticles', () => {
  it('makes the pieces asked for, from the origin, in turn of the colors', () => {
    const particles = burst();

    expect(particles).toHaveLength(4);
    expect(particles.every((p) => p.x === 100 && p.y === 200)).toBe(true);
    expect(particles.map((p) => p.color)).toEqual(['#a', '#b', '#a', '#b']);
  });

  it('shoots them upward', () => {
    const particles = burst();

    expect(particles.every((p) => p.vy < 0)).toBe(true);
  });

  it('falls back to the brand color without colors', () => {
    const [particle] = createParticles({
      count: 1,
      origin: { x: 0, y: 0 },
      colors: [],
      random: () => 0.5,
    });

    expect(particle?.color).toBe('#fa4900');
  });
});

describe('stepParticles', () => {
  it('moves the pieces and pulls them down', () => {
    const [before] = burst();
    if (!before) throw new Error('no particle');

    const [after] = stepParticles([before], 0.1);

    expect(after?.y).toBeLessThan(before.y);
    expect(after?.vy).toBeGreaterThan(before.vy);
    expect(after?.life).toBeCloseTo(before.life - 0.1);
  });

  it('drops the pieces whose life ran out', () => {
    expect(stepParticles(burst(), 5)).toEqual([]);
  });
});

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  /** Seconds left before the piece is gone. */
  life: number;
};

/** Pixels per second squared. */
const GRAVITY = 900;
/** The share of speed kept each second. */
const AIR_KEEP_PER_SECOND = 0.35;
const LIFE_SECONDS = 1.8;

/**
 * A burst of confetti shot upward from `origin`, in `colors`. `random`
 * returns numbers in [0, 1) so tests can pin the burst down.
 */
export function createParticles(options: {
  count: number;
  origin: { x: number; y: number };
  colors: readonly string[];
  random: () => number;
}): Particle[] {
  const { count, origin, colors, random } = options;
  return Array.from({ length: count }, (_, index) => {
    // A fan around straight up, 120 degrees wide.
    const angle = -Math.PI / 2 + (random() - 0.5) * ((Math.PI * 2) / 3);
    const speed = 450 + random() * 550;
    return {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + random() * 6,
      rotation: random() * Math.PI * 2,
      spin: (random() - 0.5) * 12,
      color: colors[index % colors.length] ?? '#fa4900',
      life: LIFE_SECONDS * (0.7 + random() * 0.3),
    };
  });
}

/** The pieces `dtSeconds` later; the ones whose life ran out are dropped. */
export function stepParticles(
  particles: readonly Particle[],
  dtSeconds: number,
): Particle[] {
  const keep = AIR_KEEP_PER_SECOND ** dtSeconds;
  return particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * dtSeconds,
      y: particle.y + particle.vy * dtSeconds,
      vx: particle.vx * keep,
      vy: particle.vy * keep + GRAVITY * dtSeconds,
      rotation: particle.rotation + particle.spin * dtSeconds,
      life: particle.life - dtSeconds,
    }))
    .filter((particle) => particle.life > 0);
}

'use client';

import { useEffect, useRef } from 'react';

import { createParticles, stepParticles } from '../confetti-particles';

const PIECES = 90;
const FRAME_CAP_SECONDS = 0.05;

/** The brand color and its companions, read from the theme's tokens. */
function confettiColors(): string[] {
  const styles = getComputedStyle(document.documentElement);
  const read = (token: string) => styles.getPropertyValue(token).trim();
  return [
    read('--primary'),
    read('--success'),
    read('--foreground'),
    read('--primary-foreground'),
  ].filter((color) => color !== '');
}

/** Two rising notes, a soft "goal" chime. */
function playChime() {
  try {
    const context = new AudioContext();
    const notes = [
      { frequency: 659.25, at: 0 },
      { frequency: 987.77, at: 0.14 },
    ];
    for (const { frequency, at } of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + at;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.75);
    }
    window.setTimeout(() => void context.close(), 1_200);
  } catch {
    // No audio (blocked, or not supported): the toast and confetti remain.
  }
}

function launchConfetti(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const ratio = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * ratio;
  canvas.height = window.innerHeight * ratio;
  context.scale(ratio, ratio);

  let particles = createParticles({
    count: PIECES,
    origin: { x: window.innerWidth / 2, y: window.innerHeight - 72 },
    colors: confettiColors(),
    random: Math.random,
  });
  let last = performance.now();
  let frame = 0;

  const draw = (now: number) => {
    const dt = Math.min(FRAME_CAP_SECONDS, (now - last) / 1000);
    last = now;
    particles = stepParticles(particles, dt);
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const particle of particles) {
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(
        -particle.size / 2,
        -particle.size / 4,
        particle.size,
        particle.size / 2,
      );
      context.restore();
    }
    if (particles.length > 0) frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };
}

/**
 * The celebration of reaching the daily target: confetti over the page and a
 * chime. Each new `burst` number plays it once; 0 is "not yet". Confetti is
 * skipped for visitors who asked for reduced motion (the chime and the toast
 * the caller shows still tell them).
 */
export function StreakCelebration({ burst }: { burst: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (burst === 0) return;
    playChime();
    const element = canvas.current;
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (!element || reduceMotion) return;
    return launchConfetti(element);
  }, [burst]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
      <canvas
        ref={canvas}
        data-testid="streak-confetti"
        className="size-full"
      />
    </div>
  );
}

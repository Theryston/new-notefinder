import type { PlayerState } from './player-port';

/**
 * What every player implementation shares: whether it is ready and the
 * listeners of its state.
 */
export abstract class BasePlayer {
  protected ready = false;
  private readonly listeners = new Set<(state: PlayerState) => void>();

  isReady(): boolean {
    return this.ready;
  }

  /** Listens to state changes; returns the function that stops listening. */
  onState(listener: (state: PlayerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected emit(state: PlayerState): void {
    for (const listener of this.listeners) listener(state);
  }

  protected clearListeners(): void {
    this.listeners.clear();
  }
}

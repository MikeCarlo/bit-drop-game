/**
 * Node smoke check for LocalLeaderboardStore (no test runner).
 *   node --experimental-strip-types src/leaderboard/localStore.check.ts
 */
import { BEST_KEY, LocalLeaderboardStore } from './localStore.ts';
import type { NewScore } from './types.ts';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, value); }
}

function sample(score: number): NewScore {
  return {
    score, won: score > 100, width: 10, viruses: 12, speed: 4,
    playedAt: 1_700_000_000_000 + score, player: 'You', mode: 'solo',
  };
}

async function main() {
  const storage = new MemoryStorage();
  storage.setItem(BEST_KEY, '250');
  const store = new LocalLeaderboardStore(storage);

  const migrated = await store.list();
  if (migrated.length !== 1 || migrated[0]!.score !== 250) {
    throw new Error(`migrate failed: ${JSON.stringify(migrated)}`);
  }

  const first = await store.submit(sample(400));
  if (!first.personalBest || first.rank !== 1) {
    throw new Error(`expected new best rank 1, got ${JSON.stringify(first)}`);
  }

  const second = await store.submit(sample(100));
  if (second.personalBest || second.rank !== 3) {
    throw new Error(`expected rank 3 (behind 400 and migrated 250), got ${JSON.stringify(second)}`);
  }

  const best = await store.best();
  if (best !== 400) throw new Error(`best should be 400, got ${best}`);
  if (storage.getItem(BEST_KEY) !== '400') throw new Error('BEST_KEY not synced');

  console.log('localStore.check ok');
}

void main();

import type { ChallengeView, DuelSettings, DuelState, MatchView, QueueJoinResult, WinsBoard } from './types';

export class DuelRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuelRequestError';
  }
}

async function read<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `Duel request failed (${res.status})`;
    throw new DuelRequestError(message);
  }
  return body as T;
}

export const duelApi = {
  state(): Promise<DuelState> {
    return fetch('/api/duel/state').then((res) => read<DuelState>(res));
  },

  joinQueue(settings: DuelSettings): Promise<QueueJoinResult> {
    return fetch('/api/duel/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).then((res) => read<QueueJoinResult>(res));
  },

  leaveQueue(): Promise<QueueJoinResult> {
    return fetch('/api/duel/queue/leave', { method: 'POST' }).then((res) => read<QueueJoinResult>(res));
  },

  challenge(opponent: string, settings: DuelSettings): Promise<ChallengeView> {
    return fetch('/api/duel/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opponent, ...settings }),
    }).then((res) => read<ChallengeView>(res));
  },

  accept(id: string): Promise<MatchView> {
    return fetch(`/api/duel/challenge/${encodeURIComponent(id)}/accept`, { method: 'POST' }).then((res) =>
      read<MatchView>(res),
    );
  },

  decline(id: string): Promise<{ ok: true }> {
    return fetch(`/api/duel/challenge/${encodeURIComponent(id)}/decline`, { method: 'POST' }).then((res) =>
      read<{ ok: true }>(res),
    );
  },

  cancel(id: string): Promise<{ ok: true }> {
    return fetch(`/api/duel/challenge/${encodeURIComponent(id)}/cancel`, { method: 'POST' }).then((res) =>
      read<{ ok: true }>(res),
    );
  },

  match(id: string): Promise<MatchView> {
    return fetch(`/api/duel/match/${encodeURIComponent(id)}`).then((res) => read<MatchView>(res));
  },

  attack(id: string, body: { attackId: string; round: number; colors: number[] }): Promise<{ ok: true }> {
    return fetch(`/api/duel/match/${encodeURIComponent(id)}/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((res) => read<{ ok: true }>(res));
  },

  round(id: string, body: { round: number; outcome: 'win' | 'lose' }): Promise<MatchView> {
    return fetch(`/api/duel/match/${encodeURIComponent(id)}/round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((res) => read<MatchView>(res));
  },

  ready(id: string): Promise<MatchView> {
    return fetch(`/api/duel/match/${encodeURIComponent(id)}/ready`, { method: 'POST' }).then((res) =>
      read<MatchView>(res),
    );
  },

  forfeit(id: string): Promise<MatchView> {
    return fetch(`/api/duel/match/${encodeURIComponent(id)}/forfeit`, { method: 'POST' }).then((res) =>
      read<MatchView>(res),
    );
  },

  ack(id: string, ids: string[]): Promise<{ ok: true }> {
    return fetch(`/api/duel/match/${encodeURIComponent(id)}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).then((res) => read<{ ok: true }>(res));
  },

  wins(): Promise<WinsBoard> {
    return fetch('/api/duel/wins').then((res) => read<WinsBoard>(res));
  },

  botWins(): Promise<WinsBoard> {
    return fetch('/api/duel/bot-wins').then((res) => read<WinsBoard>(res));
  },

  /** One human win against the PC. Does not touch the monthly human board. */
  recordBotWin(matchId: string): Promise<WinsBoard> {
    return fetch('/api/duel/bot-win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId }),
    }).then((res) => read<WinsBoard>(res));
  },
};

type RealtimeConnect = (
  channel: string,
  onMessage: (data: unknown) => void,
) => { disconnect?: () => void } | void;

/** Devvit `game.tsx` installs this. Web builds poll instead. */
export function subscribeDuel(postId: string, onMessage: (data: unknown) => void): () => void {
  const connect = (window as Window & { __bitdropConnectRealtime?: RealtimeConnect }).__bitdropConnectRealtime;
  if (!postId || typeof connect !== 'function') return () => {};
  try {
    const conn = connect(postId, onMessage);
    return () => {
      try {
        conn?.disconnect?.();
      } catch {
        /* realtime is optional */
      }
    };
  } catch {
    return () => {};
  }
}

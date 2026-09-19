import type { ScoreRecord, SubmitResult } from './scores';

export type ErrorResponse = {
  status: 'error';
  message: string;
};

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
};

export type ScoresListResponse = {
  type: 'scores';
  scores: ScoreRecord[];
};

export type ScoresBestResponse = {
  type: 'best';
  best: number;
};

export type ScoreSubmitResponse = SubmitResult & {
  type: 'submit';
};

export type { NewScore, ScoreRecord, SubmitResult } from './scores';

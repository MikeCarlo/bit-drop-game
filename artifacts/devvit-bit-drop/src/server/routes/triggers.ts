import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostDeleteRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { pruneExpiredScores, scrubDeletedPost } from '../core/leaderboard';

export const triggers = new Hono();

function ok(message: string): TriggerResponse {
  return { status: 'success', message };
}

function fail(message: string): TriggerResponse {
  return { status: 'error', message };
}

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();
    return c.json<TriggerResponse>(
      ok(
        `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      ),
      200,
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(fail('Failed to create post'), 400);
  }
});

/** Reddit has no account-delete trigger. PostDelete removes post-scoped scores. */
triggers.post('/on-post-delete', async (c) => {
  try {
    const input = await c.req.json<OnPostDeleteRequest>();
    const postId = input.postId;
    const postResult = await scrubDeletedPost(postId);
    // Post author is usually the app/mod who created the game post — do not
    // anonymize their whole board. Rows for this post (including player names) are dropped.
    return c.json<TriggerResponse>(
      ok(`Scrubbed post ${postId ?? 'unknown'}: dropped ${postResult.dropped} score rows`),
      200,
    );
  } catch (error) {
    console.error(`Error handling post delete: ${error}`);
    return c.json<TriggerResponse>(fail('Failed to scrub deleted post'), 400);
  }
});

/** Daily backstop so 30-day retention holds even if nobody lists the board. */
triggers.post('/prune-scores', async (c) => {
  try {
    const result = await pruneExpiredScores();
    return c.json<TriggerResponse>(ok(`Pruned ${result.dropped} expired score rows`), 200);
  } catch (error) {
    console.error(`Error pruning scores: ${error}`);
    return c.json<TriggerResponse>(fail('Failed to prune scores'), 400);
  }
});

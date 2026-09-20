import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';

const REPORT_URL =
  'https://www.reddit.com/message/compose/?to=%2Fr%2FBitDropGame&subject=BIT%C2%B7DROP%20%E2%80%94%20app%20issue%20or%20feedback';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();
    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200,
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});

menu.post('/report', async (c) => {
  return c.json<UiResponse>({ navigateTo: REPORT_URL }, 200);
});

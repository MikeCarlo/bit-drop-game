import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOME_SUB, homeSubUrl, reportComposeUrl, wikiUrl } from './report.ts';

test('report compose stays on Reddit modmail for r/BitDropGame', () => {
  const url = reportComposeUrl();
  assert.equal(HOME_SUB, 'BitDropGame');
  assert.match(url, /^https:\/\/www\.reddit\.com\/message\/compose\//);
  assert.match(url, /to=%2Fr%2FBitDropGame/);
  assert.match(url, /BIT/);
  assert.doesNotMatch(url, /docs\.google|forms\.gle|typeform|airtable|mailto:/i);
});

test('wiki and home links stay on r/BitDropGame', () => {
  assert.equal(homeSubUrl(), 'https://www.reddit.com/r/BitDropGame');
  assert.equal(wikiUrl('terms'), 'https://www.reddit.com/r/BitDropGame/wiki/terms');
  assert.equal(wikiUrl('privacy'), 'https://www.reddit.com/r/BitDropGame/wiki/privacy');
});

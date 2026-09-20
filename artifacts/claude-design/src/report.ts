/** Home community for BIT·DROP support, terms, and privacy. */
export const HOME_SUB = 'BitDropGame';

/** Reddit modmail compose for app issues (on-platform; not an external form). */
export function reportComposeUrl(subreddit = HOME_SUB): string {
  const dest = encodeURIComponent(`/r/${subreddit}`);
  const subject = encodeURIComponent('BIT·DROP — app issue or feedback');
  return `https://www.reddit.com/message/compose/?to=${dest}&subject=${subject}`;
}

export function homeSubUrl(): string {
  return `https://www.reddit.com/r/${HOME_SUB}`;
}

export function wikiUrl(page: 'terms' | 'privacy'): string {
  return `https://www.reddit.com/r/${HOME_SUB}/wiki/${page}`;
}

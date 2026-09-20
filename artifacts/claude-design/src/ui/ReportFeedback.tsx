import React from 'react';
import { HOME_SUB, reportComposeUrl } from '../report';

const BODY = 'ui-monospace,Menlo,Consolas,monospace';

/** In-app report path: Reddit modmail to r/BitDropGame (no off-platform form). */
export function ReportFeedback({
  compact = false,
  subreddit = HOME_SUB,
}: {
  compact?: boolean;
  subreddit?: string;
}) {
  return (
    <a
      href={reportComposeUrl(subreddit)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="bitdrop-report"
      style={{
        fontFamily: BODY,
        fontWeight: 700,
        fontSize: compact ? 12 : 13,
        color: '#d9cf4a',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        lineHeight: 1.4,
        touchAction: 'manipulation',
      }}
    >
      {compact ? 'REPORT' : 'REPORT / FEEDBACK'}
    </a>
  );
}

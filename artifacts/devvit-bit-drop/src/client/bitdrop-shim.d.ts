declare module '@bitdrop/App' {
  import type { ComponentType } from 'react';
  const App: ComponentType;
  export default App;
}

declare module '@bitdrop/index.css';
declare module '@bitdrop/ui/ReportFeedback' {
  import type { ComponentType } from 'react';
  export const ReportFeedback: ComponentType<{ compact?: boolean; subreddit?: string }>;
}

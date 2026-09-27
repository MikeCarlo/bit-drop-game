declare module '@bitdrop/App' {
  import type { ComponentType } from 'react';
  const App: ComponentType;
  export default App;
}

declare module '@bitdrop/index.css';
interface Window {
  __bitdropConnectRealtime?: (
    channel: string,
    onMessage: (data: unknown) => void,
  ) => { disconnect?: () => void };
}

declare module '@bitdrop/ui/ReportFeedback' {
  import type { ComponentType } from 'react';
  export const ReportFeedback: ComponentType<{ compact?: boolean; subreddit?: string }>;
}

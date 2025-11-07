import { useEffect } from 'react';
import { Activity } from 'lucide-react';
import { ConnectStatus } from './ConnectStatus';
import { useMetricsStore } from '../lib/store';
import { AgentSelector } from './AgentSelector';

export function Header() {
  const { authToken, setAuthToken } = useMetricsStore();

  // Persist token in localStorage (optional auth)
  useEffect(() => {
    const saved = localStorage.getItem('API_TOKEN');
    if (saved && !authToken) {
      setAuthToken(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authToken && authToken.length > 0) {
      localStorage.setItem('API_TOKEN', authToken);
    } else {
      localStorage.removeItem('API_TOKEN');
    }
  }, [authToken]);
  return (
    <header className="border-b border-border bg-card sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Logo and title */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">RPC Stream Monitor</h1>
              <p className="text-xs text-muted-foreground">Real-time system metrics via gRPC</p>
            </div>
          </div>

          {/* Agent selector & status */}
          <div className="flex items-center gap-4 flex-wrap">
            <AgentSelector />
            <ConnectStatus />
              <label className="text-xs font-medium text-muted-foreground">Token</label>
              <input
                type="password"
                value={authToken ?? ''}
                onChange={(e) => setAuthToken(e.target.value ? e.target.value : null)}
                placeholder="Token (opcional)"
                className="px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[14rem]"
              />
            </div>
          </div>
        </div>
    </header>
  );
}

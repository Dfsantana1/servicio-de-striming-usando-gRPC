import { AlertCircle, Wifi, WifiOff, Loader } from 'lucide-react';
import { useMetricsStore } from '../lib/store';

export function ConnectStatus() {
  const { connectionStatus, errorMessage } = useMetricsStore();

  const statusConfig = {
    idle: {
      icon: WifiOff,
      text: 'Desconectado',
      color: 'bg-gray-500',
      textColor: 'text-gray-500',
    },
    connecting: {
      icon: Loader,
      text: 'Conectando...',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-500',
      animate: true,
    },
    connected: {
      icon: Wifi,
      text: 'Conectado',
      color: 'bg-green-500',
      textColor: 'text-green-500',
    },
    error: {
      icon: AlertCircle,
      text: 'Error',
      color: 'bg-red-500',
      textColor: 'text-red-500',
    },
  } as const satisfies Record<
    'idle' | 'connecting' | 'connected' | 'error',
    { icon: typeof AlertCircle; text: string; color: string; textColor: string; animate?: boolean }
  >;

  const config = statusConfig[connectionStatus as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
  <div className={`p-2 rounded-full ${config.color} ${(config as { animate?: boolean }).animate ? 'animate-pulse' : ''}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${config.textColor}`}>
          {config.text}
        </span>
        {errorMessage && (
          <span className="text-xs text-red-500 truncate max-w-xs">
            {errorMessage}
          </span>
        )}
      </div>
    </div>
  );
}

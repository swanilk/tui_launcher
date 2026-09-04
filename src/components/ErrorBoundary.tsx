import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Terminal Launcher Uncaught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-black text-red-500 font-mono p-6 flex flex-col justify-between select-none overflow-y-auto">
          <div>
            <div className="border border-red-800 bg-red-950/40 p-4 rounded mb-4">
              <h1 className="text-lg font-bold text-red-400 mb-1">
                ⚠️ KERNEL PANIC: TUI LAUNCHER INITIALIZATION FAULT
              </h1>
              <p className="text-xs text-neutral-300 mb-3">
                A fatal runtime exception occurred during rendering. The interface has entered safe recovery mode.
              </p>
              <div className="bg-black/90 p-3 rounded border border-red-900/60 font-mono text-xs text-red-300 overflow-x-auto whitespace-pre-wrap">
                {this.state.error?.toString() || 'Unknown runtime error'}
                {this.state.error?.stack && `\n\nStack:\n${this.state.error.stack}`}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-800">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded font-mono text-sm active:scale-95 transition-all cursor-pointer"
            >
              🔄 Reload Launcher
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-red-950/60 hover:bg-red-900/80 border border-red-700 text-red-200 rounded font-mono text-sm active:scale-95 transition-all cursor-pointer"
            >
              ⚠️ Clear Storage & Reset Defaults
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

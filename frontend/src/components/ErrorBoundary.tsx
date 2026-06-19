import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex min-h-screen items-center justify-center bg-base p-6">
                    <div className="flex max-w-md flex-col items-center gap-4 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10">
                            <AlertTriangle className="h-8 w-8 text-rose-500" />
                        </div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-primary">Something went wrong</h1>
                        <p className="text-sm leading-6 text-secondary">
                            An unexpected error occurred. Try refreshing the page.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-primary-hover"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

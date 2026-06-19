import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const Boom = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('test error');
    }
    return <p>all good</p>;
};

describe('ErrorBoundary', () => {
    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <p>hello</p>
            </ErrorBoundary>
        );
        expect(screen.getByText('hello')).toBeInTheDocument();
    });

    it('shows fallback UI when a child throws', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary>
                <Boom shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it('uses custom fallback when provided', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary fallback={<p>custom fallback</p>}>
                <Boom shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('custom fallback')).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it('renders Refresh Page button in fallback', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary>
                <Boom shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Refresh Page')).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it('renders AlertTriangle icon in the fallback', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { container } = render(
            <ErrorBoundary>
                <Boom shouldThrow={true} />
            </ErrorBoundary>
        );
        // AlertTriangle renders as an svg inside the container
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        consoleSpy.mockRestore();
    });
});

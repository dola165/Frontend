import { Component, type ReactNode } from 'react';

interface Props {
    /** Changes when the page changes: a map that failed is tried again on the next page. */ resetKey: string;
    fallback: (retry: () => void) => ReactNode;
    children: ReactNode;
}

/**
 * Keeps a failure of World's map (its street map code failing to load, a page's pill throwing) inside the map, so the
 * tabs and the page below stay usable. It does not remount the map when the page changes, only after a failure.
 */
export class MapBoundary extends Component<Props, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: Error) {
        console.error('World map failed:', error);
    }

    componentDidUpdate(previous: Props) {
        if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
    }

    render() {
        return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
    }
}

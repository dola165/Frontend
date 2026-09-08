import { ArrowRight, Compass, Construction, SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

interface RouteRecoveryPageProps {
    feature?: string;
    recoveryPath?: string;
    recoveryLabel?: string;
}

export const RouteRecoveryPage = ({ feature, recoveryPath, recoveryLabel }: RouteRecoveryPageProps) => {
    const { id } = useParams<{ id: string }>();
    const destination = recoveryPath ?? (id ? `/clubs/${id}` : '/clubs');
    const destinationLabel = recoveryLabel ?? (id ? 'Back to club' : 'Browse clubs');
    const isPreviewRoute = Boolean(feature);

    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-12 text-center">
            <section className="w-full max-w-2xl rounded-3xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-6 py-12 shadow-xl sm:px-10">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                    {isPreviewRoute ? <Construction className="h-8 w-8" /> : <SearchX className="h-8 w-8" />}
                </span>
                {isPreviewRoute ? <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Coming later</p> : null}
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--text-primary)] sm:text-3xl">
                    {isPreviewRoute ? `${feature} is outside this demo` : 'We could not find that page'}
                </h1>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[color:var(--text-secondary)]">
                    {isPreviewRoute
                        ? 'This demo currently focuses on club discovery, public profiles, community posts, schedules, messages, and club operations.'
                        : 'The link may be old or incomplete. Choose a working destination below to continue.'}
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Link to={destination} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-500">
                        {destinationLabel}<ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link to="/world" className="inline-flex h-11 items-center gap-2 rounded-xl border border-[color:var(--theme-border-strong)] px-5 text-sm font-bold text-[color:var(--text-primary)] transition hover:bg-[color:var(--theme-surface-inset)]">
                        <Compass className="h-4 w-4" />Explore the map
                    </Link>
                </div>
            </section>
        </div>
    );
};

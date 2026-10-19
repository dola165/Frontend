import { TryoutCancellationNotice } from '../../tryouts/TryoutCancellationNotice';
import { TryoutApplicationWithdrawal } from '../../tryouts/TryoutApplicationWithdrawal';
import { formatDate } from '../../../utils/formatting';
import { surfaceClass, type TryoutApp } from './accountModel';

const tryoutStatusStyle = (status: string) => {
    switch (status) {
        case 'ACCEPTED':
            return 'bg-[var(--fc-accent-soft)] text-[var(--fc-accent)]';
        case 'REJECTED':
            return 'bg-[var(--fc-state-danger-soft)] text-[var(--fc-state-danger)]';
        case 'SHORTLISTED':
            return 'bg-[var(--fc-state-warning-soft)] text-[var(--fc-state-warning)]';
        default:
            return 'bg-transparent text-[var(--fc-text-muted)]';
    }
};

export const AccountTryoutApplications = ({ apps, loading, error, onHide, onReload }: {
    apps: TryoutApp[]; loading: boolean; error: string | null; onHide: () => void; onReload: () => void;
}) => (
    <section className={`${surfaceClass} px-5 py-5`}>
        <div className="flex items-center justify-between gap-3">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fc-text-muted)]">Tryout Applications</p>
                <h3 className="mt-1 text-base font-semibold text-[color:var(--fc-text-primary)]">My Submitted Applications</h3>
            </div>
            <button
                type="button"
                onClick={onHide}
                className="text-xs font-medium text-[color:var(--fc-text-secondary)] hover:text-[color:var(--fc-text-primary)]"
            >
                Hide
            </button>
        </div>
        {loading ? <p role="status">Loading tryout applications…</p> : error ? <p role="alert">{error}<button type="button" onClick={onReload}>Retry</button></p> : apps.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--fc-text-secondary)]">You haven't applied to any tryouts yet.</p>
        ) : (
            <div className="mt-4 grid gap-2">
                {apps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--fc-border)] bg-[color:var(--fc-page-bg)] px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-[color:var(--fc-text-primary)]">{app.tryoutTitle}</p>
                            <TryoutCancellationNotice application={app}/>
                            <TryoutApplicationWithdrawal application={app} onChanged={onReload}/>
                            <p className="text-xs text-[color:var(--fc-text-secondary)]">
                                Applied {formatDate(app.appliedAt, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${tryoutStatusStyle(app.status)}`}>
                            {app.status}
                        </span>
                    </div>
                ))}
            </div>
        )}
    </section>
);

import { MediaImage } from '../components/ui/MediaImage';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserRoundSearch, UsersRound } from 'lucide-react';
import { chatApi, type UserSearchResult } from '../api/chat';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const initialsFrom = (person: UserSearchResult) =>
    (person.fullName || person.username || 'GK')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

const readableRole = (value?: string | null) =>
    (value || 'Football member')
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

export const PeoplePage = () => {
    const [query, setQuery] = useState('');
    const [people, setPeople] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const trimmedQuery = query.trim();

    useEffect(() => {
        let active = true;

        if (trimmedQuery.length < 2) {
            return () => {
                active = false;
            };
        }

        const timer = window.setTimeout(() => {
            if (active) {
                setLoading(true);
                setError('');
            }
            void chatApi
                .searchUsers(trimmedQuery, 0, 30)
                .then((response) => {
                    if (active) setPeople(response.data.content ?? []);
                })
                .catch(() => {
                    if (active) {
                        setPeople([]);
                        setError('People could not be loaded right now. Please try again.');
                    }
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        }, 250);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [trimmedQuery]);

    return (
        <div className="people-directory mx-auto w-full max-w-5xl py-2">
            <header className="border-b border-[var(--border-subtle)] pb-6">
                <div className="flex items-center gap-3 text-[var(--accent-primary)]">
                    <UsersRound className="h-5 w-5" />
                    <span className="text-xs font-bold uppercase tracking-[0.16em]">Your network</span>
                </div>
                <h1 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">Following & people</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                    Find and follow players, coaches, organisers and other people around the football community.
                </p>
            </header>

            <section className="py-6" aria-labelledby="people-search-heading">
                <h2 id="people-search-heading" className="sr-only">Search people</h2>
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search by name or username"
                        autoComplete="off"
                        className="h-14 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--theme-surface-strong)] pl-12 pr-4 text-base text-[var(--text-primary)] shadow-[var(--shadow-panel)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary-soft)]"
                    />
                </label>

                <div className="mt-5" aria-live="polite">
                    {trimmedQuery.length < 2 ? (
                        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--theme-surface)] px-6 text-center">
                            <UserRoundSearch className="h-9 w-9 text-[var(--accent-primary)]" />
                            <p className="mt-4 font-semibold text-[var(--text-primary)]">Start with a name</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">Type at least two characters to find someone.</p>
                        </div>
                    ) : loading ? (
                        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">Searching people…</div>
                    ) : error ? (
                        <div className="rounded-xl border border-[color:var(--color-danger)]/25 bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm text-[color:var(--color-danger)] dark:text-[color:var(--color-danger)]">{error}</div>
                    ) : people.length === 0 ? (
                        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">No people match “{trimmedQuery}”.</div>
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {people.map((person) => {
                                const displayName = person.fullName || person.username;
                                const avatarUrl = resolveMediaUrl(person.avatarUrl);
                                return (
                                    <Link
                                        key={person.id}
                                        to={`/profile/${person.id}`}
                                        className="group flex min-w-0 items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--theme-surface-strong)] p-4 shadow-[var(--shadow-panel)] transition-all hover:-translate-y-0.5 hover:border-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                                    >
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-primary-soft)] text-sm font-bold text-[var(--accent-primary)] ring-1 ring-[var(--border-subtle)]">
                                            {avatarUrl ? <MediaImage src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsFrom(person)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">{displayName}</span>
                                            <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">
                                                {[person.position, readableRole(person.userType)].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

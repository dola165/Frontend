import { MediaImage } from '../ui/MediaImage';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, User, Building2, Trophy, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dolaNavigationState, isDolaQuestion } from '../../features/dola/navigation';
import { apiClient } from '../../api/axiosConfig';
import { HighlightedText } from './HighlightedText';

interface UserResult {
  type: 'user';
  id: number;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  position: string | null;
}

interface ClubResult {
  type: 'club';
  id: number;
  name: string;
  logoUrl: string | null;
  memberCount: number;
  city: string | null;
}

interface TournamentResult {
  type: 'tournament';
  id: number;
  name: string;
  description: string | null;
  status: string;
  participantScope: string;
  entryCount: number;
  hostClubName: string | null;
}

type SearchResult = UserResult | ClubResult | TournamentResult;

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export const GlobalSearchBar = ({ light = false, mobile = false }: { light?: boolean; mobile?: boolean }) => {
  const { t, i18n } = useTranslation();
  const { user, sessionId } = useAuth();
  const ka = i18n.language?.startsWith('ka');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const canAsk = !!user && !!sessionId && query.trim().length >= MIN_QUERY_LENGTH;
  const questionIntent = canAsk && isDolaQuestion(query);
  const currentResults = query.trim() === debouncedQuery ? results : [];
  const askIndex = questionIntent ? 0 : currentResults.length;
  const resultOffset = questionIntent ? 1 : 0;
  const optionCount = currentResults.length + (canAsk ? 1 : 0);

  function openDola() {
    if (!canAsk) return;
    navigate('/assistant', { state: dolaNavigationState(query, sessionId) });
    setQuery(''); setDebouncedQuery(''); setResults([]); setIsOpen(false);
    inputRef.current?.blur();
  }

  useEffect(() => {
    if (mobile) inputRef.current?.focus();
  }, [mobile]);

  // Debounce the query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Run search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsOpen(false);
      setError(false);
      return;
    }

    let cancelled = false;
    const doSearch = async () => {
      setIsLoading(true);
      setError(false);
      setSelectedIndex(-1);

      try {
        const [usersRes, clubsRes, tournamentsRes] = await Promise.allSettled([
          apiClient.get('/users/search', { params: { query: debouncedQuery, page: 0, size: 5 } }),
          apiClient.get('/clubs/search', { params: { q: debouncedQuery, limit: 5 } }),
          apiClient.get('/tournaments', { params: { size: 30 } }),
        ]);

        if (cancelled) return;

        const merged: SearchResult[] = [];

        // Users — backend returns PageResult wrapping content array
        if (usersRes.status === 'fulfilled') {
          const userData = usersRes.value.data;
          const userList = userData?.content ?? (Array.isArray(userData) ? userData : []);
          for (const u of userList) {
            merged.push({
              type: 'user',
              id: u.id,
              fullName: u.fullName ?? '',
              username: u.username ?? '',
              avatarUrl: u.avatarUrl ?? null,
              position: u.position ?? null,
            });
          }
        }

        // Clubs — backend returns array directly
        if (clubsRes.status === 'fulfilled') {
          const clubList = Array.isArray(clubsRes.value.data) ? clubsRes.value.data : (clubsRes.value.data?.content ?? []);
          for (const c of clubList) {
            merged.push({
              type: 'club',
              id: c.id,
              name: c.name,
              logoUrl: c.logoUrl ?? null,
              memberCount: c.memberCount ?? 0,
              city: c.city ?? null,
            });
          }
        }

        // Tournaments — client-side filter from browse endpoint
        if (tournamentsRes.status === 'fulfilled') {
          const tData = tournamentsRes.value.data;
          const tList = tData?.content ?? (Array.isArray(tData) ? tData : []);
          const q = debouncedQuery.toLowerCase();
          for (const t of tList) {
            const nameMatch = (t.name ?? '').toLowerCase().includes(q);
            const descMatch = (t.description ?? '').toLowerCase().includes(q);
            if (nameMatch || descMatch) {
              merged.push({
                type: 'tournament',
                id: t.id,
                name: t.name,
                description: t.description ?? null,
                status: t.status,
                participantScope: t.participantScope,
                entryCount: t.entryCount ?? 0,
                hostClubName: t.hostClubName ?? null,
              });
            }
          }
        }

        if (cancelled) return;
        setResults(merged);
        setIsOpen(true);
        setError(
          usersRes.status === 'rejected' &&
          clubsRes.status === 'rejected' &&
          tournamentsRes.status === 'rejected'
        );
      } catch {
        if (!cancelled) {
          setError(true);
          setResults([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void doSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Click-away listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        if (optionCount) setSelectedIndex((prev) => (prev + 1) % optionCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsOpen(true);
        if (optionCount) setSelectedIndex((prev) => prev <= 0 ? optionCount - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (canAsk && (isOpen && selectedIndex === askIndex || selectedIndex < 0 && questionIntent)) {
          openDola();
          break;
        }
        if (isOpen && currentResults.length) {
          const r = currentResults[selectedIndex < 0 ? 0 : selectedIndex - resultOffset];
          if (!r) break;
          navigate(getResultLink(r));
          setQuery('');
          setIsOpen(false);
          inputRef.current?.blur();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const getResultLink = (r: SearchResult): string => {
    switch (r.type) {
      case 'user': return `/profile/${r.id}`;
      case 'club': return `/clubs/${r.id}`;
      case 'tournament': return `/tournaments/${r.id}`;
    }
  };

  const getResultIcon = (r: SearchResult) => {
    switch (r.type) {
      case 'user': return <User className="h-4 w-4 shrink-0 text-[#71717a]" />;
      case 'club': return <Building2 className="h-4 w-4 shrink-0 text-[#71717a]" />;
      case 'tournament': return <Trophy className="h-4 w-4 shrink-0 text-[#71717a]" />;
    }
  };

  const clearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    setIsOpen(false);
    setError(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={mobile ? 'relative flex min-w-0 flex-1' : 'relative hidden min-w-0 max-w-xl flex-1 lg:flex'}>
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717a]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(-1); setIsOpen(e.target.value.trim().length >= MIN_QUERY_LENGTH); }}
          onFocus={() => { if (query.trim().length >= MIN_QUERY_LENGTH) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={user ? ka ? 'მოძებნეთ ან ჰკითხეთ Dola-ს…' : 'Search or ask Agent Dola…' : t('search.placeholder')}
          maxLength={2000}
          className={`w-full rounded-full border py-2 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-[#71717a] focus:border-[#16a34a] ${light ? 'border-slate-200 bg-white text-slate-900 focus:bg-slate-50' : 'border-[#ffffff0d] bg-[#16181d] text-[#f4f4f5] focus:bg-[#1a1c22]'}`}
          aria-label={t('search.ariaLabel')}
          autoComplete="off"
          spellCheck={false}
        />
        {/* Loading spinner or clear button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#71717a]" />
          ) : query.length > 0 ? (
            <button
              type="button"
              onClick={clearSearch}
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[#71717a] ${light ? 'hover:bg-slate-100 hover:text-slate-900' : 'hover:bg-[#1a1c22] hover:text-[#f4f4f5]'}`}
              aria-label={t('search.clear')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className={`absolute left-0 right-0 top-full z-50 mt-2 max-h-[420px] overflow-y-auto rounded-xl border shadow-2xl ${light ? 'border-slate-200 bg-white' : 'border-[#ffffff0d] bg-[#16181d]'}`}>
          {canAsk && questionIntent && renderDolaOption()}
          {error ? (
            <div className="px-4 py-6 text-center text-sm text-[#a1a1aa]">
              {t('search.loadFailed')}
            </div>
          ) : currentResults.length === 0 && debouncedQuery.length >= MIN_QUERY_LENGTH && !isLoading && !questionIntent ? (
            <div className="px-4 py-6 text-center text-sm text-[#a1a1aa]">
              {t('search.noResults', { query: debouncedQuery })}
            </div>
          ) : (
            <ul className="py-2">
              {currentResults.map((r, idx) => (
                <li key={`${r.type}-${r.id}`}>
                  <Link
                    to={getResultLink(r)}
                    aria-label={`${r.type === 'user' ? r.fullName || r.username : r.name} · ${r.type === 'user' ? t('search.person') : r.type === 'club' ? t('search.club') : t('search.event')}`}
                    onClick={() => {
                      setQuery('');
                      setIsOpen(false);
                      setResults([]);
                    }}
                    className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${
                      idx + resultOffset === selectedIndex
                        ? light ? 'bg-slate-100' : 'bg-[#1a1c22]'
                        : light ? 'hover:bg-slate-50' : 'hover:bg-[#1a1c22]'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${light ? 'bg-slate-100' : 'bg-[#1a1c22]'}`}>
                      {r.type === 'user' && r.avatarUrl ? (
                        <MediaImage src={r.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        getResultIcon(r)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm font-semibold ${light ? 'text-slate-900' : 'text-[#f4f4f5]'}`}>
                          <HighlightedText text={r.type === 'user' ? (r.fullName || r.username) : r.name} query={debouncedQuery} />
                        </span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#a1a1aa] ${light ? 'bg-slate-100' : 'bg-[#1a1c22]'}`}>
                          {r.type === 'user' ? t('search.person') : r.type === 'club' ? t('search.club') : t('search.event')}
                        </span>
                      </div>
                      {r.type === 'user' && r.position && (
                        <p className="mt-0.5 truncate text-xs text-[#a1a1aa]">{r.position}</p>
                      )}
                      {r.type === 'user' && !r.position && r.username && (
                        <p className="mt-0.5 truncate text-xs text-[#a1a1aa]">@{r.username}</p>
                      )}
                      {r.type === 'club' && (
                        <p className="mt-0.5 text-xs text-[#a1a1aa]">
                          {[r.city, r.memberCount > 0 ? t('search.members', { count: r.memberCount }) : null].filter(Boolean).join(' · ') || t('search.club')}
                        </p>
                      )}
                      {r.type === 'tournament' && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[#a1a1aa]">
                          <HighlightedText text={r.description ?? ''} query={debouncedQuery} />
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canAsk && !questionIntent && renderDolaOption()}
        </div>
      )}
    </div>
  );

  function renderDolaOption() {
    return <button type="button" onClick={openDola}
      className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors ${light ? 'border-slate-100 text-emerald-800 hover:bg-emerald-50' : 'border-white/5 text-emerald-200 hover:bg-emerald-400/10'} ${selectedIndex === askIndex ? light ? 'bg-emerald-50' : 'bg-emerald-400/10' : ''}`}>
      <Sparkles className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{ka ? 'ჰკითხეთ Agent Dola-ს' : 'Ask Agent Dola'}</span><span className="block truncate text-xs opacity-75">{query.trim()}</span></span>
      {questionIntent && <span className="text-xs opacity-60">↵</span>}
    </button>;
  }
};

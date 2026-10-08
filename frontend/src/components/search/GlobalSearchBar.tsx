import { MediaImage } from '../ui/MediaImage';
import { useEffect, useRef, useState, useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, User, Building2, Trophy, X, Sparkles, Warehouse, MapPinned, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dolaNavigationState, isDolaQuestion } from '../../features/dola/navigation';
import { searchDirectory, resultLink, resultName, type SearchResult, type SearchKind, type SearchActivity, type SearchResponse } from './discoverySearch';
import { typeLabel } from '../../features/organizations/setup/domain';
import './discovery-search.css';
import { HighlightedText } from './HighlightedText';

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export const GlobalSearchBar = (props: { light?: boolean; mobile?: boolean }) => {
  const { sessionId, user } = useAuth();
  return <SearchContent key={`${user?.id}:${sessionId}`} {...props} />;
};

function SearchContent({ light = false, mobile = false }: { light?: boolean; mobile?: boolean }) {
  const { t, i18n } = useTranslation();
  const { user, sessionId } = useAuth();
  const signedIn = !!user;
  const ka = i18n.language?.startsWith('ka');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [response, setResponse] = useState<(SearchResponse & { key: string }) | null>(null);
  const [kind, setKind] = useState<SearchKind>('ALL');
  const [place, setPlace] = useState('');
  const [debouncedPlace, setDebouncedPlace] = useState('');
  const [activity, setActivity] = useState<SearchActivity>('ALL');
  const [retry, setRetry] = useState(0);
  const filterId = useId();
  const requestKey = JSON.stringify([debouncedQuery, kind, debouncedPlace, activity]);
  const visibleKey = JSON.stringify([query.trim(), kind, place.trim(), activity]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const canAsk = !!user && !!sessionId && query.trim().length >= MIN_QUERY_LENGTH;
  const questionIntent = canAsk && isDolaQuestion(query);
  const current = response?.key === visibleKey ? response : null;
  const currentResults = current?.results ?? [];
  const tooLong = query.trim().length > 200;
  const error = current?.failed ?? false;
  const askIndex = questionIntent ? 0 : currentResults.length;
  const resultOffset = questionIntent ? 1 : 0;
  const optionCount = currentResults.length + (canAsk ? 1 : 0);

  function openDola() {
    if (!canAsk) return;
    navigate('/assistant', { state: dolaNavigationState(query, sessionId) });
    setQuery(''); setDebouncedQuery(''); setResponse(null); setIsOpen(false);
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
      setDebouncedPlace(place.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, place]);

  // Each response belongs to a query, filter set and mounted account session.
  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH || debouncedQuery.length > 200) {
      setResponse(null);
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setSelectedIndex(-1);
    void searchDirectory(debouncedQuery, kind, debouncedPlace, activity, signedIn, sessionId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setResponse({ ...result, key: requestKey }); })
      .catch(() => { if (!controller.signal.aborted) setResponse({ key: requestKey, results: [], failed: true, partial: false, more: false }); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [debouncedQuery, debouncedPlace, kind, activity, sessionId, signedIn, requestKey, retry]);

  useEffect(() => {
    containerRef.current?.querySelector('[data-search-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

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
          navigate(resultLink(r));
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

  const label = (r: SearchResult) => r.type === 'organization' ? ka ? 'ორგანიზაცია' : 'Organization'
    : r.type === 'venue' ? ka ? 'სპორტული სივრცე' : 'Venue'
    : r.type === 'user' ? t('search.person') : r.type === 'club' ? t('search.club') : t('search.event');

  const getResultIcon = (r: SearchResult) => {
    switch (r.type) {
      case 'user': return <User className="h-4 w-4 shrink-0 text-[var(--color-secondary)]" />;
      case 'organization':
      case 'club': return <Building2 className="h-4 w-4 shrink-0 text-[var(--color-secondary)]" />;
      case 'venue': return <Warehouse className="h-4 w-4 shrink-0 text-[var(--color-secondary)]" />;
      case 'tournament': return <Trophy className="h-4 w-4 shrink-0 text-[var(--color-secondary)]" />;
      case 'event': return <Trophy className="h-4 w-4 shrink-0 text-[var(--color-secondary)]" />;
    }
  };

  const clearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setResponse(null);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={mobile ? 'relative flex min-w-0 flex-1' : 'relative hidden min-w-0 max-w-xl flex-1 lg:flex'}>
      <div className={`global-search-field ${light ? 'global-search-field--light' : ''} relative w-full`}>
        <Search aria-hidden="true" className="global-search-field__icon absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(-1); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={ka ? 'მოძებნეთ ადამიანები, კლუბები, ადგილები…' : 'Search people, clubs, places…'}
          maxLength={2000}
          className="global-search-field__input w-full py-2.5 pl-11 pr-9 text-sm outline-none"
          aria-label={t('search.ariaLabel')}
          aria-controls={isOpen ? `${filterId}-results` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {/* Loading spinner or clear button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-secondary)]" />
          ) : query.length > 0 ? (
            <button
              type="button"
              onClick={clearSearch}
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[var(--color-secondary)] ${light ? 'hover:bg-[color:var(--color-inset)] hover:text-[color:var(--color-text)]' : 'hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'}`}
              aria-label={t('search.clear')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div id={`${filterId}-results`} aria-label={ka ? 'ძიების შედეგები' : 'Search results'} role="region" className={`global-search-panel ${light ? 'discovery-light' : ''} absolute left-0 right-0 top-full z-50 mt-2 max-h-[420px] overflow-y-auto rounded-xl border shadow-2xl`}>
          {query.trim().length < MIN_QUERY_LENGTH && <div className="global-search-start">
            <p className="global-search-start__title">{ka ? 'იპოვეთ თქვენი ფეხბურთი' : 'Find your football'}</p>
            <p className="global-search-start__hint">{ka ? 'ჩაწერეთ სახელი, კლუბი ან ადგილი.' : 'Start with a name, club, or place.'}</p>
            <div className="global-search-start__links">
              <Link to="/clubs" onClick={() => setIsOpen(false)}><Building2 aria-hidden="true" />{ka ? 'კლუბები' : 'Browse clubs'}<ArrowUpRight aria-hidden="true" /></Link>
              <Link to="/map" onClick={() => setIsOpen(false)}><MapPinned aria-hidden="true" />{ka ? 'რუკა' : 'Explore the map'}<ArrowUpRight aria-hidden="true" /></Link>
            </div>
            {user && <p className="global-search-start__dola"><Sparkles aria-hidden="true" />{ka ? 'ან ჩაწერეთ კითხვა Agent Dola-სთვის.' : 'Or type a question to ask Agent Dola.'}</p>}
          </div>}
          {query.trim().length >= MIN_QUERY_LENGTH && <>
          {user && <div className="discovery-filters">
            <label htmlFor={`${filterId}-kind`}>{ka ? 'ძებნა' : 'Search in'}<select id={`${filterId}-kind`} value={kind} onChange={e => { setKind(e.target.value as SearchKind); setPlace(''); setDebouncedPlace(''); setActivity('ALL'); setSelectedIndex(-1); }}>
              <option value="ALL">{ka ? 'ყველაფერი' : 'Everything'}</option><option value="ORGANIZATION">{ka ? 'ორგანიზაციები' : 'Organizations'}</option><option value="VENUE">{ka ? 'სპორტული სივრცეები' : 'Venues'}</option><option value="EVENT">{ka ? 'ღონისძიებები' : 'Events'}</option>
            </select></label>
            {kind !== 'ALL' && <label htmlFor={`${filterId}-place`}>{ka ? 'ქალაქი ან მისამართი' : 'City or address'}<input id={`${filterId}-place`} maxLength={100} value={place} onChange={e => setPlace(e.target.value)} placeholder={ka ? 'ნებისმიერი ადგილი' : 'Any location'} /></label>}
            {kind === 'ORGANIZATION' && <label htmlFor={`${filterId}-activity`}>{ka ? 'საქმიანობა' : 'Activity'}<select id={`${filterId}-activity`} value={activity} onChange={e => { setActivity(e.target.value as SearchActivity); setSelectedIndex(-1); }}><option value="ALL">{ka ? 'ყველა' : 'All activities'}</option><option value="VENUE">{ka ? 'გამოქვეყნებული სივრცეებით' : 'With published venues'}</option><option value="TOURNAMENT">{ka ? 'ტურნირის ორგანიზატორები' : 'Tournament organizers'}</option></select></label>}
          </div>}
          {canAsk && questionIntent && renderDolaOption()}
          {tooLong && <p role="status" className="discovery-note">{ka ? 'სახელის ძებნისთვის გამოიყენეთ მაქსიმუმ 200 სიმბოლო.' : 'Use up to 200 characters to search names. Longer questions can be sent to Dola.'}</p>}
          {current?.partial && <p role="status" className="discovery-note">{ka ? 'ზოგი შედეგი მიუწვდომელია.' : 'Some search results are unavailable.'} <button type="button" onClick={() => setRetry(n => n + 1)}>{ka ? 'ხელახლა ცდა' : 'Retry'}</button></p>}
          {error ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--color-secondary)]">
              {t('search.loadFailed')} <button type="button" onClick={() => setRetry(n => n + 1)}>{ka ? 'ხელახლა ცდა' : 'Retry'}</button>
            </div>
          ) : current && currentResults.length === 0 && !isLoading && !questionIntent && !tooLong && !current.partial ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--color-secondary)]">
              {t('search.noResults', { query: debouncedQuery })}
            </div>
          ) : (
            <ul className="py-2">
              {currentResults.map((r, idx) => (
                <li key={`${r.type}-${'kind' in r ? r.kind : ''}-${r.id}`}>
                  <Link
                    to={resultLink(r)}
                    data-search-selected={idx + resultOffset === selectedIndex}
                    aria-label={`${resultName(r)} · ${label(r)}${'location' in r && r.location ? ` · ${r.location}` : ''}`}
                    onClick={() => {
                      setQuery('');
                      setIsOpen(false);
                      setResponse(null);
                    }}
                    className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${
                      idx + resultOffset === selectedIndex
                        ? light ? 'bg-[color:var(--color-inset)]' : 'bg-[var(--color-surface)]'
                        : light ? 'hover:bg-[color:var(--color-elevated)]' : 'hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${light ? 'bg-[color:var(--color-inset)]' : 'bg-[var(--color-surface)]'}`}>
                      {r.type === 'user' && r.avatarUrl ? (
                        <MediaImage src={r.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        getResultIcon(r)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm font-semibold ${light ? 'text-[color:var(--color-text)]' : 'text-[var(--color-text)]'}`}>
                          <HighlightedText text={r.type === 'user' ? (r.fullName || r.username) : r.name} query={debouncedQuery} />
                        </span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-secondary)] ${light ? 'bg-[color:var(--color-inset)]' : 'bg-[var(--color-surface)]'}`}>
                          {label(r)}
                        </span>
                      </div>
                      {r.type === 'user' && r.position && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-secondary)]">{r.position}</p>
                      )}
                      {r.type === 'user' && !r.position && r.username && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-secondary)]">@{r.username}</p>
                      )}
                      {r.type === 'club' && (
                        <p className="mt-0.5 text-xs text-[var(--color-secondary)]">
                          {[r.city, r.memberCount > 0 ? t('search.members', { count: r.memberCount }) : null].filter(Boolean).join(' · ') || t('search.club')}
                        </p>
                      )}
                      {(r.type === 'organization' || r.type === 'venue') && <>
                        <p className="mt-0.5 text-xs text-[var(--color-secondary)]">{r.location || (ka ? 'ადგილმდებარეობა არ არის მითითებული' : 'Location not listed')}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-secondary)]">{r.type === 'organization' ? `${typeLabel(r.profileKind)}${r.venueCount ? ` · ${r.venueCount} ${ka ? 'სივრცე' : r.venueCount === 1 ? 'venue' : 'venues'}` : ''}` : [r.fromPrice != null ? `${ka ? 'დან' : 'From'} ${r.fromPrice} ${r.currency ?? ''}/${ka ? 'სთ' : 'hour'}` : null, r.bookingMode === 'INSTANT' ? ka ? 'მყისიერი დაჯავშნა' : 'Instant booking' : ka ? 'მფლობელის დასტურით' : 'Owner approval'].filter(Boolean).join(' · ')}</p>
                      </>}
                      {r.type === 'tournament' && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-secondary)]">
                          <HighlightedText text={r.description ?? ''} query={debouncedQuery} />
                        </p>
                      )}
                      {r.type === 'event' && <p className="mt-0.5 text-xs text-[var(--color-secondary)]">{r.context} · {r.activity.toLowerCase()}{r.startsAt ? ` · ${new Date(r.startsAt).toLocaleDateString()}` : ''}</p>}
                    </div>
                  </Link>
                  {(r.type === 'organization' || r.type === 'venue') && <div className="discovery-actions">
                    {r.type === 'organization' ? <>
                      <Link to={`${resultLink(r)}?tab=contact`} onClick={() => { setQuery(''); setIsOpen(false); }}>{ka ? 'კონტაქტი' : 'Contact'}</Link>
                      {r.venueCount > 0 && <Link to={`${resultLink(r)}?tab=venues`} onClick={() => { setQuery(''); setIsOpen(false); }}>{ka ? 'სივრცეების ნახვა' : 'View venues'}</Link>}
                    </> : <Link to={`${resultLink(r)}?book=1`} onClick={() => { setQuery(''); setIsOpen(false); }}>{ka ? 'ხელმისაწვდომობა და დაჯავშნა' : 'Availability & booking'}</Link>}
                  </div>}
                </li>
              ))}
            </ul>
          )}
          {current?.more && <p className="discovery-note">{ka ? 'მეტი შედეგისთვის დააზუსტეთ სახელი ან ადგილი.' : 'More matches are available. Refine the name or location.'}</p>}
          {(kind === 'ALL' || kind === 'EVENT') && <p className="discovery-note"><Link to={`/events?${new URLSearchParams({ q: query.trim(), ...(kind === 'EVENT' && place.trim() ? { location: place.trim() } : {}) })}`} onClick={() => setIsOpen(false)}>{ka ? 'ყველა ღონისძიება და თარიღის ფილტრები' : 'All event results & date filters'}</Link></p>}
          {canAsk && !questionIntent && renderDolaOption()}
          </>}
        </div>
      )}
    </div>
  );

  function renderDolaOption() {
    return <button type="button" onClick={openDola} data-search-selected={selectedIndex === askIndex}
      className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors ${light ? 'border-[color:var(--color-border)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)]' : 'border-[color:var(--color-border)]/5 text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10'} ${selectedIndex === askIndex ? light ? 'bg-[color:var(--color-accent-soft)]' : 'bg-[color:var(--color-accent)]/10' : ''}`}>
      <Sparkles className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{ka ? 'ჰკითხეთ Agent Dola-ს' : 'Ask Agent Dola'}</span><span className="block truncate text-xs opacity-75">{query.trim()}</span></span>
      {questionIntent && <span className="text-xs opacity-60">↵</span>}
    </button>;
  }
};

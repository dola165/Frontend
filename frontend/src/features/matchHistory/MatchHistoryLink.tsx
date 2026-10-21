import { History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { matchHistoryPath } from './api';
import { useResultCopy } from './copy';

export function MatchHistoryLink({ clubId, squadId, tournamentId, className }: { clubId?: number | null; squadId?: number | null; tournamentId?: number | null; className?: string }) {
  const { copy } = useResultCopy();
  return <Link className={className} to={matchHistoryPath({ clubId, squadId, tournamentId })}><History size={16} aria-hidden="true" /> {copy('Results & history', 'შედეგები და ისტორია')}</Link>;
}

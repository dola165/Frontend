import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { TournamentDetail } from '../tournaments/domain';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getQualificationRepair, repairQualification, type QualificationRepair } from './fixtureReviewApi';
import { useCompetitionCommand } from './useCompetitionCommand';
import './fixture-review.css';

export function CompetitionQualificationRepair({ id, fixture, revision, reason, saved }: { id: number; fixture: number; revision: number; reason: string; saved: (detail: TournamentDetail) => void }) {
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const [data, setData] = useState<QualificationRepair>(), [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  const commands = useCompetitionCommand();
  useEffect(() => {
    const controller = new AbortController();
    void getQualificationRepair(id, fixture, controller.signal).then(data => { if (!controller.signal.aborted) { setData(data); setError(''); } }).catch(cause => { if (!controller.signal.aborted) setError(extractApiErrorMessage(cause, 'Could not check qualification repair.')); });
    return () => controller.abort();
  }, [id, fixture, revision]);
  if (!data?.available) return error ? <p role="alert">{error}</p> : null;
  const action = data.paused ? 'resume' : 'reset';
  return <section className="competition-fixture-review">
    <p>{data.paused ? copy('Qualification is paused. Retry your source score correction; the existing knockout slots will be requalified automatically. You can also keep the saved result and resume qualification.', 'კვალიფიკაცია შეჩერებულია. ხელახლა შეინახეთ ანგარიშის შესწორება; არსებული ბადის ადგილები ავტომატურად განახლდება. ასევე შეგიძლიათ არსებული შედეგით გაგრძელება.') : copy('A correction affects generated knockout places. Reset only their unplayed assignments, then retry the correction. Fixture and match IDs, schedules and history remain.', 'შესწორება ბადის ადგილებზე მოქმედებს. განაახლეთ მხოლოდ უთამაშებელი ადგილები, შემდეგ ხელახლა შეინახეთ შესწორება. მატჩების ნომრები, დრო და ისტორია დარჩება.')}</p>
    {(error || commands.error) && <p role="alert">{error || commands.error}</p>}
    <button type="button" disabled={commands.busy || !reason.trim()} onClick={() => setConfirm(true)}>{data.paused ? copy('Resume saved qualification', 'არსებული შედეგით გაგრძელება') : copy('Reset unplayed qualification slots', 'უთამაშებელი ადგილების განახლება')}</button>
    <ConfirmDialog open={confirm} title={copy('Review qualification repair', 'კვალიფიკაციის განახლება')} message={copy(`${data.fixtureIds.length} existing fixtures are retained. Played history, live appointments and allocations must be resolved first.`, `${data.fixtureIds.length} არსებული მატჩი შენარჩუნდება. ნათამაშები შედეგები, აქტიური დანიშვნები და ჯავშნები ჯერ უნდა მოგვარდეს.`)} onCancel={() => { if (!commands.busy) setConfirm(false); }} onConfirm={() => {
      const path = `fixtures/${fixture}/qualification/${action}`;
      void commands.run(path, { reason: reason.trim() }, data.revision, payload => repairQualification(id, path, payload), async detail => { saved(detail); setConfirm(false); }, () => setError(copy('Refresh the saved fixture before retrying.', 'ხელახლა ცდამდე განაახლეთ შენახული მატჩი.')));
    }}/>
  </section>;
}

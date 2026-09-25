import { useTranslation } from 'react-i18next';
import type { MyTryoutApplication } from '../../api/tryouts';

export function TryoutCancellationNotice({ application }: { application: MyTryoutApplication }) {
    const { i18n } = useTranslation();
    if (application.tryoutLifecycleStatus !== 'CANCELLED') return null;
    const ka = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
    return <p role="status" className="mt-1 text-xs text-[color:var(--fc-text-secondary)]">
        {ka ? 'სინჯი გაუქმებულია.' : 'Tryout cancelled.'}{' '}
        {application.status === 'ACCEPTED'
            ? (ka ? 'მიღების გადაწყვეტილება და კლუბთან არსებული კავშირი შენარჩუნებულია.' : 'Your accepted decision and existing club affiliation are retained.')
            : (ka ? 'განაცხადის ისტორია შენარჩუნებულია.' : 'Your application history is retained.')}
    </p>;
}

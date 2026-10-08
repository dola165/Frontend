import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PostComposer } from '../components/feed/PostComposer';
import { nativeCall } from './bridge';

/** Reuse the complete photo publishing flow without mounting another feed behind it. */
export const AndroidFeedComposer = ({ user }: {
    user?: { username?: string; fullName?: string; avatarUrl?: string } | null;
}) => {
    const { t } = useTranslation();
    const [published, setPublished] = useState(false);
    const [publishedPostId, setPublishedPostId] = useState<number>();
    const [returnFailed, setReturnFailed] = useState(false);
    const [eventNavigationFailed, setEventNavigationFailed] = useState(false);
    const returnHome = () => {
        setReturnFailed(false);
        void nativeCall({ kind: 'navigate', path: '/home?published=1' }).catch(() => setReturnFailed(true));
    };
    useEffect(() => {
        if (published) {
            document.title = t('androidFeedComposer.published');
            const path = publishedPostId === undefined ? '/home?published=1' : `/home?published=1&postId=${publishedPostId}`;
            void nativeCall({ kind: 'navigate', path }).catch(() => setReturnFailed(true));
        } else document.title = t('androidFeedComposer.title');
    }, [published, publishedPostId, t]);
    return <section className="mx-auto flex w-full max-w-[680px] flex-col gap-4" aria-label={t('androidFeedComposer.title')}>
        {published ? <div className="p-5">
            <p role="status">{t('androidFeedComposer.published')}</p>
            {returnFailed && <p role="alert" className="mt-3">{t('androidFeedComposer.returnFailed')}</p>}
            <button type="button" onClick={returnHome}
                className="mt-4 min-h-12 rounded-xl bg-[var(--feed-accent)] px-5 font-semibold text-[var(--feed-accent-contrast)]">
                {t('androidFeedComposer.returnHome')}
            </button>
        </div> : <>
            {eventNavigationFailed && <p role="alert" className="px-4 pt-3">{t('androidFeedComposer.eventNavigationFailed')}</p>}
            <PostComposer authorName={user?.fullName || user?.username || t('androidFeedComposer.you')}
            avatarUrl={user?.avatarUrl} onPostCreated={postId => {
                setPublishedPostId(typeof postId === 'number' && Number.isSafeInteger(postId) && postId > 0 ? postId : undefined);
                setPublished(true);
            }}
            onCreateEvent={() => {
                setEventNavigationFailed(false);
                void nativeCall({ kind: 'navigate', path: '/calendar?newEvent=1' }).catch(() => setEventNavigationFailed(true));
            }} />
        </>}
    </section>;
};

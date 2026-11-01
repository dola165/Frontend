import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { PostComposer } from '../../../components/feed/PostComposer';
import { Dialog } from '../../../design/Dialog';
import { Button, Section } from '../../../design/primitives';
import { RecordPostSwitchList } from '../../clubOffice/RecordPostSettings';
import { useRecordPostWords } from '../../clubOffice/recordPostSwitches';
import { usePostAuthors } from '../../feed/postAuthors';
import { ProfilePosts } from '../../profiles/ProfilePosts';
import { useProfilePostFeed } from '../../profiles/useProfilePostFeed';
import type { ClubProfile } from './types';

/**
 * Everything the club has posted, newest first, in the Home feed style. Whoever may post for the club or one of its
 * squads (the one rule-checker's answer) posts from here, as the club or the squad; whoever may post for the whole
 * club (the Owner, Admins, the Media officer) also reaches the switches for the posts the club's work writes.
 */
export function ClubPostsTab({ club, crestUrl }: { club: ClubProfile; crestUrl?: string }) {
    const feed = useProfilePostFeed(`/posts/club/${club.id}`);
    const authors = usePostAuthors().authors.filter(author => author.clubId === club.id);
    const canPost = authors.length > 0;
    const wholeClub = authors.some(author => !author.squadId);
    const words = useRecordPostWords();
    const [switches, setSwitches] = useState(false);
    return <Section title="Posts" hint={`News, results and photos from ${club.name}`}
        action={wholeClub ? <Button size="sm" variant="ghost" onClick={() => setSwitches(true)}><Newspaper aria-hidden="true" />{words.title}</Button> : undefined}>
        <ProfilePosts feed={feed}
            composer={canPost ? <PostComposer home compact clubId={club.id} authors={authors} authorName={club.name} avatarUrl={crestUrl ?? club.logoUrl} onPostCreated={feed.pages.refresh} /> : undefined}
            empty={{ title: 'No posts yet', body: canPost ? 'Share the first update above. It appears on this page and in your followers’ Home feed.' : 'When the club shares news, photos and results, they appear here.' }} />
        {switches && <Dialog open size="md" title={words.title} description={words.hint} onClose={() => setSwitches(false)}>
            <RecordPostSwitchList clubId={club.id} />
        </Dialog>}
    </Section>;
}

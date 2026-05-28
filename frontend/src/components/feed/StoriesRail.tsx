import { Plus } from 'lucide-react';

interface StoryItem {
    id: number;
    name: string;
    avatar: string;
    own?: boolean;
}

const stories: StoryItem[] = [
    { id: 1, name: 'Your Story', avatar: '', own: true },
    { id: 2, name: 'Dinamo Tbilisi', avatar: 'DT' },
    { id: 3, name: 'Saburtalo', avatar: 'SB' },
    { id: 4, name: 'Rustavi', avatar: 'RU' },
    { id: 5, name: 'Scout Watch', avatar: 'SW' },
    { id: 6, name: 'League Hub', avatar: 'LH' },
    { id: 7, name: 'U21 Trials', avatar: 'U2' },
    { id: 8, name: 'FC Analytics', avatar: 'FA' }
];

export const StoriesRail = () => (
    <section className="feed-story-shell px-3 py-3">
        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-0.5">
            {stories.map((story) => (
                <button key={story.id} type="button" className="feed-story-card">
                    <div className={`feed-story-thumb ${story.own ? 'feed-story-thumb--own' : ''}`}>
                        {story.own ? (
                            <Plus className="h-4 w-4 text-[var(--feed-text-muted)]" />
                        ) : (
                            story.avatar
                        )}
                    </div>
                    <span className="feed-story-title">{story.name}</span>
                </button>
            ))}
        </div>
    </section>
);

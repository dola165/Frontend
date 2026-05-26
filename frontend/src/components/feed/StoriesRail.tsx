import type { CSSProperties } from 'react';
import { Plus } from 'lucide-react';

interface StoryItem {
    id: number;
    name: string;
    subtitle: string;
    own?: boolean;
}

const storyStyle: CSSProperties = {
    ['--story-primary' as string]: 'var(--bg-surface)',
    ['--story-secondary' as string]: 'var(--bg-surface)'
};

const stories: StoryItem[] = [
    { id: 1, name: 'Your Story', subtitle: 'Add update', own: true },
    { id: 2, name: 'Dinamo Tbilisi', subtitle: 'New trial' },
    { id: 3, name: 'Saburtalo', subtitle: 'Match day' },
    { id: 4, name: 'Rustavi', subtitle: 'Behind scenes' },
    { id: 5, name: 'Scout Watch', subtitle: 'Top clips' },
    { id: 6, name: 'League Hub', subtitle: 'Live notes' }
];

export const StoriesRail = () => (
    <section className="feed-story-shell px-4 py-4">
        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
            {stories.map((story) => (
                <button key={story.id} type="button" className="feed-story-card shrink-0" style={storyStyle}>
                    <div className="relative flex h-full flex-col justify-between p-3">
                        <div className="feed-story-avatar">
                            {story.own ? <Plus className="h-5 w-5" /> : story.name.substring(0, 2)}
                        </div>

                        <div className="relative z-10">
                            <p className="feed-story-title">{story.name}</p>
                            <p className="feed-story-subtitle">{story.subtitle}</p>
                        </div>
                    </div>
                </button>
            ))}
        </div>
    </section>
);

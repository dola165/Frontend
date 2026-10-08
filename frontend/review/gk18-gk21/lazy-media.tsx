import React from 'react';
import { createRoot } from 'react-dom/client';
import { MediaImage } from '../../src/components/ui/MediaImage';

createRoot(document.getElementById('root')!).render(<main>
    <h1>Below-viewport image comparison</h1>
    <div style={{height:20000}} />
    <img loading="lazy" width="100" height="100" src="/uploads/native.jpg" alt="Native lazy image" />
    {[1,2,3,4].map(id => <MediaImage key={id} loading="lazy" width="100" height="100" src={`/uploads/protected-${id}.jpg`} alt={`Protected lazy image ${id}`} />)}
</main>);

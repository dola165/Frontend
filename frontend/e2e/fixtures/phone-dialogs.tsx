import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PostTheaterModal } from '../../src/components/PostTheaterModal';
import { ImageCropperModal } from '../../src/ui/ImageCropperModal';
import '../../src/index.css';
import '../../src/android/android.css';

const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#1b604a"/><circle cx="320" cy="200" r="100" fill="#e9f2db"/></svg>');

function PhoneDialogs() {
    const cropper = new URLSearchParams(location.search).get('view') === 'cropper';
    const [open, setOpen] = useState(true);
    const [result, setResult] = useState('');
    return <>
        <output>{result}</output>
        {cropper ? <ImageCropperModal isOpen={open} imageUrl={photo} aspectRatio={1} title="Crop profile photo"
            onClose={() => { setOpen(false); setResult('Crop cancelled'); }}
            onCropComplete={() => { setOpen(false); setResult('Crop applied'); }}/>
            : <PostTheaterModal isOpen={open} post={{ id: 42, authorName: 'Phone test player', content: 'A long match report must remain readable without hiding the comment action. '.repeat(100), createdAt: '2026-09-13T12:00:00', mediaUrls: [photo, photo], likeCount: 0, commentCount: 0, isLikedByMe: false }}
                commentsData={[]} onClose={() => { setOpen(false); setResult('Viewer closed'); }}
                onLikeToggle={() => undefined} onSubmitComment={(_id, text) => { setResult(`Comment submitted: ${text}`); }}/>
        }
    </>;
}

createRoot(document.getElementById('root')!).render(<PhoneDialogs/>);

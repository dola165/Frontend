import { useState, useRef } from 'react';
import { Camera, Video, Loader2, X, Send } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';

interface PostComposerProps {
    clubId?: number; // Pass this if posting as a club admin
    authorName?: string;
    onPostCreated: () => void; // Callback to refresh the feed
}

export const PostComposer = ({ clubId, authorName = "You", onPostCreated }: PostComposerProps) => {
    const [content, setContent] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const removeFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async () => {
        if (!content.trim() && !selectedFile) return;
        setIsSubmitting(true);

        try {
            let mediaIds: number[] = [];

            // 1. Upload Media First (if a file was selected)
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const mediaRes = await apiClient.post('/media/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                // Assuming the backend returns the MediaDto with an 'id'
                mediaIds.push(mediaRes.data.id);
            }

            // 2. Create the Post
            const postPayload = {
                content: content,
                clubId: clubId || null,
                isPublic: true,
                mediaIds: mediaIds
            };

            await apiClient.post('/posts', postPayload);

            // 3. Clean up and refresh
            setContent("");
            removeFile();
            onPostCreated(); // Tell the parent page to re-fetch the feed

        } catch (error) {
            console.error("Failed to create post", error);
            alert("Failed to broadcast update.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-4 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] mb-6">
            <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm border border-emerald-700">
                    {authorName.substring(0, 2).toUpperCase()}
                </div>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={clubId ? "Broadcast an update to followers..." : "Share intel with the network..."}
                    className="flex-1 bg-slate-100 dark:bg-slate-800/50 border-none text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm placeholder:text-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner resize-none min-h-[48px]"
                    rows={content.split('\n').length > 2 ? 3 : 1}
                />
            </div>

            {/* Image Preview Area */}
            {previewUrl && (
                <div className="relative mb-3 ml-13 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 w-fit">
                    <img src={previewUrl} alt="Upload preview" className="max-h-48 object-cover" />
                    <button onClick={removeFile} className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 ml-13">
                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                        <Camera className="w-4 h-4" /> <span className="hidden sm:inline">Photo</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                        <Video className="w-4 h-4" /> <span className="hidden sm:inline">Video</span>
                    </button>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!content.trim() && !selectedFile)}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold text-sm transition-all disabled:opacity-50 shadow-md"
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    POST
                </button>
            </div>
        </div>
    );
};
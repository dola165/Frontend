import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { ShieldCheck, Users, UserPlus } from 'lucide-react'; // Icons

// This exactly matches your Java ClubProfileDto Record
interface ClubProfile {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    isMember: boolean;
}

export const ClubProfilePage = () => {
    // Grabs the ID from the URL (e.g., /clubs/1)
    const { id } = useParams<{ id: string }>();
    const [club, setClub] = useState<ClubProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // 1. Fetch the Club Profile on load
    useEffect(() => {
        const fetchClub = async () => {
            try {
                const response = await apiClient.get(`/clubs/${id}`);
                setClub(response.data);
            } catch (error) {
                console.error("Failed to load club", error);
            } finally {
                setLoading(false);
            }
        };
        fetchClub();
    }, [id]);

    // 2. The Follow Toggle Logic (Optimistic UI Update)
    const handleFollowToggle = async () => {
        if (!club) return;

        // Optimistically update UI so it feels lightning fast
        const previousState = club.isFollowedByMe;
        const previousCount = club.followerCount;

        setClub({
            ...club,
            isFollowedByMe: !previousState,
            followerCount: previousState ? previousCount - 1 : previousCount + 1
        });

        try {
            // Hit the backend toggle endpoint we wrote
            await apiClient.post(`/clubs/${club.id}/follow`);
        } catch (error) {
            // If the backend fails, revert the UI back
            console.error("Failed to toggle follow", error);
            setClub({
                ...club,
                isFollowedByMe: previousState,
                followerCount: previousCount
            });
            alert("Something went wrong. Please try again.");
        }
    };

    if (loading) return <div className="p-10 text-center">Loading club data...</div>;
    if (!club) return <div className="p-10 text-center">Club not found</div>;

    // 3. Render the UI
    return (
        <div className="max-w-3xl mx-auto p-4 mt-6">
            // A mental blueprint for your React Dev's next iteration:
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">

                {/* 1. The Banner (Placeholder gradient for now) */}
                <div className="h-48 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                <div className="px-6 relative">
                    {/* 2. The Overlapping Avatar */}
                    <div className="w-24 h-24 bg-white rounded-full border-4 border-white shadow-md absolute -top-12 flex items-center justify-center text-3xl font-bold text-gray-300">
                        TC </div>

                    {/* 3. The Action Row (Follow Button pushed to the right) */}
                    <div className="flex justify-end pt-4">
                        {/* Follow Button */}
                        <button
                            onClick={handleFollowToggle}
                            className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                                club.isFollowedByMe
                                    ? "bg-gray-200 text-gray-800 hover:bg-red-100 hover:text-red-600" // Unfollow style
                                    : "bg-blue-600 text-white hover:bg-blue-700"                     // Follow style
                            }`}
                        >
                            {club.isFollowedByMe ? "Following" : "Follow Club"}
                        </button>
                    </div>

                    {/* 4. The Info Section */}
                    <div className="mt-2">
                        <h1 className="text-2xl font-extrabold">{club.name}</h1>
                        <p className="text-gray-500 text-sm mt-1">{club.type} • Tbilisi, Georgia</p>
                    </div>

                    {/* 5. The Tabs */}
                    <div className="flex gap-6 mt-6 border-b border-gray-200 text-gray-600 font-medium">
                        <button className="pb-3 border-b-2 border-blue-600 text-blue-600">Timeline</button>
                        <button className="pb-3 hover:text-black hover:border-gray-300">Squad</button>
                        <button className="pb-3 hover:text-black hover:border-gray-300">About</button>
                    </div>
                </div>
            </div>
            {/* Header Section */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            {club.name}
                            {club.isOfficial && <ShieldCheck className="text-blue-500 w-6 h-6" />}
                        </h1>
                        <span className="inline-block bg-gray-100 text-gray-600 text-sm px-2 py-1 rounded mt-2">
                            {club.type}
                        </span>
                    </div>

                    {/* Follow Button */}
                    <button
                        onClick={handleFollowToggle}
                        className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                            club.isFollowedByMe
                                ? "bg-gray-200 text-gray-800 hover:bg-red-100 hover:text-red-600" // Unfollow style
                                : "bg-blue-600 text-white hover:bg-blue-700"                     // Follow style
                        }`}
                    >
                        {club.isFollowedByMe ? "Following" : "Follow Club"}
                    </button>
                </div>

                {/* Description */}
                <p className="mt-4 text-gray-700 whitespace-pre-line">
                    {club.description || "No description provided."}
                </p>

                {/* Stats Row */}
                <div className="flex gap-6 mt-6 pt-4 border-t border-gray-100 text-gray-600">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        <span className="font-semibold text-black">{club.followerCount}</span> Followers
                    </div>
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5" />
                        <span className="font-semibold text-black">{club.memberCount}</span> Members
                    </div>
                </div>
            </div>
        </div>
    );
};
import { HeartHandshake, ArrowUpRight } from 'lucide-react';

export const CharityPage = () => {
    const campaigns = [
        { id: 1, title: "Youth Cleat Drive 2026", raised: "$12,450", goal: "$20,000", desc: "Providing proper footwear for underprivileged academies in Tbilisi." },
        { id: 2, title: "Inner-city Field Renovation", raised: "$8,200", goal: "$50,000", desc: "Refurbishing concrete pitches into safe turf fields for local communities." }
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-16">
                    <HeartHandshake className="w-16 h-16 text-rose-500 mx-auto mb-4" />
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4">Talanti Foundation</h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400 font-medium max-w-2xl mx-auto">We believe every talented player deserves a chance to play, regardless of their financial situation.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {campaigns.map(camp => (
                        <div key={camp.id} className="bg-white dark:bg-gray-800 rounded-3xl p-8 border-2 border-rose-200 dark:border-rose-900 shadow-[6px_6px_0px_0px_rgba(225,29,72,0.2)]">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{camp.title}</h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">{camp.desc}</p>

                            <div className="mb-6">
                                <div className="flex justify-between text-sm font-bold mb-2">
                                    <span className="text-rose-600 dark:text-rose-400">Raised: {camp.raised}</span>
                                    <span className="text-gray-500">Goal: {camp.goal}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div className="bg-rose-500 h-3 rounded-full" style={{ width: '45%' }}></div>
                                </div>
                            </div>

                            <button onClick={() => alert("Redirecting to official Talanti GoFundMe...")} className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-xl font-black uppercase tracking-wider transition-colors">
                                Donate Now <ArrowUpRight className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
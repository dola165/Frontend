import { ShoppingCart, ArrowRight } from 'lucide-react';

export const StorePage = () => {
    // Mock data for the MVP General Store
    const products = [
        { id: 1, name: "Talanti Pro Match Ball", price: "$120.00", category: "Equipment", image: "⚽" },
        { id: 2, name: "Agility Training Cones (Set of 50)", price: "$34.99", category: "Training", image: "⛺" },
        { id: 3, name: "Performance Grip Socks", price: "$18.50", category: "Apparel", image: "🧦" },
        { id: 4, name: "Resistance Parachute", price: "$22.00", category: "Training", image: "🪂" },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                            <ShoppingCart className="w-10 h-10 text-emerald-500" />
                            Talanti Store
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Official training gear and equipment for players and clubs.</p>
                    </div>
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.map(product => (
                        <div key={product.id} className="bg-white dark:bg-gray-800 rounded-3xl p-6 border-2 border-gray-900 dark:border-gray-700 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transition-all">
                            <div className="h-40 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-6xl mb-4 border border-gray-200 dark:border-gray-600">
                                {product.image}
                            </div>
                            <div className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider rounded-full mb-3">
                                {product.category}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-2">{product.name}</h3>
                            <div className="flex items-center justify-between mt-4">
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{product.price}</span>
                                <button className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-full hover:scale-110 transition-transform">
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
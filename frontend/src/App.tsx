import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ClubProfilePage } from './pages/ClubProfilePage';
import { apiClient } from './api/axiosConfig';

function App() {

    // The magical Dev Login trigger we built in Spring Boot
    const handleDevLogin = async () => {
        try {
            // Sends the POST request to our Dev Bypass endpoint
            const response = await apiClient.post('/auth/dev-login?email=react_dev@demo.com');
            alert(`Success! ${response.data.message}. You can now interact with the database.`);
        } catch (error) {
            console.error("Login failed:", error);
            alert("Login failed! Is your Spring Boot server running?");
        }
    };

    return (
        <Router>
            {/* A simple navigation bar */}
            <nav className="p-4 bg-gray-800 text-white flex justify-between items-center shadow-md">
                <div className="flex gap-6 font-semibold">
                    <Link to="/" className="hover:text-blue-400 transition-colors">Home Feed</Link>

                    {/* Hardcoding ID 1 to look at the fake club our Database Seeder created */}
                    <Link to="/clubs/1" className="hover:text-blue-400 transition-colors">Tbilisi City FC (Demo)</Link>
                </div>

                {/* The Dev Login Button */}
                <button
                    onClick={handleDevLogin}
                    className="bg-blue-600 px-4 py-2 rounded-md hover:bg-blue-500 transition-colors font-bold"
                >
                    Dev Login
                </button>
            </nav>

            {/* The Page Content Area */}
            <main className="bg-gray-50 min-h-screen">
                <Routes>
                    <Route path="/" element={<div className="p-10 text-center text-xl text-gray-500">Welcome to Talanti. Click "Dev Login" first, then click "Tbilisi City FC" to test the database!</div>} />
                    <Route path="/clubs/:id" element={<ClubProfilePage />} />
                </Routes>
            </main>
        </Router>
    );
}

export default App;
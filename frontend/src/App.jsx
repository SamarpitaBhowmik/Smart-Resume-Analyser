import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import ResumeUpload from "./components/ResumeUpload";
import Dashboard from "./pages/Dashboard";

function Home() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold">Welcome to Career Recommender!</h2>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Navbar */}
        <nav className="bg-white shadow-md p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">Career Recommender</h1>
          <div className="space-x-4">
            <Link to="/" className="hover:text-blue-600">Home</Link>
            <Link to="/upload" className="hover:text-blue-600">Upload Resume</Link>
            <Link to="/dashboard" className="hover:text-blue-600">Dashboard</Link>
          </div>
        </nav>

        {/* Routes */}
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<ResumeUpload />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

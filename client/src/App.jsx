import { useState } from 'react'
import Home from './pages/Home'
import AdminDashboard from './admin/AdminDashboard'
import './App.css'

export default function App() {
	const [showAdmin, setShowAdmin] = useState(false)

	return (
		<div className="app">
			{showAdmin ? (
				<div className="admin-view">
					<AdminDashboard />
					<button
						className="back-to-app-btn"
						onClick={() => setShowAdmin(false)}
						title="Back to TV"
					>
						← TV
					</button>
				</div>
			) : (
				<div className="tv-view">
					<Home />
					<button
						className="admin-button"
						onClick={() => setShowAdmin(true)}
						title="Admin Dashboard"
					>
						⚙️
					</button>
				</div>
			)}
		</div>
	)
}

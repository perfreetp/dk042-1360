import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import PartsList from "@/pages/PartsList"
import Schedule from "@/pages/Schedule"

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/parts" replace />} />
          <Route path="/parts" element={<PartsList />} />
          <Route path="/schedule" element={<Schedule />} />
        </Routes>
      </Layout>
    </Router>
  )
}

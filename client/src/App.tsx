import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FlashSaleCard from './components/FlashSaleCard';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FlashSaleCard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

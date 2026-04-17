import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/shared/Layout';
import POS from './pages/POS';
import Inventory from './pages/Inventory';

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/inventory" element={<Inventory />} />
        </Routes>
      </Layout>
    </AppProvider>
  );
}

import Navbar from './Navbar';
import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Navbar />
      {/* pb-14 deja espacio para el BottomNav fijo */}
      <main className="flex-1 pb-14">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

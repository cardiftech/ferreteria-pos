import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

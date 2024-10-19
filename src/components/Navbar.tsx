import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Phone } from 'lucide-react';

const Navbar: React.FC = () => {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Since we can't use Chakra UI's toast, we'll use a simple alert for now
      alert('Signed out successfully.');
    } catch (error) {
      alert(`An error occurred while signing out: ${error.message}`);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Phone className="h-8 w-8 text-blue-600 mr-2" />
            <h1 className="text-xl font-bold text-gray-900">
              FoodieBot Dashboard
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

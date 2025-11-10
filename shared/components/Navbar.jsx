import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Unified Navigation Bar for all Maestroverse modules
 * Cyberpunk aesthetic with neon pink and blue accents
 */
function Navbar({ currentModule, user, onLogout }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const modules = [
    { name: 'Hub', path: 'http://localhost:3004', icon: '🏠' },
    { name: 'CareerLink', path: 'http://localhost:3002', icon: '💼' },
    { name: 'CollabSpace', path: 'http://localhost:3003', icon: '📚' },
  ];

  return (
    <nav className="bg-cyber-surface/90 border-b border-cyber-border backdrop-blur-xl shadow-glow-blue sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <span className="text-2xl font-bold bg-gradient-to-r from-cyber-pink via-cyan-400 to-cyber-blue bg-clip-text text-transparent drop-shadow-glow-blue">
                Maestroverse
              </span>
            </div>

            {/* Module Links */}
            <div className="hidden md:flex space-x-4">
              {modules.map((module) => (
                <a
                  key={module.name}
                  href={module.path}
                  className={`group px-3 py-2 rounded-md text-sm font-medium border transition-all ${
                    currentModule === module.name
                      ? 'bg-teal-600/30 text-white border-cyber-border shadow-glow-pink'
                      : 'text-gray-300 border-transparent hover:text-white hover:border-cyber-border hover:bg-gray-800/60'
                  }`}
                >
                  <span className="mr-1 drop-shadow-glow-blue">{module.icon}</span>
                  {module.name}
                </a>
              ))}
            </div>
          </div>

          {/* Right Side - Search, Notifications, Profile */}
          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="bg-gray-800/70 text-gray-100 placeholder:text-gray-500 px-4 py-2 rounded-lg border border-cyber-border focus:outline-none focus:ring-2 focus:ring-cyan-400/80 focus:border-cyber-blue w-64 transition"
              />
              <span className="absolute right-3 top-2.5 text-gray-400 drop-shadow-glow-blue">🔍</span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-lg transition-colors relative border border-transparent hover:border-cyber-border"
              >
                🔔
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  3
                </span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-cyber-surface/95 rounded-xl shadow-glow-blue border border-cyber-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-cyber-border/60">
                    <h3 className="text-white font-semibold drop-shadow-glow-blue">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {/* Notification items would go here */}
                    <div className="px-4 py-3 text-gray-400 text-sm">
                      No new notifications
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-2 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-lg transition-colors border border-transparent hover:border-cyber-border"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-cyber-pink via-cyan-400 to-cyber-blue rounded-full flex items-center justify-center text-white font-bold shadow-glow-pink">
                  {user?.firstName?.[0] || 'U'}
                </div>
                <span className="text-sm">{user?.firstName || 'User'}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-cyber-surface/95 rounded-xl shadow-glow-pink border border-cyber-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-cyber-border/60">
                    <p className="text-white font-semibold text-sm">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-gray-400 text-xs">{user?.email}</p>
                  </div>
                  <div className="py-2">
                    {user?.role === 'ADMIN' && (
                      <a
                        href="/admin"
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/60 hover:text-white transition-colors"
                      >
                        Admin Console
                      </a>
                    )}
                    <a
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/60 hover:text-white transition-colors"
                    >
                      Profile
                    </a>
                    <a
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/60 hover:text-white transition-colors"
                    >
                      Settings
                    </a>
                    <button
                      onClick={onLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/60 hover:text-white transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

Navbar.propTypes = {
  currentModule: PropTypes.string.isRequired,
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
  }),
  onLogout: PropTypes.func.isRequired,
};

export default Navbar;

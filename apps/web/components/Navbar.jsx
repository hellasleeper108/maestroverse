import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { users } from '../lib/api';

/**
 * Unified Navigation Bar for all Maestroverse modules
 * Cyberpunk aesthetic with neon pink and blue accents
 */
function Navbar({ currentModule, user, onLogout }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  async function loadNotifications() {
    try {
      const data = await users.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  async function handleMarkAsRead(notificationId) {
    try {
      await users.markNotificationRead(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await users.markAllNotificationsRead();
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'POST_LIKE':
        return '❤️';
      case 'POST_COMMENT':
        return '💬';
      case 'EVENT_REMINDER':
        return '📅';
      case 'MESSAGE':
        return '✉️';
      case 'CONNECTION_REQUEST':
        return '👥';
      default:
        return '🔔';
    }
  }

  function formatTime(date) {
    const now = new Date();
    const notifDate = new Date(date);
    const diff = now - notifDate;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  const modules = [
    { name: 'Hub', path: '/hub', icon: '🏠' },
    { name: 'CareerLink', path: '/careerlink', icon: '💼' },
    { name: 'CollabSpace', path: '/collabspace', icon: '📚' },
    { name: 'MIM', path: '/mim', icon: '💬' },
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
            <div className="relative hidden md:block">
              <input
                type="text"
                placeholder="Search..."
                className="bg-gray-800/70 text-gray-100 placeholder:text-gray-500 px-4 py-2 rounded-lg border border-cyber-border focus:outline-none focus:ring-2 focus:ring-cyan-400/80 focus:border-cyber-blue w-64 transition"
              />
              <span className="absolute right-3 top-2.5 text-gray-400 drop-shadow-glow-blue">
                🔍
              </span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-lg transition-colors relative border border-transparent hover:border-cyber-border"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-cyber-surface/95 rounded-xl shadow-glow-blue border border-cyber-border overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-cyber-border/60 flex items-center justify-between">
                    <h3 className="text-white font-semibold drop-shadow-glow-blue">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-cyber-blue hover:text-cyber-pink text-xs transition"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-400 text-sm">
                        <div className="text-4xl mb-2">🔔</div>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            if (!notif.isRead) {
                              handleMarkAsRead(notif.id);
                            }
                            if (notif.link) {
                              window.location.href = notif.link;
                            }
                          }}
                          className={`px-4 py-3 border-b border-cyber-border/60 hover:bg-gray-800/60 transition-colors cursor-pointer ${
                            !notif.isRead ? 'bg-teal-600/10' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <span className="text-2xl flex-shrink-0">
                              {getNotificationIcon(notif.type)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm ${notif.isRead ? 'text-gray-400' : 'text-white font-medium'}`}
                              >
                                {notif.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatTime(notif.createdAt)}
                              </p>
                            </div>
                            {!notif.isRead && (
                              <div className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0 mt-1 shadow-glow-pink"></div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
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
                <span className="text-sm hidden md:inline">{user?.firstName || 'User'}</span>
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

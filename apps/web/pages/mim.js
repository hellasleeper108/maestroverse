/**
 * MIM - Maestroverse Instant Messenger
 * AOL IM-style chat interface with polished UI
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { mim } from '../lib/api';
import io from 'socket.io-client';

// This page requires authentication and real-time data
export async function getServerSideProps() {
  return {
    props: {},
  };
}

export default function MIM({ user, setUser: _setUser }) {
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [usersInRoom, setUsersInRoom] = useState([]);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentRoomRef = useRef(null);

  // Initialize
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadRooms();
    initializeSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);

  // Auto-join lobby from URL or first public room
  useEffect(() => {
    if (rooms.length > 0 && !currentRoom) {
      const roomIdFromUrl = router.query.room;
      if (roomIdFromUrl) {
        const room = rooms.find(r => r.id === roomIdFromUrl);
        if (room) {
          joinRoom(room);
        }
      } else {
        // Auto-join first public room (lobby)
        const lobby = rooms.find(r => r.type === 'PUBLIC');
        if (lobby) {
          joinRoom(lobby);
        }
      }
    }
  }, [rooms, router.query.room]);

  // Scroll to bottom on new messages with smooth animation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  async function loadRooms() {
    try {
      const data = await mim.getRooms();
      setRooms(data.rooms);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setLoading(false);
    }
  }

  function initializeSocket() {
    const token = localStorage.getItem('maestro_token');
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const newSocket = io(apiUrl, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
      setConnectionStatus('connected');
      if (currentRoomRef.current) {
        newSocket.emit('chatroom:join', { roomId: currentRoomRef.current.id });
      }
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    newSocket.on('chatroom:message', (message) => {
      setMessages(prev => [...prev, message]);
      // Play notification sound
      playNotificationSound();
    });

    newSocket.on('chatroom:userlist', ({ users }) => {
      setUsersInRoom(users);
    });

    newSocket.on('chatroom:user_joined', ({ user: joinedUser }) => {
      setUsersInRoom(prev => [...prev, { ...joinedUser, isOnline: true }]);
    });

    newSocket.on('chatroom:user_left', ({ userId }) => {
      setUsersInRoom(prev => prev.filter(u => u.id !== userId));
    });

    newSocket.on('chatroom:typing', ({ userId: _userId, firstName, isTyping }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (isTyping) {
          newSet.add(firstName);
        } else {
          newSet.delete(firstName);
        }
        return newSet;
      });
    });

    newSocket.on('chatroom:message_deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    setSocket(newSocket);
  }

  function playNotificationSound() {
    // Simple beep using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const startTime = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.08, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    } catch (e) {
      // Silent fail if audio not supported
    }
  }

  async function joinRoom(room) {
    if (currentRoom?.id === room.id) return;

    // Leave current room
    if (currentRoom && socket) {
      socket.emit('chatroom:leave', { roomId: currentRoom.id });
    }

    setCurrentRoom(room);
    currentRoomRef.current = room;
    setMessages([]);
    setUsersInRoom([]);
    setTypingUsers(new Set());

    // Join room via API
    try {
      if (room.type === 'PUBLIC') {
        await mim.joinRoom(room.id);
      }

      // Load messages
      const data = await mim.getMessages(room.id);
      setMessages(data.messages);

      // Join via socket
      if (socket) {
        socket.emit('chatroom:join', { roomId: room.id });
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      if (error.message?.includes('password')) {
        const password = prompt(`🔒 Enter password for ${room.name}:`);
        if (password) {
          try {
            await mim.joinRoom(room.id, password);
            const data = await mim.getMessages(room.id);
            setMessages(data.messages);
            if (socket) {
              socket.emit('chatroom:join', { roomId: room.id });
            }
          } catch (err) {
            alert('❌ Invalid password');
            setCurrentRoom(null);
            currentRoomRef.current = null;
          }
        } else {
          setCurrentRoom(null);
          currentRoomRef.current = null;
        }
      }
    }
  }

  function sendMessage(e) {
    e.preventDefault();
    if (!messageInput.trim() || !currentRoom || !socket) return;

    socket.emit('chatroom:message', {
      roomId: currentRoom.id,
      content: messageInput.trim(),
    });

    setMessageInput('');

    // Stop typing indicator
    socket.emit('chatroom:typing', {
      roomId: currentRoom.id,
      isTyping: false,
    });
  }

  function handleTyping() {
    if (!currentRoom || !socket) return;

    // Send typing indicator
    socket.emit('chatroom:typing', {
      roomId: currentRoom.id,
      isTyping: true,
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chatroom:typing', {
        roomId: currentRoom.id,
        isTyping: false,
      });
    }, 2000);
  }

  async function deleteMessage(messageId) {
    if (!confirm('🗑️ Delete this message?')) return;

    try {
      if (socket) {
        socket.emit('chatroom:delete_message', {
          messageId,
          roomId: currentRoom.id,
        });
      } else {
        await mim.deleteMessage(messageId);
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert(error.message || 'Failed to delete message');
    }
  }

  function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function getRandomColor(userId) {
    const colors = [
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-yellow-500 to-orange-500',
      'from-red-500 to-pink-500',
      'from-teal-500 to-cyan-500',
      'from-indigo-500 to-purple-500',
    ];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-teal-400 mb-4"></div>
          <div className="text-white text-xl font-semibold">Loading MIM...</div>
          <div className="text-cyan-300 text-sm mt-2">Connecting to chat server</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 shadow-2xl border-b border-cyan-500/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="text-cyan-200 hover:text-cyan-100 transition-all hover:scale-110 transform"
            >
              <span className="text-2xl">←</span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <span className="text-4xl animate-pulse">💬</span>
                {connectionStatus === 'connected' && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white shadow-lg"></span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-cyan-100 drop-shadow-lg">MIM</h1>
                <p className="text-cyan-300 text-xs">Maestroverse Instant Messenger</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCreateRoom(true)}
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 px-6 py-2.5 rounded-xl border border-cyan-300/50 hover:from-cyan-400 hover:to-emerald-400 transition-all font-bold shadow-lg hover:shadow-xl hover:scale-105 transform flex items-center space-x-2"
          >
            <span className="text-xl">➕</span>
            <span>Create Room</span>
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Room List */}
        <div className="w-72 bg-slate-950/80 backdrop-blur border-r border-cyan-500/20 flex flex-col shadow-2xl">
          <div className="p-4 border-b border-cyan-500/30 bg-gradient-to-r from-slate-900 to-slate-800">
            <h2 className="text-slate-100 font-bold text-lg flex items-center space-x-2">
              <span>🏠</span>
              <span>Chat Rooms</span>
            </h2>
            <p className="text-cyan-300 text-sm mt-1">{rooms.length} rooms available</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => joinRoom(room)}
                className={`w-full text-left p-4 border-b border-slate-700/50 transition-all duration-200 group ${
                  currentRoom?.id === room.id
                    ? 'bg-gradient-to-r from-cyan-600 to-emerald-500 text-slate-950 shadow-lg scale-105 transform'
                    : 'text-slate-300 hover:bg-slate-900/60 hover:pl-6'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    {room.type === 'PRIVATE' ? (
                      <span className="text-2xl">🔒</span>
                    ) : (
                      <span className="text-2xl">🌐</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-slate-100">{room.name}</div>
                      {room.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{room.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className="bg-cyan-500/20 text-cyan-200 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {room._count?.members || 0} 👥
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center - Chat Messages */}
        <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          {currentRoom ? (
            <>
              {/* Room Header */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 shadow-xl border-b border-cyan-500/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-cyan-100 drop-shadow-lg flex items-center space-x-2">
                      <span>{currentRoom.type === 'PRIVATE' ? '🔒' : '🌐'}</span>
                      <span>{currentRoom.name}</span>
                    </h2>
                    {currentRoom.description && (
                      <p className="text-slate-300 text-sm mt-1">{currentRoom.description}</p>
                    )}
                  </div>
                  <div className="text-cyan-200 text-sm bg-slate-900/60 px-4 py-2 rounded-lg border border-cyan-500/30">
                    {usersInRoom.length} online
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <div className="text-6xl mb-4 animate-bounce">💬</div>
                    <p className="text-xl font-semibold text-slate-200">No messages yet</p>
                    <p className="text-sm mt-2 text-slate-400">Be the first to say something!</p>
                  </div>
                ) : (
                  messages.map((message, idx) => {
                    const isOwnMessage = message.authorId === user.id;
                    const showAvatar = idx === 0 || messages[idx - 1].authorId !== message.authorId;

                    return (
                      <div key={message.id} className={`flex items-end space-x-2 group animate-slideIn ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {/* Avatar */}
                        {showAvatar ? (
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getRandomColor(message.author.id)} flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0 ring-2 ring-slate-950`}>
                            {message.author.firstName[0]}
                          </div>
                        ) : (
                          <div className="w-10"></div>
                        )}

                        {/* Message Bubble */}
                        <div className={`max-w-md ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                          {showAvatar && (
                            <div className="flex items-center space-x-2 mb-1 px-2">
                              <span className="font-semibold text-slate-200 text-sm">
                                {message.author.firstName} {message.author.lastName}
                              </span>
                              <span className="text-xs text-slate-400">
                                {formatTime(message.createdAt)}
                              </span>
                            </div>
                          )}

                          <div className={`relative px-4 py-2.5 rounded-2xl shadow-md border ${
                            isOwnMessage
                              ? 'bg-gradient-to-r from-cyan-500 via-emerald-500 to-cyan-500 text-slate-950 border-cyan-400/40 rounded-br-sm'
                              : 'bg-slate-900/80 text-slate-100 border-slate-800 rounded-bl-sm'
                          }`}>
                            <p className="break-words">{message.content}</p>

                            {/* Delete button */}
                            {(message.authorId === user.id || user.role === 'ADMIN') && (
                              <button
                                onClick={() => deleteMessage(message.id)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 text-xs"
                                title="Delete message"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />

                {/* Typing Indicator */}
                {typingUsers.size > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-slate-400 italic animate-pulse">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <span>
                      {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={sendMessage} className="p-4 bg-slate-950 border-t border-slate-800 shadow-2xl">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Type your message..."
                    className="flex-1 px-5 py-3 border-2 border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-100 placeholder-slate-500 shadow-inner bg-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim()}
                    className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 px-8 py-3 rounded-xl hover:from-cyan-400 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg hover:shadow-xl hover:scale-105 transform disabled:transform-none"
                  >
                    Send 📤
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <div className="text-8xl mb-6 animate-bounce">💬</div>
              <p className="text-2xl font-semibold text-slate-200">Welcome to MIM!</p>
              <p className="text-lg mt-2 text-slate-400">Select a room from the left to start chatting</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - User List */}
        {currentRoom && (
          <div className="w-72 bg-slate-950/80 backdrop-blur border-l border-cyan-500/20 flex flex-col shadow-2xl">
            <div className="p-4 border-b border-cyan-500/30 bg-gradient-to-r from-slate-900 to-slate-800">
              <h3 className="text-slate-100 font-bold text-lg flex items-center space-x-2">
                <span>👥</span>
                <span>Online Users</span>
              </h3>
              <p className="text-cyan-300 text-sm mt-1">{usersInRoom.length} in this room</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {usersInRoom.map(roomUser => (
                <div
                  key={roomUser.id}
                  className="p-4 border-b border-slate-800/60 hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getRandomColor(roomUser.id)} flex items-center justify-center text-white font-bold shadow-lg ring-2 ${roomUser.isOnline ? 'ring-green-400' : 'ring-slate-600'}`}>
                      {roomUser.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-100 truncate">
                          {roomUser.firstName} {roomUser.lastName}
                        </span>
                        {roomUser.role === 'ADMIN' && (
                          <span className="bg-yellow-500 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-bold">
                            ⭐
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-cyan-300">@{roomUser.username}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${roomUser.isOnline ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-slate-600'}`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <CreateRoomModal
          onClose={() => setShowCreateRoom(false)}
          onCreated={(newRoom) => {
            setRooms(prev => [...prev, newRoom]);
            setShowCreateRoom(false);
            joinRoom(newRoom);
          }}
        />
      )}

      {/* Custom Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.45);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.7);
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

function CreateRoomModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('PUBLIC');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await mim.createRoom({
        name,
        description,
        type,
        password: type === 'PRIVATE' ? password : null,
      });

      onCreated(data.room);
    } catch (error) {
      alert(error.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-slate-950 border border-cyan-500/20 rounded-2xl p-8 w-full max-w-md shadow-2xl transform animate-scaleIn">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-cyan-200">
            Create New Room
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">
              Room Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-slate-900 text-slate-100 placeholder-slate-500"
              placeholder="My Awesome Room"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-slate-900 text-slate-100 placeholder-slate-500"
              rows="3"
              placeholder="What's this room about?"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">
              Room Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('PUBLIC')}
                className={`p-4 border-2 rounded-xl font-semibold transition-all ${
                  type === 'PUBLIC'
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="text-2xl mb-1">🌐</div>
                Public
              </button>
              <button
                type="button"
                onClick={() => setType('PRIVATE')}
                className={`p-4 border-2 rounded-xl font-semibold transition-all ${
                  type === 'PRIVATE'
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="text-2xl mb-1">🔒</div>
                Private
              </button>
            </div>
          </div>

          {type === 'PRIVATE' && (
            <div className="animate-slideIn">
              <label className="block text-sm font-bold text-slate-200 mb-2">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={type === 'PRIVATE'}
                className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-slate-900 text-slate-100 placeholder-slate-500"
                placeholder="Enter a password"
              />
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-800 rounded-xl hover:bg-slate-900 transition-all font-semibold text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 px-6 py-3 rounded-xl hover:from-cyan-400 hover:to-emerald-400 transition-all disabled:opacity-50 font-bold shadow-lg hover:shadow-xl"
            >
              {loading ? 'Creating...' : 'Create 🚀'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

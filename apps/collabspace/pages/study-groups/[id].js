import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { collabspace, auth } from '../../lib/api';

function StudyGroupDetail({ user, setUser }) {
  const [studyGroup, setStudyGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (id) {
      loadStudyGroup();
      loadMessages();
    }
  }, [user, id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadStudyGroup() {
    try {
      const data = await collabspace.getStudyGroup(id);
      setStudyGroup(data.studyGroup);
    } catch (err) {
      console.error('Failed to load study group:', err);
      setError(err.message || 'Failed to load study group');
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    try {
      const data = await collabspace.getStudyGroupMessages(id);
      setMessages(data.messages);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      await collabspace.sendStudyGroupMessage(id, newMessage.trim());
      setNewMessage('');
      await loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function handleJoin() {
    try {
      await collabspace.joinStudyGroup(id);
      await loadStudyGroup();
    } catch (err) {
      console.error('Failed to join study group:', err);
      setError(err.message || 'Failed to join study group');
    }
  }

  async function handleLeave() {
    try {
      await collabspace.leaveStudyGroup(id);
      await loadStudyGroup();
    } catch (err) {
      console.error('Failed to leave study group:', err);
      setError(err.message || 'Failed to leave study group');
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <LoadingSpinner size="lg" text="Loading study group..." />
        </div>
      </div>
    );
  }

  if (!studyGroup) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-white text-xl font-semibold mb-2">Study group not found</h2>
            <button
              onClick={() => router.push('/study-groups')}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Back to Study Groups
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Study Group Header */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-2">{studyGroup.name}</h1>
              {studyGroup.course && (
                <div className="text-teal-400 font-medium mb-2">
                  {studyGroup.course.code} - {studyGroup.course.name}
                </div>
              )}
              <p className="text-gray-400">{studyGroup.description}</p>
            </div>
            <div className="flex gap-2">
              {studyGroup.isMember ? (
                <button
                  onClick={handleLeave}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Leave Group
                </button>
              ) : studyGroup.isFull ? (
                <button
                  disabled
                  className="px-4 py-2 bg-gray-600 text-gray-400 rounded-lg cursor-not-allowed"
                >
                  Group Full
                </button>
              ) : (
                <button
                  onClick={handleJoin}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Join Group
                </button>
              )}
            </div>
          </div>

          {/* Group Info */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <span>
              👥 {studyGroup.members.length}/{studyGroup.maxMembers} members
            </span>
            {studyGroup.cohort && (
              <span>
                📚 Cohort: {studyGroup.cohort.charAt(0).toUpperCase() + studyGroup.cohort.slice(1)}
              </span>
            )}
            {studyGroup.location && <span>📍 {studyGroup.location}</span>}
            {studyGroup.meetingTime && <span>🕐 {studyGroup.meetingTime}</span>}
          </div>

          {/* Tags */}
          {studyGroup.tags && studyGroup.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {studyGroup.tags.map((tag, index) => (
                <span key={index} className="px-3 py-1 bg-teal-600 text-white text-sm rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={() => setError(null)} />
          </div>
        )}

        {/* Members List */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Members ({studyGroup.members.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studyGroup.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg"
              >
                <img
                  src={member.user.photoUrl || '/default-avatar.png'}
                  alt={member.user.firstName}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <div className="text-white font-medium">
                    {member.user.firstName} {member.user.lastName}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {member.user.username}
                    {member.role === 'admin' && <span className="ml-2 text-teal-400">(Admin)</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Section */}
        {studyGroup.isMember && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Group Chat</h2>
            </div>

            {/* Messages */}
            <div className="h-96 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-4xl mb-2">💬</div>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <img
                      src={message.author.photoUrl || '/default-avatar.png'}
                      alt={message.author.firstName}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">
                          {message.author.firstName} {message.author.lastName}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-300">{message.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-700">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        )}

        {!studyGroup.isMember && (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-white text-lg font-semibold mb-2">
              Join the group to participate in chat
            </h3>
            <p className="text-gray-400 mb-4">
              You need to be a member to view and send messages in this study group.
            </p>
            {!studyGroup.isFull && (
              <button
                onClick={handleJoin}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Join Group
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

StudyGroupDetail.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default StudyGroupDetail;

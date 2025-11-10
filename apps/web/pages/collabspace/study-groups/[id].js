import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PropTypes from 'prop-types';
import Navbar from '../../../components/Navbar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ErrorMessage from '../../../components/ErrorMessage';
import { collabspace, auth } from '../../../lib/api';

function StudyGroupDetail({ user, setUser }) {
  const [studyGroup, setStudyGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'members', 'info'
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef(null);
  const router = useRouter();
  const { id } = router.query;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (id && user) {
      loadStudyGroup();
    }
  }, [id, user]);

  useEffect(() => {
    if (activeTab === 'chat' && studyGroup?.isMember) {
      loadMessages();
      // Poll for new messages every 3 seconds
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, studyGroup?.isMember, id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadStudyGroup() {
    try {
      setError(null);
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
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await collabspace.sendStudyGroupMessage(id, newMessage);
      setNewMessage('');
      await loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function handleJoinGroup() {
    try {
      await collabspace.joinStudyGroup(id);
      await loadStudyGroup();
    } catch (err) {
      console.error('Failed to join group:', err);
      setError(err.message || 'Failed to join group');
    }
  }

  async function handleLeaveGroup() {
    if (!confirm('Are you sure you want to leave this study group?')) return;

    try {
      await collabspace.leaveStudyGroup(id);
      router.push('/collabspace/study-groups');
    } catch (err) {
      console.error('Failed to leave group:', err);
      setError(err.message || 'Failed to leave group');
    }
  }

  async function handleEditMessage(messageId) {
    setSaving(true);
    setError(null);

    try {
      await collabspace.updateGroupMessage(messageId, editContent);
      setEditingMessageId(null);
      setEditContent('');
      await loadMessages();
    } catch (err) {
      console.error('Failed to edit message:', err);
      setError(err.message || 'Failed to edit message');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    setError(null);

    try {
      await collabspace.deleteGroupMessage(messageId);
      await loadMessages();
    } catch (err) {
      console.error('Failed to delete message:', err);
      setError(err.message || 'Failed to delete message');
    }
  }

  function startEditingMessage(message) {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  }

  function cancelEditing() {
    setEditingMessageId(null);
    setEditContent('');
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <LoadingSpinner size="lg" text="Loading study group..." />
        </div>
      </div>
    );
  }

  if (!studyGroup) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ErrorMessage message="Study group not found" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CollabSpace" user={user} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-white mb-2 text-sm"
              >
                ← Back to Study Groups
              </button>
              <h1 className="text-3xl font-bold text-white mb-2">{studyGroup.name}</h1>
              {studyGroup.course && (
                <p className="text-teal-400">
                  {studyGroup.course.code} - {studyGroup.course.name}
                </p>
              )}
            </div>

            {/* Join/Leave Button */}
            {!studyGroup.isMember ? (
              <button
                onClick={handleJoinGroup}
                disabled={studyGroup.isFull}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {studyGroup.isFull ? 'Group Full' : 'Join Group'}
              </button>
            ) : (
              <button
                onClick={handleLeaveGroup}
                className="px-6 py-3 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                Leave Group
              </button>
            )}
          </div>

          {/* Description */}
          {studyGroup.description && <p className="text-gray-300 mb-4">{studyGroup.description}</p>}

          {/* Stats */}
          <div className="flex items-center space-x-6 text-sm text-gray-400">
            <span>
              👥 {studyGroup._count.members}/{studyGroup.maxMembers} members
            </span>
            <span>💬 {studyGroup._count.messages} messages</span>
            {studyGroup.cohort && <span>📊 Level: {studyGroup.cohort}</span>}
          </div>

          {/* Tags */}
          {studyGroup.tags && studyGroup.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {studyGroup.tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-teal-600/20 text-teal-400 text-sm rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={loadStudyGroup} />
          </div>
        )}

        {/* Tabs */}
        {studyGroup.isMember && (
          <div className="mb-6">
            <div className="flex space-x-4 border-b border-gray-700">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'text-teal-400 border-b-2 border-teal-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'members'
                    ? 'text-teal-400 border-b-2 border-teal-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Members ({studyGroup.members.length})
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'info'
                    ? 'text-teal-400 border-b-2 border-teal-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Info
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {!studyGroup.isMember ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-white text-xl font-semibold mb-2">Members Only</h3>
            <p className="text-gray-400 mb-6">
              Join this study group to access chat and member features
            </p>
          </div>
        ) : activeTab === 'chat' ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isAuthor = user && message.author.id === user.id;
                  const isEditing = editingMessageId === message.id;

                  return (
                    <div key={message.id} className="flex items-start space-x-3">
                      <Link href={`/hub/users/${message.author.id}`}>
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                          {message.author.firstName[0]}
                        </div>
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Link href={`/hub/users/${message.author.id}`}>
                            <span className="text-white font-medium text-sm hover:text-teal-400 transition-colors cursor-pointer">
                              {message.author.firstName} {message.author.lastName}
                            </span>
                          </Link>
                          <span className="text-gray-400 text-xs">
                            {new Date(message.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2"
                              autoFocus
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={cancelEditing}
                                className="px-3 py-1 text-gray-400 hover:text-white text-sm transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEditMessage(message.id)}
                                disabled={saving || !editContent.trim()}
                                className="px-3 py-1 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-300 text-sm">{message.content}</p>

                            {isAuthor && (
                              <div className="flex items-center space-x-3 text-xs mt-1">
                                <button
                                  onClick={() => startEditingMessage(message)}
                                  className="text-gray-400 hover:text-blue-400 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="text-gray-400 hover:text-red-400 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="border-t border-gray-700 p-4">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        ) : activeTab === 'members' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studyGroup.members.map((member) => (
              <div key={member.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <Link href={`/hub/users/${member.user.id}`}>
                    <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-700 rounded-full flex items-center justify-center text-white font-semibold text-lg cursor-pointer hover:opacity-80 transition-opacity">
                      {member.user.firstName[0]}
                    </div>
                  </Link>
                  <div className="flex-1">
                    <Link href={`/hub/users/${member.user.id}`}>
                      <p className="text-white font-medium hover:text-teal-400 transition-colors cursor-pointer">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                    </Link>
                    <p className="text-gray-400 text-sm">@{member.user.username}</p>
                  </div>
                  {member.role === 'admin' && (
                    <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded">
                      Admin
                    </span>
                  )}
                </div>
                {member.user.major && (
                  <p className="text-gray-400 text-sm mt-2">📚 {member.user.major}</p>
                )}
                {member.user.cohort && (
                  <p className="text-gray-400 text-sm">📊 {member.user.cohort}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
            <div>
              <h3 className="text-white font-semibold mb-2">Meeting Schedule</h3>
              {studyGroup.meetingTime ? (
                <p className="text-gray-300">⏰ {studyGroup.meetingTime}</p>
              ) : (
                <p className="text-gray-400">No meeting time set</p>
              )}
              {studyGroup.meetingDays && studyGroup.meetingDays.length > 0 && (
                <p className="text-gray-300 mt-1">📅 {studyGroup.meetingDays.join(', ')}</p>
              )}
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Location</h3>
              {studyGroup.location ? (
                <p className="text-gray-300">📍 {studyGroup.location}</p>
              ) : (
                <p className="text-gray-400">No location set</p>
              )}
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Group Admin</h3>
              <div className="flex items-center space-x-3">
                <Link href={`/hub/users/${studyGroup.creator.id}`}>
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-700 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer hover:opacity-80 transition-opacity">
                    {studyGroup.creator.firstName[0]}
                  </div>
                </Link>
                <div>
                  <Link href={`/hub/users/${studyGroup.creator.id}`}>
                    <p className="text-white hover:text-teal-400 transition-colors cursor-pointer">
                      {studyGroup.creator.firstName} {studyGroup.creator.lastName}
                    </p>
                  </Link>
                  <p className="text-gray-400 text-sm">@{studyGroup.creator.username}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Group Details</h3>
              <p className="text-gray-300">
                Created on {new Date(studyGroup.createdAt).toLocaleDateString()}
              </p>
              <p className="text-gray-300">Privacy: {studyGroup.isPublic ? 'Public' : 'Private'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

StudyGroupDetail.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default StudyGroupDetail;

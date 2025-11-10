import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../../../components/Navbar';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ErrorMessage from '../../../components/ErrorMessage';
import { users, auth } from '../../../lib/api';

function UserProfile({ user: currentUser, setUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id && currentUser) {
      loadProfile();
    }
  }, [id, currentUser]);

  async function loadProfile() {
    try {
      setError(null);
      const data = await users.getProfile(id);
      setProfile(data.user);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!currentUser) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar currentModule="Hub" user={currentUser} onLogout={handleLogout} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <LoadingSpinner size="lg" text="Loading profile..." />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar currentModule="Hub" user={currentUser} onLogout={handleLogout} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <ErrorMessage message={error || 'User not found'} />
          <div className="mt-4">
            <button
              onClick={() => router.back()}
              className="text-teal-400 hover:text-teal-300 transition-colors"
            >
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="Hub" user={currentUser} onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white mb-6 text-sm transition-colors"
        >
          ← Back
        </button>

        {/* Profile Header */}
        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 mb-6">
          <div className="flex items-start space-x-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-teal-600 to-cyan-700 rounded-full flex items-center justify-center text-white font-bold text-4xl flex-shrink-0">
              {profile.firstName[0]}{profile.lastName[0]}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-gray-400 mb-4">@{profile.username}</p>

              {/* Bio */}
              {profile.bio && (
                <p className="text-gray-300 mb-4 leading-relaxed">{profile.bio}</p>
              )}

              {/* Stats */}
              <div className="flex items-center space-x-6 text-sm">
                <div>
                  <span className="text-white font-semibold">{profile._count.posts}</span>
                  <span className="text-gray-400 ml-1">Posts</span>
                </div>
                <div>
                  <span className="text-white font-semibold">{profile._count.projects}</span>
                  <span className="text-gray-400 ml-1">Projects</span>
                </div>
                <div>
                  <span className="text-white font-semibold">{profile._count.connections}</span>
                  <span className="text-gray-400 ml-1">Connections</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Academic Info */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Academic Info</h2>
            <div className="space-y-3">
              {profile.major && (
                <div>
                  <p className="text-gray-400 text-sm">Major</p>
                  <p className="text-white">{profile.major}</p>
                </div>
              )}
              {profile.year && (
                <div>
                  <p className="text-gray-400 text-sm">Year</p>
                  <p className="text-white">Year {profile.year}</p>
                </div>
              )}
              {profile.cohort && (
                <div>
                  <p className="text-gray-400 text-sm">Cohort Level</p>
                  <p className="text-white capitalize">{profile.cohort}</p>
                </div>
              )}
              {!profile.major && !profile.year && !profile.cohort && (
                <p className="text-gray-400 text-sm">No academic information provided</p>
              )}
            </div>
          </div>

          {/* Skills */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Skills</h2>
            {profile.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-teal-600/20 text-teal-400 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No skills listed</p>
            )}
          </div>

          {/* Interests */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Interests</h2>
            {profile.interests && profile.interests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No interests listed</p>
            )}
          </div>

          {/* Member Since */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Member Since</h2>
            <p className="text-white">
              {new Date(profile.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

UserProfile.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default UserProfile;

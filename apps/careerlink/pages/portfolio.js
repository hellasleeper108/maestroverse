import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { careerlink, auth } from '../lib/api';

function Portfolio({ user, setUser }) {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    headline: '',
    summary: '',
    experience: '',
    education: '',
    resumeUrl: '',
    linkedin: '',
    github: '',
    website: '',
  });
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadPortfolio();
  }, [user]);

  async function loadPortfolio() {
    if (!user?.id) return;

    try {
      setError(null);
      const data = await careerlink.getPortfolio(user.id);
      if (data.portfolio) {
        setPortfolio(data.portfolio);
        setFormData({
          headline: data.portfolio.headline || '',
          summary: data.portfolio.summary || '',
          experience: Array.isArray(data.portfolio.experience) && data.portfolio.experience.length > 0
            ? data.portfolio.experience[0]?.description || ''
            : '',
          education: Array.isArray(data.portfolio.education) && data.portfolio.education.length > 0
            ? data.portfolio.education[0]?.description || ''
            : '',
          resumeUrl: data.portfolio.resumeUrl || '',
          linkedin: data.portfolio.linkedin || '',
          github: data.portfolio.github || '',
          website: data.portfolio.website || '',
        });
      }
    } catch (err) {
      console.error('Failed to load portfolio:', err);
      setError(err.message || 'Failed to load portfolio. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        headline: formData.headline || undefined,
        summary: formData.summary || undefined,
        experience: formData.experience ? [{ description: formData.experience }] : [],
        education: formData.education ? [{ description: formData.education }] : [],
        resumeUrl: formData.resumeUrl || '',
        linkedin: formData.linkedin || '',
        github: formData.github || '',
        website: formData.website || '',
      };
      await careerlink.updatePortfolio(payload);
      await loadPortfolio();
      setEditing(false);
    } catch (err) {
      console.error('Failed to save portfolio:', err);
      setError(err.message || 'Failed to save portfolio. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CareerLink" user={user} onLogout={handleLogout} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Portfolio</h1>
            <p className="text-gray-400">Manage your professional profile</p>
          </div>
          {!editing && !loading && (
            <button
              onClick={() => setEditing(true)}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Edit Portfolio
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={loadPortfolio} />
          </div>
        )}

        {loading ? (
          <LoadingSpinner size="lg" text="Loading your portfolio..." />
        ) : editing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2">Professional Headline</label>
                  <textarea
                    name="headline"
                    value={formData.headline}
                    onChange={handleChange}
                    placeholder="Tell us about yourself..."
                    className="w-full bg-gray-700 text-white rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    rows="4"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Professional Summary</label>
                  <input
                    type="text"
                    name="summary"
                    value={formData.summary}
                    onChange={handleChange}
                    placeholder="Brief summary of your professional background..."
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Experience</label>
                  <textarea
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    placeholder="Describe your work experience..."
                    className="w-full bg-gray-700 text-white rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    rows="4"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Education</label>
                  <textarea
                    name="education"
                    value={formData.education}
                    onChange={handleChange}
                    placeholder="Describe your educational background..."
                    className="w-full bg-gray-700 text-white rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    rows="3"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-4">Links</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Resume URL</label>
                  <input
                    type="url"
                    name="resumeUrl"
                    value={formData.resumeUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">LinkedIn URL</label>
                  <input
                    type="url"
                    name="linkedin"
                    value={formData.linkedin}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">GitHub URL</label>
                  <input
                    type="url"
                    name="github"
                    value={formData.github}
                    onChange={handleChange}
                    placeholder="https://github.com/..."
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Portfolio Website</label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Portfolio'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  loadPortfolio();
                }}
                disabled={saving}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : portfolio ? (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
              <div className="flex items-start space-x-6">
                <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-gray-400 mb-4">{user.email}</p>
                  {portfolio.headline && (
                    <p className="text-xl text-teal-400 font-semibold mb-2">{portfolio.headline}</p>
                  )}
                  {portfolio.summary && (
                    <p className="text-gray-300 leading-relaxed">{portfolio.summary}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Experience */}
            {portfolio.experience && Array.isArray(portfolio.experience) && portfolio.experience.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4">Experience</h2>
                <div className="space-y-3">
                  {portfolio.experience.map((exp, i) => (
                    <p key={i} className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {exp.description || JSON.stringify(exp)}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {portfolio.education && Array.isArray(portfolio.education) && portfolio.education.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4">Education</h2>
                <div className="space-y-3">
                  {portfolio.education.map((edu, i) => (
                    <p key={i} className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {edu.description || JSON.stringify(edu)}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {(portfolio.resumeUrl ||
              portfolio.linkedin ||
              portfolio.github ||
              portfolio.website) && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4">Links</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {portfolio.resumeUrl && (
                    <a
                      href={portfolio.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      <span className="text-2xl">📄</span>
                      <span>View Resume</span>
                    </a>
                  )}
                  {portfolio.linkedin && (
                    <a
                      href={portfolio.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      <span className="text-2xl">💼</span>
                      <span>LinkedIn Profile</span>
                    </a>
                  )}
                  {portfolio.github && (
                    <a
                      href={portfolio.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      <span className="text-2xl">💻</span>
                      <span>GitHub Profile</span>
                    </a>
                  )}
                  {portfolio.website && (
                    <a
                      href={portfolio.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      <span className="text-2xl">🌐</span>
                      <span>Portfolio Website</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-white text-xl font-semibold mb-2">No portfolio yet</h3>
            <p className="text-gray-400 mb-6">
              Create your professional portfolio to showcase your skills and experience
            </p>
            <button
              onClick={() => setEditing(true)}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Create Portfolio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

Portfolio.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default Portfolio;

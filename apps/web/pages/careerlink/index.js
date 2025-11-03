import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PropTypes from 'prop-types';
import Navbar from '../../components/Navbar';
import LoadingSpinner from '../../components/LoadingSpinner';
import { careerlink, auth } from '../../lib/api';

function CareerLink({ user, setUser }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  async function loadProjects() {
    try {
      const data = await careerlink.getProjects();
      setProjects(data.projects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }


  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="CareerLink" user={user} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">CareerLink</h1>
          <p className="text-gray-400">
            Build your portfolio, connect with peers, and showcase your projects
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href="/careerlink/portfolio">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:bg-gray-750 transition-colors cursor-pointer">
              <div className="text-3xl mb-3">📝</div>
              <h3 className="text-white font-semibold mb-1">My Portfolio</h3>
              <p className="text-gray-400 text-sm">
                Manage your professional profile and resume
              </p>
            </div>
          </Link>

          <Link href="/careerlink/projects">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:bg-gray-750 transition-colors cursor-pointer">
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="text-white font-semibold mb-1">My Projects</h3>
              <p className="text-gray-400 text-sm">
                Showcase your academic and personal projects
              </p>
            </div>
          </Link>

          <Link href="/careerlink/browse">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:bg-gray-750 transition-colors cursor-pointer">
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="text-white font-semibold mb-1">Browse Students</h3>
              <p className="text-gray-400 text-sm">
                Find and connect with talented peers
              </p>
            </div>
          </Link>
        </div>

        {/* Featured Projects */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Featured Projects</h2>
          {loading ? (
            <LoadingSpinner size="lg" text="Loading featured projects..." />
          ) : projects.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
              <div className="text-6xl mb-4">🚀</div>
              <h3 className="text-white text-xl font-semibold mb-2">No projects yet</h3>
              <p className="text-gray-400">Be the first to showcase your work!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 6).map((project) => (
                <div
                  key={project.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-teal-500 transition-colors"
                >
                  {project.imageUrl && (
                    <div className="h-48 bg-gray-700" />
                  )}
                  <div className="p-6">
                    <h3 className="text-white font-semibold mb-2">{project.title}</h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.technologies.slice(0, 3).map((tech, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-teal-600/20 text-teal-400 text-xs rounded"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <div className="w-6 h-6 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs">
                        {project.author.firstName[0]}
                      </div>
                      <span>{project.author.firstName} {project.author.lastName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

CareerLink.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default CareerLink;

/**
 * API utility functions for making HTTP requests
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Get authentication token from localStorage
 */
function getToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('maestro_token');
  }
  return null;
}

/**
 * Set authentication token in localStorage
 */
export function setToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('maestro_token', token);
  }
}

/**
 * Remove authentication token from localStorage
 */
export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('maestro_token');
  }
}

/**
 * Make authenticated API request
 */
async function fetchAPI(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

// ========== Auth API ==========

export const auth = {
  async register(userData) {
    const data = await fetchAPI('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  async login(credentials) {
    const data = await fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  async getMe() {
    return fetchAPI('/api/auth/me');
  },

  logout() {
    removeToken();
  },
};

// ========== User API ==========

export const users = {
  async getProfile(userId) {
    return fetchAPI(`/api/users/${userId}`);
  },

  async updateProfile(data) {
    return fetchAPI('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getNotifications() {
    return fetchAPI('/api/users/notifications');
  },

  async markNotificationRead(notificationId) {
    return fetchAPI(`/api/users/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  async markAllNotificationsRead() {
    return fetchAPI('/api/users/notifications/read-all', {
      method: 'PUT',
    });
  },
};

// ========== Hub API ==========

export const hub = {
  async getPosts(page = 1, limit = 20) {
    return fetchAPI(`/api/hub/posts?page=${page}&limit=${limit}`);
  },

  async createPost(data) {
    return fetchAPI('/api/hub/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async likePost(postId) {
    return fetchAPI(`/api/hub/posts/${postId}/like`, {
      method: 'POST',
    });
  },

  async getComments(postId) {
    return fetchAPI(`/api/hub/posts/${postId}/comments`);
  },

  async createComment(postId, content) {
    return fetchAPI(`/api/hub/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async getGroups() {
    return fetchAPI('/api/hub/groups');
  },

  async createGroup(data) {
    return fetchAPI('/api/hub/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async joinGroup(groupId) {
    return fetchAPI(`/api/hub/groups/${groupId}/join`, {
      method: 'POST',
    });
  },

  async getEvents() {
    return fetchAPI('/api/hub/events');
  },

  async createEvent(data) {
    return fetchAPI('/api/hub/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMessages() {
    return fetchAPI('/api/hub/messages');
  },

  async sendMessage(data) {
    return fetchAPI('/api/hub/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ========== CareerLink API ==========

export const careerlink = {
  async getPortfolio(userId) {
    return fetchAPI(`/api/careerlink/portfolio/${userId}`);
  },

  async updatePortfolio(data) {
    return fetchAPI('/api/careerlink/portfolio', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getProjects(userId) {
    const query = userId ? `?userId=${userId}` : '';
    return fetchAPI(`/api/careerlink/projects${query}`);
  },

  async createProject(data) {
    return fetchAPI('/api/careerlink/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProject(id, data) {
    return fetchAPI(`/api/careerlink/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProject(id) {
    return fetchAPI(`/api/careerlink/projects/${id}`, {
      method: 'DELETE',
    });
  },

  async getConnections() {
    return fetchAPI('/api/careerlink/connections');
  },

  async sendConnectionRequest(userId) {
    return fetchAPI(`/api/careerlink/connections/${userId}`, {
      method: 'POST',
    });
  },

  async acceptConnection(connectionId) {
    return fetchAPI(`/api/careerlink/connections/${connectionId}/accept`, {
      method: 'PUT',
    });
  },

  async browseStudents(filters) {
    const params = new URLSearchParams(filters);
    return fetchAPI(`/api/careerlink/browse?${params}`);
  },
};

// ========== CollabSpace API ==========

export const collabspace = {
  async getCourses() {
    return fetchAPI('/api/collabspace/courses');
  },

  async getThreads(courseId) {
    return fetchAPI(`/api/collabspace/courses/${courseId}/threads`);
  },

  async getThread(threadId) {
    return fetchAPI(`/api/collabspace/threads/${threadId}`);
  },

  async createThread(data) {
    return fetchAPI('/api/collabspace/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createReply(threadId, content) {
    return fetchAPI(`/api/collabspace/threads/${threadId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async getStudyGroups(courseId) {
    return fetchAPI(`/api/collabspace/courses/${courseId}/study-groups`);
  },

  async createStudyGroup(data) {
    return fetchAPI('/api/collabspace/study-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async joinStudyGroup(studyGroupId) {
    return fetchAPI(`/api/collabspace/study-groups/${studyGroupId}/join`, {
      method: 'POST',
    });
  },

  async getResources(courseId) {
    return fetchAPI(`/api/collabspace/courses/${courseId}/resources`);
  },

  async createResource(data) {
    return fetchAPI('/api/collabspace/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async voteResource(resourceId, value) {
    return fetchAPI(`/api/collabspace/resources/${resourceId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  },
};

// ========== Search API ==========

export const search = {
  async globalSearch(query, type) {
    const params = new URLSearchParams({ q: query });
    if (type) params.append('type', type);
    return fetchAPI(`/api/search?${params}`);
  },

  async getAnalytics() {
    return fetchAPI('/api/search/analytics');
  },
};

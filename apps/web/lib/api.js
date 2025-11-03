/**
 * API utility functions for making HTTP requests
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Get authentication token from localStorage
 */
function getToken() {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('maestro_token');
    console.log('[API] Getting token from localStorage:', token ? 'Token exists' : 'No token');
    return token;
  }
  return null;
}

/**
 * Set authentication token in localStorage
 */
export function setToken(token) {
  if (typeof window !== 'undefined') {
    console.log('[API] Setting token in localStorage');
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
    console.log(`[API] Request to ${endpoint} with token:`, token.substring(0, 20) + '...');
    headers.Authorization = `Bearer ${token}`;
  } else {
    console.log(`[API] Request to ${endpoint} WITHOUT token`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`[API] Request failed with status ${response.status}:`, data);
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
    console.log('[API] Attempting login...');
    const data = await fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (data.token) {
      console.log('[API] Login successful, storing token');
      setToken(data.token);
    } else {
      console.error('[API] Login response missing token');
    }
    return data;
  },

  async getMe() {
    console.log('[API] Getting current user...');
    const result = await fetchAPI('/api/auth/me');
    console.log('[API] Got user:', result.user?.email || 'No user');
    return result;
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

  async getPost(postId) {
    return fetchAPI(`/api/hub/posts/${postId}`);
  },

  async createPost(data) {
    return fetchAPI('/api/hub/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deletePost(postId) {
    return fetchAPI(`/api/hub/posts/${postId}`, {
      method: 'DELETE',
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

  async createComment(postId, content, parentId = null) {
    return fetchAPI(`/api/hub/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    });
  },

  async updateComment(commentId, content) {
    return fetchAPI(`/api/hub/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  async deleteComment(commentId) {
    return fetchAPI(`/api/hub/comments/${commentId}`, {
      method: 'DELETE',
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

  async deleteThread(threadId) {
    return fetchAPI(`/api/collabspace/threads/${threadId}`, {
      method: 'DELETE',
    });
  },

  async createReply(threadId, content) {
    return fetchAPI(`/api/collabspace/threads/${threadId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async updateReply(replyId, content) {
    return fetchAPI(`/api/collabspace/replies/${replyId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  async deleteReply(replyId) {
    return fetchAPI(`/api/collabspace/replies/${replyId}`, {
      method: 'DELETE',
    });
  },

  async getStudyGroups(filters = {}) {
    const params = new URLSearchParams(filters);
    return fetchAPI(`/api/collabspace/study-groups?${params}`);
  },

  async getMyStudyGroups() {
    return fetchAPI('/api/collabspace/study-groups/my-groups');
  },

  async getStudyGroup(studyGroupId) {
    return fetchAPI(`/api/collabspace/study-groups/${studyGroupId}`);
  },

  async createStudyGroup(data) {
    return fetchAPI('/api/collabspace/study-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateStudyGroup(studyGroupId, data) {
    return fetchAPI(`/api/collabspace/study-groups/${studyGroupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async joinStudyGroup(studyGroupId) {
    return fetchAPI(`/api/collabspace/study-groups/${studyGroupId}/join`, {
      method: 'POST',
    });
  },

  async leaveStudyGroup(studyGroupId) {
    return fetchAPI(`/api/collabspace/study-groups/${studyGroupId}/leave`, {
      method: 'POST',
    });
  },

  async getStudyGroupMessages(studyGroupId) {
    return fetchAPI(`/api/collabspace/study-groups/${studyGroupId}/messages`);
  },

  async sendStudyGroupMessage(studyGroupId, content) {
    return fetchAPI(`/api/collabspace/study-groups/${studyGroupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async updateGroupMessage(messageId, content) {
    return fetchAPI(`/api/collabspace/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  async deleteGroupMessage(messageId) {
    return fetchAPI(`/api/collabspace/messages/${messageId}`, {
      method: 'DELETE',
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

// ========== Admin API ==========

export const admin = {
  async listUsers() {
    return fetchAPI('/api/admin/users');
  },

  async suspendUser(userId, durationMinutes, reason) {
    return fetchAPI(`/api/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ durationMinutes, reason }),
    });
  },

  async banUser(userId, reason) {
    return fetchAPI(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async restoreUser(userId) {
    return fetchAPI(`/api/admin/users/${userId}/restore`, {
      method: 'POST',
    });
  },

  async updateRole(userId, role) {
    return fetchAPI(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  async deleteUser(userId) {
    return fetchAPI(`/api/admin/users/${userId}`, {
      method: 'DELETE',
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

// ========== MIM (Chat Rooms) API ==========

export const mim = {
  async getRooms() {
    return fetchAPI('/api/mim/rooms');
  },

  async getRoom(roomId) {
    return fetchAPI(`/api/mim/rooms/${roomId}`);
  },

  async createRoom(data) {
    return fetchAPI('/api/mim/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async joinRoom(roomId, password = null) {
    return fetchAPI(`/api/mim/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  async leaveRoom(roomId) {
    return fetchAPI(`/api/mim/rooms/${roomId}/leave`, {
      method: 'POST',
    });
  },

  async inviteToRoom(roomId, inviteeId) {
    return fetchAPI(`/api/mim/rooms/${roomId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ inviteeId }),
    });
  },

  async getMessages(roomId, limit = 100, before = null) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (before) params.append('before', before);
    return fetchAPI(`/api/mim/rooms/${roomId}/messages?${params}`);
  },

  async deleteRoom(roomId) {
    return fetchAPI(`/api/mim/rooms/${roomId}`, {
      method: 'DELETE',
    });
  },

  async deleteMessage(messageId) {
    return fetchAPI(`/api/mim/messages/${messageId}`, {
      method: 'DELETE',
    });
  },
};

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error(
    "[api] VITE_API_URL is not set. " +
    "Create frontend/.env with VITE_API_URL=http://localhost:5000"
  );
}

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = response.status;

    if (response.status === 401) {
      // Clear stale credentials so the next render shows the login screen
      localStorage.removeItem("keepalive_token");
      localStorage.removeItem("keepalive_user");
    }

    throw err;
  }

  return data;
};

const authHeaders = () => {
  const token = localStorage.getItem("keepalive_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const register = (email, password) =>
  request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

export const login = (email, password) =>
  request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

export const getUrls = () =>
  request("/api/urls", {
    headers: authHeaders()
  });

export const createUrl = (url, name) =>
  request("/api/urls", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url, name })
  });

export const updateUrl = (id, data) =>
  request(`/api/urls/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data)
  });

export const deleteUrl = (id) =>
  request(`/api/urls/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
import { useState } from "react";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";

function App() {
  const [auth, setAuth] = useState(() => {
    // Hydrate from localStorage on first render
    const token = localStorage.getItem("keepalive_token");
    const raw = localStorage.getItem("keepalive_user");

    if (!token || !raw) return null;

    try {
      return { token, user: JSON.parse(raw) };
    } catch {
      // Corrupted storage — start fresh
      localStorage.removeItem("keepalive_token");
      localStorage.removeItem("keepalive_user");
      return null;
    }
  });

  const handleLogin = (user, token) => {
    localStorage.setItem("keepalive_token", token);
    localStorage.setItem("keepalive_user", JSON.stringify(user));
    setAuth({ user, token });
  };

  const clearSession = () => {
    localStorage.removeItem("keepalive_token");
    localStorage.removeItem("keepalive_user");
    setAuth(null);
  };

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Dashboard
      user={auth.user}
      onLogout={clearSession}
      onUnauthorized={clearSession} // Called on 401 — sends user back to Login
    />
  );
}

export default App;
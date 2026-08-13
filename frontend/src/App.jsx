import {
  useCallback,
  useState
} from "react";

import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";

const TOKEN_KEY =
  "keepalive_token";

const USER_KEY =
  "keepalive_user";

const loadAuth =
  () => {
    const token =
      localStorage.getItem(
        TOKEN_KEY
      );

    const rawUser =
      localStorage.getItem(
        USER_KEY
      );

    if (!token || !rawUser) {
      return null;
    }

    try {
      const user =
        JSON.parse(rawUser);

      if (
        !user ||
        typeof user !==
          "object" ||
        !user.id ||
        !user.email
      ) {
        throw new Error(
          "Invalid stored user"
        );
      }

      return {
        token,
        user
      };
    } catch {
      localStorage.removeItem(
        TOKEN_KEY
      );

      localStorage.removeItem(
        USER_KEY
      );

      return null;
    }
  };

function App() {
  const [auth, setAuth] =
    useState(loadAuth);

  const handleLogin =
    useCallback(
      (user, token) => {
        if (
          !user?.id ||
          !user?.email ||
          !token
        ) {
          console.error(
            "[Auth] Invalid login response."
          );

          return;
        }

        localStorage.setItem(
          TOKEN_KEY,
          token
        );

        localStorage.setItem(
          USER_KEY,
          JSON.stringify(user)
        );

        setAuth({
          token,
          user
        });
      },
      []
    );

  const handleLogout =
    useCallback(() => {
      localStorage.removeItem(
        TOKEN_KEY
      );

      localStorage.removeItem(
        USER_KEY
      );

      setAuth(null);
    }, []);

  if (!auth) {
    return (
      <Login
        onLogin={
          handleLogin
        }
      />
    );
  }

  return (
    <Dashboard
      user={auth.user}
      onLogout={
        handleLogout
      }
      onUnauthorized={
        handleLogout
      }
    />
  );
}

export default App;
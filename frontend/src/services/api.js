const API_URL =
  import.meta.env.VITE_API_URL?.trim();

const getApiUrl = (
  endpoint
) => {
  if (!API_URL) {
    throw new Error(
      "VITE_API_URL is not configured."
    );
  }

  return `${API_URL.replace(
    /\/+$/,
    ""
  )}/${endpoint.replace(
    /^\/+/,
    ""
  )}`;
};

const parseResponse =
  async (response) => {
    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      try {
        return await response.json();
      } catch {
        return {};
      }
    }

    const text =
      await response.text();

    return {
      message:
        text ||
        `Request failed with status ${response.status}`
    };
  };

const request =
  async (
    endpoint,
    options = {}
  ) => {
    let response;

    try {
      response =
        await fetch(
          getApiUrl(endpoint),
          {
            ...options,
            headers: {
              "Content-Type":
                "application/json",
              ...(options.headers ||
                {})
            }
          }
        );
    } catch (error) {
      const networkError =
        new Error(
          "Unable to connect to the server."
        );

      networkError.cause =
        error;

      throw networkError;
    }

    const data =
      await parseResponse(
        response
      );

    if (!response.ok) {
      const error =
        new Error(
          data?.message ||
            `Request failed with status ${response.status}`
        );

      error.status =
        response.status;

      throw error;
    }

    return data;
  };

const authHeaders =
  () => {
    const token =
      localStorage.getItem(
        "keepalive_token"
      );

    return token
      ? {
          Authorization: `Bearer ${token}`
        }
      : {};
  };

export const register = (
  email,
  password
) =>
  request(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    }
  );

export const login = (
  email,
  password
) =>
  request(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    }
  );

export const getUrls =
  () =>
    request(
      "/api/urls",
      {
        headers:
          authHeaders()
      }
    );

export const createUrl = (
  url,
  name
) =>
  request(
    "/api/urls",
    {
      method: "POST",
      headers:
        authHeaders(),
      body: JSON.stringify({
        url,
        name
      })
    }
  );

export const updateUrl = (
  id,
  data
) =>
  request(
    `/api/urls/${id}`,
    {
      method: "PATCH",
      headers:
        authHeaders(),
      body: JSON.stringify(
        data
      )
    }
  );

export const deleteUrl = (
  id
) =>
  request(
    `/api/urls/${id}`,
    {
      method: "DELETE",
      headers:
        authHeaders()
    }
  );
import axios from "axios";
// https://faculty-appraisal-java-backend-376777978967.asia-south1.run.app
// https://faculty-appraisal-git-376777978967.asia-south1.run.app
const DEFAULT_API_BASE_URL =
  "https://faculty-appraisal-python-919405994318.asia-south1.run.app/api/v1";

const rawBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "");

const isHttpsFrontend = typeof window !== "undefined" && window.location && window.location.protocol === "https:";

// Force https for non-localhost URLs to prevent mixed-content blocks only if the frontend is HTTPS
export const API_BASE_URL = (isHttpsFrontend && /^http:\/\/(?!localhost)/.test(rawBaseUrl))
  ? rawBaseUrl.replace(/^http:\/\//, "https://")
  : rawBaseUrl;

console.log("=== API_BASE_URL ===", API_BASE_URL);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem("accessToken") || sessionStorage.getItem("token");

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const getFileUrl = (url) => {
  if (!url) return "";
  // Clean up any double/single quotes wrapped around the URL (common .env parsing bug)
  let cleanUrl = String(url).trim().replace(/^["']|["']$/g, "");
  
  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://") || cleanUrl.startsWith("blob:") || cleanUrl.startsWith("data:")) {
    return cleanUrl;
  }
  // Resolve relative URLs to the API base URL origin
  try {
    const origin = new URL(API_BASE_URL).origin;
    const resolved = cleanUrl.startsWith("/") ? `${origin}${cleanUrl}` : `${origin}/${cleanUrl}`;
    console.log("=== Resolving relative file URL ===", url, "->", resolved);
    return resolved;
  } catch (e) {
    console.error("=== Failed to resolve relative file URL ===", url, e);
    return cleanUrl;
  }
};

export const resolveRelativeUrls = (data) => {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(resolveRelativeUrls);
  }
  if (typeof data === "object") {
    const resolved = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && (key === "url" || key === "file_url" || key === "fileUrl" || key === "avatar_url" || key === "avatarUrl")) {
        resolved[key] = getFileUrl(value);
      } else if (typeof value === "object" && value !== null) {
        resolved[key] = resolveRelativeUrls(value);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }
  return data;
};

// Normalize every API error so err.message is always a user-safe string.
// Backend detail fields are developer-facing; show user_message when present.
// 401 clears the session and redirects to /login automatically.
apiClient.interceptors.response.use(
  (response) => {
    if (response.data) {
      response.data = resolveRelativeUrls(response.data);
    }
    return response;
  },
  (error) => {
    const data = error?.response?.data;
    const status = error?.response?.status;

    const userMessage =
      data?.user_message ?? "Something went wrong. Please try again.";

    error.message = userMessage;
    error.userMessage = userMessage;
    error.statusCode = status;

    if (status === 401) {
      sessionStorage.clear();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export const api = {
  get: (url, config) => apiClient.get(url, config).then((response) => response.data),
  post: (url, data, config) => apiClient.post(url, data, config).then((response) => response.data),
  put: (url, data, config) => apiClient.put(url, data, config).then((response) => response.data),
  delete: (url, config) => apiClient.delete(url, config).then((response) => response.data),
  getFileUrl,
};

// Returns an AbortController whose signal can be passed as { signal } in axios config.
// Call controller.abort() in the useEffect cleanup to cancel in-flight requests.
export const makeAbortController = () => new AbortController();

export const createFormData = (fields = {}, file) => {
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });

  if (file) {
    formData.append("file", file);
  }

  return formData;
};

export const fetchFormData = async () => {
  return JSON.parse(sessionStorage.getItem("formData")) || {};
};

export const saveFormData = async (data) => {
  sessionStorage.setItem("formData", JSON.stringify(data));
};

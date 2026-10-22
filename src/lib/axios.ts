import axios from "axios";

const callApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5000",
  timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || "90000"),
  headers: {
    "Content-Type": "application/json",
  },
});

// Optional: interceptors để log hoặc handle error toàn cục
callApi.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

callApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle error toàn cục, ví dụ alert
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/";
    }
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

function readMessageFromData(data: unknown): string | null {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const obj = data as { message?: unknown; error?: unknown };

    if (typeof obj.message === "string") {
      return obj.message;
    }

    if (Array.isArray(obj.message)) {
      const joined = obj.message.filter((item): item is string => typeof item === "string").join(", ");
      if (joined) {
        return joined;
      }
    }

    if (typeof obj.error === "string") {
      return obj.error;
    }
  }

  return null;
}

  export function getErrorMessage(err: unknown, fallback = "Lỗi"): string {
  const anyErr = err as { response?: { data?: unknown }; message?: unknown };
  const responseData = anyErr?.response?.data;

  const directMessage = readMessageFromData(responseData);
  if (directMessage) {
    return directMessage;
  }

  if (typeof anyErr?.message === "string") return anyErr.message;

  return fallback;
}

export async function getErrorMessageAsync(err: unknown, fallback = "Lỗi"): Promise<string> {
  const anyErr = err as { response?: { data?: unknown }; message?: unknown };
  const responseData = anyErr?.response?.data;

  const directMessage = readMessageFromData(responseData);
  if (directMessage) {
    return directMessage;
  }

  if (responseData instanceof Blob) {
    try {
      const rawText = await responseData.text();

      if (!rawText) {
        return fallback;
      }

      try {
        const parsed = JSON.parse(rawText);
        const parsedMessage = readMessageFromData(parsed);
        return parsedMessage || rawText;
      } catch (_e) {
        return rawText;
      }
    } catch (_e) {
      return fallback;
    }
  }

  if (responseData instanceof ArrayBuffer) {
    try {
      const rawText = new TextDecoder().decode(responseData);
      if (!rawText) {
        return fallback;
      }

      try {
        const parsed = JSON.parse(rawText);
        const parsedMessage = readMessageFromData(parsed);
        return parsedMessage || rawText;
      } catch (_e) {
        return rawText;
      }
    } catch (_e) {
      return fallback;
    }
  }

    if (typeof anyErr?.message === "string") return anyErr.message;

    return fallback;
  }

  export default callApi;
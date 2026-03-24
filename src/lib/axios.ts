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

export default callApi;
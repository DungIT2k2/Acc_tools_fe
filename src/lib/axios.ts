import axios from "axios";

// Tạo instance Axios
const callApi = axios.create({
  baseURL: "https://acc-tools-be.onrender.com/", // Thay bằng API của bạn
  timeout: 10000, // 10 giây timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Optional: interceptors để log hoặc handle error toàn cục
callApi.interceptors.request.use(
  (config) => {
    // Ví dụ: thêm token nếu cần
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

callApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle error toàn cục, ví dụ alert
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default callApi;
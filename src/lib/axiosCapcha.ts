import axios from "axios";

// Tạo instance Axios
const apiTax = axios.create({
    baseURL: "https://hoadondientu.gdt.gov.vn:30000",
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
    },
});

// Optional: interceptors để log hoặc handle error toàn cục
apiTax.interceptors.request.use(
    (config) => {
        return config;
    },
    (error) => Promise.reject(error)
);

apiTax.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle error toàn cục, ví dụ alert
        console.error("API Error:", error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export default apiTax;
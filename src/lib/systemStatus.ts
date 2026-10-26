import axios from "axios";

export const MAINTENANCE_PATH = "/maintenance";
export const DEFAULT_MAINTENANCE_MESSAGE = "Hệ thống đang bảo trì";

// Gom các request gọi liên tiếp trong khoảng này về chung 1 lần kiểm tra
const STATUS_CACHE_TTL = 3 * 1000;

export type SystemStatus = "up" | "maintenance" | "disconnected";

export type SystemStatusResult = {
  status: SystemStatus;
  message: string;
};

// Instance riêng, không đi qua interceptor của callApi để tránh gọi đệ quy
const statusApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5000",
  timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || "90000"),
});

let pendingCheck: Promise<SystemStatusResult> | null = null;
let lastResult: { result: SystemStatusResult; checkedAt: number } | null = null;

async function requestSystemStatus(): Promise<SystemStatusResult> {
  try {
    const response = await statusApi.get("/system/status");
    const isUp = response.status === 200 && response.data?.status === "UP";

    return { status: isUp ? "up" : "disconnected", message: response.data?.message ?? "" };
  } catch (err) {
    const response = (err as { response?: { status?: number; data?: { message?: unknown } } }).response;

    if (response?.status === 503) {
      const message = response.data?.message;
      return {
        status: "maintenance",
        message: typeof message === "string" && message ? message : DEFAULT_MAINTENANCE_MESSAGE,
      };
    }

    return { status: "disconnected", message: "" };
  }
}

export function fetchSystemStatus({ useCache = false } = {}): Promise<SystemStatusResult> {
  if (useCache && lastResult && Date.now() - lastResult.checkedAt < STATUS_CACHE_TTL) {
    return Promise.resolve(lastResult.result);
  }

  if (!pendingCheck) {
    pendingCheck = requestSystemStatus()
      .then((result) => {
        lastResult = { result, checkedAt: Date.now() };
        return result;
      })
      .finally(() => {
        pendingCheck = null;
      });
  }

  return pendingCheck;
}

export function clearAuthToken() {
  localStorage.removeItem("access_token");
}

export function redirectToMaintenance() {
  clearAuthToken();

  if (window.location.pathname !== MAINTENANCE_PATH) {
    window.location.replace(MAINTENANCE_PATH);
  }
}

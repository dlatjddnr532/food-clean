import axios, { AxiosInstance } from 'axios';

const BASE_URL = 'https://food-dq5i.onrender.com';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

// 요청마다 토큰 자동 첨부 (로그인 후 사용)
let authToken: string | null = null;

export const setToken = (token: string): void => {
  authToken = token;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const clearToken = (): void => {
  authToken = null;
  delete api.defaults.headers.common['Authorization'];
};

export default api;

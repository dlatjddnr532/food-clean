import axios, { AxiosInstance } from 'axios';

// ⚠️ 백엔드 담당자한테 IP 주소 받아서 여기 수정하세요!
// 예: 'http://192.168.0.10:3000'
const BASE_URL = 'http://192.168.0.25:3000';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
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

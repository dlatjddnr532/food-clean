import api, { setToken, clearToken } from './config';
import { UserProfile } from '../types';

// 회원가입 요청 타입
interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
}

// 로그인 요청 타입
interface LoginRequest {
  email: string;
  password: string;
}

// 로그인 응답 타입 (백엔드 user.entity.ts 기반)
interface LoginResponse {
  id: string;
  email: string;
  nickname: string;
  token: string;
}

// 신체정보 저장 요청 타입
interface PhysicalInfoRequest {
  gender: UserProfile['gender'];
  age: string;
  height: string;
  weight: string;
  activityLevel: UserProfile['activityLevel'];
}

// 회원가입
export const signup = async (body: SignupRequest): Promise<void> => {
  const response = await api.post('/auth/signup', body);
  return response.data;
};

// 로그인
export const login = async (body: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', body);
  if (response.data.token) {
    setToken(response.data.token);
  }
  return response.data;
};

// 신체정보 저장
export const savePhysicalInfo = async (
  userId: string,
  info: PhysicalInfoRequest,
): Promise<void> => {
  const response = await api.post(`/users/${userId}/physical-info`, info);
  return response.data;
};

// 로그아웃
export const logout = (): void => {
  clearToken();
};

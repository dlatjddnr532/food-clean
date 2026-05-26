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

// ─────────────────────────────────────────────────────────────────────
// 활동량 레벨 매핑 (백엔드 제한 대응)
// 백엔드 users.service.ts 가 인식하는 값:
//   sedentary → 계수 1.2
//   active    → 계수 1.55
//   그 외      → default 1.2 (sedentary 와 동일)
//
// 프론트 ActivityLevel: sedentary / light / moderate / active
// 매핑 전략:
//   moderate → 'active'  (1.55 ← 프론트도 1.55로 완벽 일치)
//   active   → 'active'  (1.55 ← 프론트 1.725 에 가장 근접)
//   light    → 'sedentary' (1.2 ← 프론트 1.375, 과소추정이지만 default 1.2 와 동일)
//   sedentary→ 'sedentary' (1.2 ← 완벽 일치)
// ─────────────────────────────────────────────────────────────────────
const mapActivityLevelForBackend = (level: UserProfile['activityLevel']): 'sedentary' | 'active' => {
  if (level === 'moderate' || level === 'active') return 'active';
  return 'sedentary';
};

// 신체정보 저장
export const savePhysicalInfo = async (
  userId: string,
  info: PhysicalInfoRequest,
): Promise<void> => {
  // 백엔드가 인식하는 두 가지 활동량 값으로 변환 후 전송
  const payload = {
    ...info,
    activityLevel: mapActivityLevelForBackend(info.activityLevel),
  };
  const response = await api.post(`/users/${userId}/physical-info`, payload);
  return response.data;
};

// 로그아웃
export const logout = (): void => {
  clearToken();
};

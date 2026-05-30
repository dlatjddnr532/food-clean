// ============================================================
// diet.ts — 식단 관련 백엔드 API 호출 모음
//
// 현재 상태: 백엔드 미연결 상태
// 백엔드 연결 시: 아래 각 함수들이 실제 서버와 통신하게 됩니다.
// API 기본 URL은 src/api/config.ts 에서 설정하세요.
// ============================================================

import api from './config';
import { MealType } from '../types';

// ── 음식 사진 AI 분석 — 백엔드 반환 음식 정보 타입 ──
// diet.service.ts convertToServing() 반환 구조와 동일
// 백엔드 dish_item 테이블(food.entity.ts) 기반
export interface ApiFoodInfo {
  id: number;
  name: string;
  servingSize: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodium: number;
}

// ── 음식 사진 AI 분석 응답 타입 ──
// 백엔드 diet.service.ts analyzeFoodImage() 반환 구조와 동일
interface AnalyzeResponse {
  success: boolean;
  foodName: string;                  // AI가 인식한 음식 이름
  matchedFoodInfo: ApiFoodInfo | null; // DB에서 정확히 매칭된 음식 (없으면 null)
  candidates: ApiFoodInfo[];           // 대안 후보 음식 리스트 (항상 4개)
  message?: string;                  // 성공/오류 메시지
}

// ── 식사 기록 저장 요청 타입 (백엔드 SaveMealLogDto와 동일하게 맞춤) ──
export interface MealLogRequest {
  mealType: MealType;   // '아침' | '점심' | '저녁' | '간식'
  foodName: string;     // 음식 이름
  quantity: number;     // 섭취량 (g)
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  eatDate: string;      // 'YYYY-MM-DD' 형식
}

// ── 식사 기록 조회 응답 타입 ──
interface MealLogResponse {
  id: number;
  userId: string;
  mealType: MealType;
  foodName: string;
  quantity: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  eatDate: string;
}

// ============================================================
// [기능] 음식 사진 업로드 → AI 음식 인식
// [화면] UploadScreen — 카메라/갤러리로 음식 사진 찍으면 호출됨
// [엔드포인트] POST /diet/upload
// [백엔드 할 일] 사진 받아서 Gemini/Vision AI로 음식 이름 인식 후 반환
// ============================================================
export const uploadFoodImage = async (imageUri: string): Promise<AnalyzeResponse> => {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'food.jpg',
  } as any);

  const response = await api.post<AnalyzeResponse>('/diet/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// ============================================================
// [기능] 식단 기록 저장
// [화면] UploadScreen — 음식 확인 후 "추가하기" 버튼 누르면 호출됨
// [엔드포인트] POST /diet/log/:userId
// ============================================================
export const saveMealLog = async (userId: string, mealData: MealLogRequest): Promise<MealLogResponse> => {
  const response = await api.post<MealLogResponse>(`/diet/log/${userId}`, mealData);
  return response.data;
};

// ============================================================
// [기능] 내 식단 기록 조회
// [화면] HomeScreen, CalendarScreen — 오늘/특정 날짜 식단 불러올 때 사용
// [엔드포인트] GET /diet/history/:userId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// ============================================================
// ── 기간별 식단 조회 응답 타입 (백엔드 getDietHistory 반환 구조) ──
export interface DietHistoryResponse {
  success: boolean;
  dailySummary: {
    date: string;
    totalCalories: number;
    totalProtein: number;
    totalFat: number;
    totalCarbs: number;
    totalSugar: number;
    totalFiber: number;
    totalSodium: number;
    meals: MealLogResponse[];
  }[];
  rawLogs: MealLogResponse[];
}

export const getMealLogs = async (userId: string, startDate: string, endDate: string): Promise<DietHistoryResponse> => {
  const response = await api.get<DietHistoryResponse>(`/diet/history/${userId}`, {
    params: { startDate, endDate },
  });
  return response.data;
};

// ============================================================
// [기능] 레시피 목록 조회 (검색/재료 필터 포함)
// [화면] RecipeScreen — 레시피 탭, 즐겨찾기 탭, 재료 탭
// [엔드포인트] GET /recipes?search=...&ingredients=...&excludeTools=...
// ============================================================
export interface BackendRecipe {
  id: number;
  title: string;
  content: string;
  video_url?: string;
  thumbnail_img?: string | null;
  likes_count: number;
  created_at: string;
  creator?: { id: string; nickname: string };
  ingredients: { id: number; name: string }[];
  cooking_tools: { id: number; name: string }[];
  steps?: { step_number: number; description: string; step_img?: string }[];
  // 백엔드 업데이트로 추가된 영양소 필드 (AI가 재료 기반으로 추정)
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  is_public?: boolean;
}

// ============================================================
// [기능] 인기 레시피 top3 조회 (좋아요 수 기준)
// [화면] HomeScreen — 인기 레시피 섹션
// [엔드포인트] GET /recipes/top3
// ============================================================
export const getTop3Recipes = async (): Promise<BackendRecipe[]> => {
  try {
    const response = await api.get<BackendRecipe[]>('/recipes/top3');
    return response.data;
  } catch {
    return [];
  }
};

export const getRecipes = async (params?: {
  search?: string;
  ingredients?: string;   // 쉼표구분 '닭가슴살,양파'
  excludeTools?: string;  // 쉼표구분 '오븐,그릴'
}): Promise<BackendRecipe[]> => {
  const response = await api.get<BackendRecipe[]>('/recipes', { params });
  return response.data;
};

// ============================================================
// [기능] 레시피 상세 조회 (steps 포함)
// [엔드포인트] GET /recipes/:id
// ============================================================
export const getRecipeById = async (id: number): Promise<BackendRecipe> => {
  const response = await api.get<BackendRecipe>(`/recipes/${id}`);
  return response.data;
};

// ============================================================
// [기능] 레시피 삭제 (본인 작성 레시피만)
// [엔드포인트] DELETE /recipes/:id/:userId
// ============================================================
export const deleteRecipe = async (recipeId: number, userId: string): Promise<void> => {
  await api.delete(`/recipes/${recipeId}/${userId}`);
};

// ============================================================
// [기능] 레시피 공개/비공개 토글
// [엔드포인트] PATCH /recipes/:id/public/:userId
// ============================================================
export const toggleRecipePublic = async (recipeId: number, userId: string): Promise<BackendRecipe> => {
  const response = await api.patch<BackendRecipe>(`/recipes/${recipeId}/public/${userId}`);
  return response.data;
};

// ============================================================
// [기능] 레시피 수정
// [엔드포인트] PUT /recipes/:id/:userId
// ============================================================
export const updateRecipe = async (
  recipeId: number,
  userId: string,
  dto: {
    title: string;
    content?: string;
    ingredients: string[];
    cooking_tools: string[];
    steps: { step_number: number; description: string }[];
  },
): Promise<BackendRecipe> => {
  const response = await api.put<BackendRecipe>(`/recipes/${recipeId}/${userId}`, dto);
  return response.data;
};

// ============================================================
// [기능] 내가 작성한 레시피 목록 조회
// [엔드포인트] GET /recipes/my/list/:userId
// ============================================================
export const getMyRecipes = async (userId: string): Promise<BackendRecipe[]> => {
  const response = await api.get<BackendRecipe[]>(`/recipes/my/list/${userId}`);
  return response.data;
};

// ============================================================
// [기능] 내가 좋아요한 레시피 목록 조회
// [엔드포인트] GET /recipes/my/liked/:userId
// ============================================================
export const getMyLikedRecipes = async (userId: string): Promise<BackendRecipe[]> => {
  const response = await api.get<BackendRecipe[]>(`/recipes/my/liked/${userId}`);
  return response.data;
};

// ============================================================
// [기능] 레시피 좋아요 / 취소 토글
// [화면] RecipeScreen — 하트 버튼 누를 때 호출됨
// [엔드포인트] POST /recipes/:id/like/:userId
// ============================================================
export interface ToggleLikeResponse {
  liked: boolean;
  likes_count: number;
}
export const toggleRecipeLike = async (recipeId: number, userId: string): Promise<ToggleLikeResponse> => {
  const response = await api.post<ToggleLikeResponse>(`/recipes/${recipeId}/like/${userId}`);
  return response.data;
};

// ============================================================
// [기능] 레시피 직접 등록
// [화면] RecipeScreen '나만의 레시피' — 직접 작성 or AI 수정 후 저장
// [엔드포인트] POST /recipes/:userId
// ============================================================
export const createRecipe = async (userId: string, dto: {
  title: string;
  content?: string;
  thumbnail_img?: string;
  ingredients: string[] | { name: string; amount?: string }[];
  cooking_tools: string[];
  steps: { step_number: number; description: string }[];
}): Promise<BackendRecipe> => {
  const response = await api.post<BackendRecipe>(`/recipes/${userId}`, dto);
  return response.data;
};

// ── 유튜브 레시피 분석 응답 타입 ──
// 백엔드 recipes.service.ts createRecipeFromYoutube() 반환 구조 (Recipe 엔티티)
interface YoutubeRecipeResponse {
  success?: boolean;
  // 성공 시 백엔드가 저장된 Recipe 엔티티를 그대로 반환
  id?: number;
  title?: string;
  content?: string;
  video_url?: string;
  thumbnail_img?: string | null;
  steps?: { step_number: number; description: string; step_img?: string }[];
  ingredients?: { id: number; name: string }[];
  cooking_tools?: { id: number; name: string }[];
  // 백엔드 업데이트로 추가된 영양소 필드
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  is_public?: boolean;
  message?: string;
}

// ============================================================
// [기능] 유튜브 레시피 영상 URL → AI 레시피 분석 및 DB 저장
// [화면] RecipeScreen '나만의 레시피' 탭 — URL 입력 후 분석 버튼 누르면 호출됨
// [엔드포인트] POST /recipes/api/youtube/create
// [바디] { userId: string, videoUrl: string }
// ============================================================
export const analyzeYoutubeRecipe = async (userId: string, videoUrl: string): Promise<YoutubeRecipeResponse> => {
  try {
    const response = await api.post<YoutubeRecipeResponse>('/recipes/api/youtube/create', { userId, videoUrl });
    return { success: true, ...response.data };
  } catch (error: any) {
    const msg = error?.response?.data?.message ?? error?.message ?? 'UNKNOWN';
    console.error('[YouTube 분석 실패]', msg, error?.response?.status);
    return { success: false, message: msg };
  }
};

// ============================================================
// [기능] AI 맞춤 음식 추천
// [화면] HomeScreen — 'AI 맞춤 추천' 카드 누르면 호출됨
// [엔드포인트] GET /diet/recommend/:userId
// 오늘/주간 섭취량 분석 → Gemini 가중치 → DB 스코어링 → 음식 3개 추천
// ============================================================
export interface AiRecommendFood {
  dish_id: number;
  dish_name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface AiRecommendResponse {
  success: boolean;
  aiAnalysisReason: string;
  recommendedFoods: AiRecommendFood[];
}

export const getAiRecommend = async (userId: string): Promise<AiRecommendResponse> => {
  const response = await api.get<AiRecommendResponse>(`/diet/recommend/${userId}`);
  return response.data;
};

// [기능] 주간 식단 AI 리포트
// [화면] HomeScreen — '주간 식단 AI 리포트' 버튼 누르면 호출됨
// [엔드포인트] GET /diet/report/weekly/:userId
// ============================================================
export interface WeeklyReportResponse {
  success: boolean;
  report: string;
}

export const getWeeklyReport = async (userId: string): Promise<WeeklyReportResponse> => {
  const response = await api.get<WeeklyReportResponse>(`/diet/report/weekly/${userId}`);
  return response.data;
};

// ============================================================
// [기능] 홈 화면 대시보드 통합 조회
// [화면] AppContext 로그인/앱복원 시 호출 — 서버 저장 목표칼로리 동기화용
// [엔드포인트] GET /diet/dashboard/:userId
// 반환: currentUser 닉네임, dailyGoals(서버 계산값), todayLogs, weeklyCalories
// ============================================================
export interface DashboardDailyGoals {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface DashboardResponse {
  success: boolean;
  currentUser: { profile: { name: string } };
  dailyGoals: DashboardDailyGoals;
  todayLogs: any[];
  weeklyCalories: { day: string; calories: number }[];
  todayWater: number;
}

// ─────────────────────────────────────────────────────────────────────────
// getHomeDashboard: GET /diet/dashboard/:userId
// 서버에서 계산된 목표 칼로리/영양소(dailyGoals)를 가져옴
// - 로그인 직후, 앱 복원 시, 프로필 수정 후에 호출
// - AppContext의 currentUser.savedGoals에 저장 → dailyGoals useMemo에서 우선 사용
// ─────────────────────────────────────────────────────────────────────────
export const getHomeDashboard = async (userId: string): Promise<DashboardResponse> => {
  const response = await api.get<DashboardResponse>(`/diet/dashboard/${userId}`);
  return response.data;
};

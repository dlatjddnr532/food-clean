// ============================================================
// diet.ts — 식단 관련 백엔드 API 호출 모음
//
// 현재 상태: 백엔드 미연결 상태
// 백엔드 연결 시: 아래 각 함수들이 실제 서버와 통신하게 됩니다.
// API 기본 URL은 src/api/config.ts 에서 설정하세요.
// ============================================================

import api from './config';
import { MealType, NutritionInfo } from '../types';

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
  creator?: { id: number; nickname: string };
  ingredients: { id: number; name: string }[];
  cooking_tools: { id: number; name: string }[];
  steps?: { step_number: number; description: string; step_img?: string }[];
}

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
  message?: string;
}

// ============================================================
// [기능] 유튜브 레시피 영상 URL → AI 레시피 분석 및 DB 저장
// [화면] RecipeScreen '나만의 레시피' 탭 — URL 입력 후 분석 버튼 누르면 호출됨
// [엔드포인트] POST /recipes/api/youtube/create
// [바디] { userId: string, videoUrl: string }
// ============================================================
// ============================================================
// [기능] 음식 이름 검색 — dish_item 테이블에서 조회
// [화면] RecipeScreen '재료·음식' 탭 — 검색창 입력 시 호출
// [엔드포인트] GET /foods/search?query=닭가슴살
// ⚠️ 백엔드팀 할 일: FoodsController + GET /foods/search 엔드포인트 추가 필요
//    (dish_item 테이블에서 dish_name LIKE %query% 로 검색)
// ============================================================
export const searchFoods = async (query: string): Promise<ApiFoodInfo[]> => {
  if (!query.trim()) return [];
  try {
    const response = await api.get<ApiFoodInfo[]>('/diet/foods/search', { params: { query } });
    return response.data;
  } catch {
    return []; // 백엔드 미연결 시 빈 배열 반환
  }
};

export const analyzeYoutubeRecipe = async (userId: string, videoUrl: string): Promise<YoutubeRecipeResponse> => {
  try {
    const response = await api.post<YoutubeRecipeResponse>('/recipes/api/youtube/create', { userId, videoUrl });
    return { success: true, ...response.data };
  } catch {
    return { success: false, message: 'BACKEND_NOT_READY' };
  }
};

// ============================================================
// [기능] 오늘 식단 AI 평가
// [화면] HomeScreen — '오늘 식단 AI 평가받기' 버튼 누르면 호출 예정
// [엔드포인트] POST /ai/evaluate  ← 백엔드 구현 필요
// ============================================================
export const evaluateDiet = async (payload: {
  foods: string[];
  totals: { calories: number; carbs: number; protein: number; fat: number; fiber: number; sugar: number; sodium: number };
  goals: { calories: number; carbs: number; protein: number; fat: number; fiber: number; sugar: number; sodium: number };
}): Promise<{
  score: number;
  grade: string;
  summary: string;
  details: { emoji: string; text: string }[];
  advice: string;
}> => {
  const response = await api.post('/ai/evaluate', payload);
  return response.data;
};

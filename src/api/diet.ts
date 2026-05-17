// ============================================================
// diet.ts — 식단 관련 백엔드 API 호출 모음
//
// 현재 상태: 백엔드 미연결 상태
// 백엔드 연결 시: 아래 각 함수들이 실제 서버와 통신하게 됩니다.
// API 기본 URL은 src/api/config.ts 에서 설정하세요.
// ============================================================

import api from './config';
import { MealType, NutritionInfo, UserRecipe } from '../types';

// ── 음식 사진 AI 분석 응답 타입 ──
// 백엔드가 사진을 받아 AI로 음식을 인식한 뒤 돌려주는 데이터 형태
interface AnalyzeResponse {
  success: boolean;
  foodName: string;         // AI가 인식한 음식 이름
  candidates?: string[];    // 인식 후보군 (여러 개일 경우)
  nutrition?: NutritionInfo; // 해당 음식의 영양 정보
  message?: string;         // 오류 메시지
}

// ── 식사 기록 저장 요청 타입 ──
// 프론트에서 백엔드로 식단 기록을 저장할 때 보내는 데이터
// ⚠️ meal_type ENUM 불일치: DB는 BREAKFAST/LUNCH/DINNER/SNACK,
//    프론트는 '아침'/'점심'/'저녁'/'간식' → 백엔드에서 변환 필요
interface MealLogRequest {
  user_id: string;
  meal_type: MealType;
  food_img_url: string;
  total_nutrients: NutritionInfo;
}

// ── 식사 기록 조회 응답 타입 ──
// 백엔드에서 식단 기록 목록을 받을 때의 데이터 형태
interface MealLogResponse {
  id: number;
  user_id: string;
  meal_type: MealType;
  food_img_url: string;
  total_nutrients: NutritionInfo;
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
// [엔드포인트] POST /meal-log
// [백엔드 할 일] meal_log + meal_log_item 테이블에 INSERT
// ============================================================
export const saveMealLog = async (mealData: MealLogRequest): Promise<MealLogResponse> => {
  const response = await api.post<MealLogResponse>('/meal-log', mealData);
  return response.data;
};

// ============================================================
// [기능] 내 식단 기록 조회
// [화면] HomeScreen, CalendarScreen — 오늘/특정 날짜 식단 불러올 때 사용
// [엔드포인트] GET /meal-log/:userId
// [백엔드 할 일] user_id + log_date 기준으로 meal_log + meal_log_item JOIN 후 반환
// ============================================================
export const getMealLogs = async (userId: string): Promise<MealLogResponse[]> => {
  const response = await api.get<MealLogResponse[]>(`/meal-log/${userId}`);
  return response.data;
};

// ── 유튜브 레시피 분석 응답 타입 ──
// 유튜브 URL을 넘기면 AI가 영상을 보고 레시피를 추출해서 돌려주는 형태
interface YoutubeRecipeResponse {
  success: boolean;
  recipe?: {
    title: string;
    emoji: string;
    category: string;
    cookTime: number;
    servings: number;
    ingredients: { name: string; amount: string }[];
    steps: string[];
    totalNutrition: {
      calories: number; carbs: number; protein: number; fat: number;
      fiber?: number; sugar?: number; sodium?: number;
    };
  };
  message?: string;
}

// ============================================================
// [기능] 유튜브 레시피 영상 URL → AI 레시피 분석
// [화면] RecipeScreen '나만의 레시피' 탭 — URL 입력 후 분석 버튼 누르면 호출됨
// [엔드포인트] POST /recipe/youtube
// [백엔드 할 일] 유튜브 자막/정보 크롤링 후 Gemini AI로 재료·조리법·영양소 추출
// ⚠️ 현재 백엔드 미구현 상태 — 연결 전까지 더미 데이터로 동작함
// ============================================================
export const analyzeYoutubeRecipe = async (url: string): Promise<YoutubeRecipeResponse> => {
  try {
    const response = await api.post<YoutubeRecipeResponse>('/recipe/youtube', { url });
    return response.data;
  } catch {
    // 백엔드 미연결 시 더미 응답 반환 (연결 후 이 catch 블록 제거 가능)
    return { success: false, message: 'BACKEND_NOT_READY' };
  }
};

// ============================================================
// [기능] 오늘 식단 AI 평가
// [화면] HomeScreen — '오늘 식단 AI 평가받기' 버튼 누르면 호출 예정
// [엔드포인트] POST /ai/evaluate  ← 백엔드 구현 필요
// [백엔드 할 일] 오늘 먹은 음식 목록 + 영양소 합계를 받아 Gemini로 평가 텍스트 생성
// 요청 데이터 예시:
//   { foods: ['김밥', '닭가슴살'], totals: { calories: 1200, protein: 60, ... }, goals: { calories: 2000, ... } }
// 응답 데이터 예시:
//   { score: 82, grade: 'A', summary: '전반적으로 균형 잡힌 식단이에요!', details: [...], advice: '...' }
//
// ⚠️ 현재 미구현 — HomeScreen.tsx의 generateEvaluation() 함수가 임시로 규칙 기반 평가 중
//    백엔드 연결 시 generateEvaluation() 대신 이 API 호출로 교체하면 됩니다.
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

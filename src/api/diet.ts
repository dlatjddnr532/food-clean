import api from './config';
import { MealType, NutritionInfo } from '../types';

// AI 분석 응답 타입 (백엔드 diet.controller.ts 기반)
interface AnalyzeResponse {
  success: boolean;
  foodName: string;
  candidates?: string[];
  nutrition?: NutritionInfo;
  message?: string;
}

// 식사 기록 저장 요청 타입 (백엔드 meal-log.entity.ts 기반)
interface MealLogRequest {
  user_id: string;
  meal_type: MealType;
  food_img_url: string;
  total_nutrients: NutritionInfo;
}

// 식사 기록 조회 응답 타입
interface MealLogResponse {
  id: number;
  user_id: string;
  meal_type: MealType;
  food_img_url: string;
  total_nutrients: NutritionInfo;
}

// 음식 사진 업로드 → AI가 음식명 인식
// POST /diet/upload
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

// 식사 기록 저장
export const saveMealLog = async (mealData: MealLogRequest): Promise<MealLogResponse> => {
  const response = await api.post<MealLogResponse>('/meal-log', mealData);
  return response.data;
};

// 내 식사 기록 조회
export const getMealLogs = async (userId: string): Promise<MealLogResponse[]> => {
  const response = await api.get<MealLogResponse[]>(`/meal-log/${userId}`);
  return response.data;
};

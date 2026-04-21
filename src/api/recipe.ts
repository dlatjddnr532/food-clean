import api from './config';
import { NutritionInfo } from '../types';

// 레시피 응답 타입 (백엔드 recipe.entity.ts 기반)
interface RecipeResponse {
  id: number;
  title: string;
  content: string;
  thumbnail_img: string | null;
  likes_count: number;
  ingredients: IngredientItem[];
  cooking_tools: CookingToolItem[];
}

interface IngredientItem {
  id: number;
  name: string;
  nutrition?: NutritionInfo;
}

interface CookingToolItem {
  id: number;
  name: string;
}

// 레시피 목록 조회
export const getRecipes = async (): Promise<RecipeResponse[]> => {
  const response = await api.get<RecipeResponse[]>('/recipes');
  return response.data;
};

// 레시피 상세 조회
export const getRecipeDetail = async (id: number): Promise<RecipeResponse> => {
  const response = await api.get<RecipeResponse>(`/recipes/${id}`);
  return response.data;
};

// 레시피 좋아요
export const likeRecipe = async (recipeId: number, userId: string): Promise<void> => {
  const response = await api.post(`/recipes/${recipeId}/like`, { userId });
  return response.data;
};

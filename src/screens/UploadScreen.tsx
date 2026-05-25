import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Alert, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { MealType, AiAnalysisResult, NutritionInfo, Food } from '../types';
import { uploadFoodImage, saveMealLog } from '../api/diet';

type TabParamList = {
  Home: undefined;
  Upload: { mealType?: MealType };
  Recipe: undefined;
  Profile: undefined;
};

type Props = {
  navigation: BottomTabNavigationProp<TabParamList, 'Upload'>;
  route: RouteProp<TabParamList, 'Upload'>;
};

const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];

// 백엔드 ApiFoodInfo 구조 (diet.ts와 동일)
interface ApiFoodInfo {
  id: number; name: string; servingSize: number;
  calories: number; carbs: number; protein: number; fat: number;
  sugar: number; fiber: number; sodium: number;
}

async function realAiAnalyze(imageUri: string): Promise<AiAnalysisResult & { fromApi: boolean; apiCandidates?: ApiFoodInfo[] }> {
  const res = await uploadFoodImage(imageUri);
  if (!res.success) {
    throw new Error(res.message ?? '음식 사진이 아닙니다.');
  }

  // ApiFoodInfo → Food 타입 변환 헬퍼
  const apiToFood = (f: NonNullable<typeof res.matchedFoodInfo>): Food => ({
    id: f.id,
    name: f.name,
    emoji: '🍽️',
    category: '기타',
    per: `${f.servingSize}g`,
    nutrition: {
      calories: f.calories,
      carbs: f.carbs,
      protein: f.protein,
      fat: f.fat,
      fiber: f.fiber,
      sugar: f.sugar,
      sodium: f.sodium,
    },
  });

  if (res.matchedFoodInfo) {
    // DB에서 정확히 매칭된 음식
    return {
      aiResult: { name: res.foodName, confidence: 90, foodId: res.matchedFoodInfo.id },
      food: apiToFood(res.matchedFoodInfo),
      fromApi: true,
      apiCandidates: res.candidates,
    };
  }

  // 매칭 실패 → 이름만으로 빈 Food 생성
  return {
    aiResult: { name: res.foodName, confidence: 70, foodId: -1 },
    food: {
      id: -1, name: res.foodName, emoji: '🍽️', category: '기타',
      nutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 },
      per: '1인분',
    },
    fromApi: true,
    apiCandidates: res.candidates,
  };
}

// 영양소 배지
interface NutriBadgeProps {
  label: string;
  value: number | undefined;
  unit: string;
  color: string;
}

function NutriBadge({ label, value, unit, color }: NutriBadgeProps) {
  return (
    <View style={[nutriStyles.badge, { borderColor: color }]}>
      <Text style={[nutriStyles.value, { color }]}>{value ?? '-'}</Text>
      <Text style={nutriStyles.unit}>{unit}</Text>
      <Text style={nutriStyles.label}>{label}</Text>
    </View>
  );
}

const nutriStyles = StyleSheet.create({
  badge: {
    alignItems: 'center', borderWidth: 1.5,
    borderRadius: borderRadius.md, padding: spacing.sm,
    flex: 1,
  },
  value: { fontSize: 18, fontWeight: '800' },
  unit: { fontSize: 10, color: colors.textLight },
  label: { fontSize: 11, color: colors.text, fontWeight: '600', marginTop: 2 },
});

export default function UploadScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const { addMealLog, currentUser } = useApp();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectedFood, setDetectedFood] = useState<(AiAnalysisResult & { fromApi?: boolean }) | null>(null);
  const [candidates, setCandidates] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(
    route?.params?.mealType ?? '점심',
  );
  const [saved, setSaved] = useState(false);
  const [quantity, setQuantity] = useState(100);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualFiber, setManualFiber] = useState('');
  const [manualSugar, setManualSugar] = useState('');
  const [manualSodium, setManualSodium] = useState('');

  const pickFromGallery = async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setSaved(false);
      setDetectedFood(null);
      setImage(uri);
      analyze(uri);
    }
  };

  const pickFromCamera = async (): Promise<void> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setSaved(false);
      setDetectedFood(null);
      setImage(uri);
      analyze(uri);
    }
  };


  const analyze = async (imageUri: string): Promise<void> => {
    setLoading(true);
    try {
      const result = await realAiAnalyze(imageUri);
      setDetectedFood(result);
      setSelectedFood(result.food);
      // API가 candidates 줬으면 ApiFoodInfo 객체를 Food 타입으로 변환, 없으면 로컬 로직
      if (result.apiCandidates && result.apiCandidates.length > 0) {
        const matched: Food[] = result.apiCandidates
          .filter((c) => c.id !== result.food.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            emoji: '🍽️',
            category: '기타',
            per: `${c.servingSize}g`,
            nutrition: {
              calories: c.calories, carbs: c.carbs, protein: c.protein,
              fat: c.fat, fiber: c.fiber, sugar: c.sugar, sodium: c.sodium,
            },
          }));
        setCandidates(matched.slice(0, 4));
      } else {
        setCandidates([]); // 후보 없음 — API candidates도 없는 경우
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '분석에 실패했어요.';
      setImage(null);
      Alert.alert('음식 사진이 아니에요 🙅', message + '\n\n음식 사진을 다시 찍어주세요!');
    } finally {
      setLoading(false);
    }
  };

  const [editNutriVisible, setEditNutriVisible] = useState(false);
  const [editCalories, setEditCalories] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editFiber, setEditFiber] = useState('');
  const [editSugar, setEditSugar] = useState('');
  const [editSodium, setEditSodium] = useState('');

  const openEditNutri = (): void => {
    const cn = computedN;
    setEditCalories(String(cn?.calories ?? 0));
    setEditCarbs(String(cn?.carbs ?? 0));
    setEditProtein(String(cn?.protein ?? 0));
    setEditFat(String(cn?.fat ?? 0));
    setEditFiber(String(cn?.fiber ?? 0));
    setEditSugar(String(cn?.sugar ?? 0));
    setEditSodium(String(cn?.sodium ?? 0));
    setEditNutriVisible(true);
  };

  const handleSave = async (customNutrition?: NutritionInfo): Promise<void> => {
    if (!detectedFood) return;
    const baseFood = selectedFood ?? detectedFood.food;
    const nutritionToUse = customNutrition ?? computedN ?? baseFood.nutrition;
    const foodToAdd: Food = { ...baseFood, nutrition: nutritionToUse };

    // 1. 로컬 상태 업데이트 (홈 화면 즉시 반영)
    addMealLog(selectedMeal, foodToAdd);
    setSaved(true);
    setEditNutriVisible(false);
    Alert.alert('저장 완료! 🎉', `${selectedMeal}에 "${foodToAdd.name}"이(가) 추가됐어요!`);

    // 2. 서버에 식단 기록 저장 (백그라운드, 실패해도 로컬 저장은 유지)
    if (currentUser) {
      const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
      saveMealLog(String(currentUser.id), {
        mealType: selectedMeal,
        foodName: foodToAdd.name,
        quantity: quantity,
        calories: nutritionToUse?.calories ?? 0,
        carbs: nutritionToUse?.carbs ?? 0,
        protein: nutritionToUse?.protein ?? 0,
        fat: nutritionToUse?.fat ?? 0,
        fiber: nutritionToUse?.fiber,
        sugar: nutritionToUse?.sugar,
        sodium: nutritionToUse?.sodium,
        eatDate: today,
      }).catch(() => {
        // 서버 저장 실패 시 조용히 무시 (로컬에는 이미 저장됨)
      });
    }
  };

  const food = selectedFood ?? detectedFood?.food;
  const n: NutritionInfo | undefined = food?.nutrition;

  // 100g 기준 영양소 × 수량 배율
  const scale = quantity / 100;
  const computedN: NutritionInfo | undefined = n ? {
    calories: Math.round((n.calories ?? 0) * scale),
    carbs: parseFloat(((n.carbs ?? 0) * scale).toFixed(1)),
    protein: parseFloat(((n.protein ?? 0) * scale).toFixed(1)),
    fat: parseFloat(((n.fat ?? 0) * scale).toFixed(1)),
    fiber: parseFloat(((n.fiber ?? 0) * scale).toFixed(1)),
    sugar: parseFloat(((n.sugar ?? 0) * scale).toFixed(1)),
    sodium: Math.round((n.sodium ?? 0) * scale),
  } : undefined;

  const handleReset = (): void => {
    setImage(null);
    setDetectedFood(null);
    setSelectedFood(null);
    setCandidates([]);
    setSaved(false);
    setQuantity(100);
  };

  const handleManualSave = (): void => {
    if (!manualName.trim() || !manualCalories.trim()) {
      Alert.alert('입력 오류', '음식 이름과 칼로리는 필수예요.');
      return;
    }
    const food: Food = {
      id: Date.now(),
      name: manualName.trim(),
      emoji: '🍽️',
      category: '직접 입력',
      per: '1인분',
      nutrition: {
        calories: parseFloat(manualCalories) || 0,
        carbs: parseFloat(manualCarbs) || 0,
        protein: parseFloat(manualProtein) || 0,
        fat: parseFloat(manualFat) || 0,
        fiber: parseFloat(manualFiber) || 0,
        sugar: parseFloat(manualSugar) || 0,
        sodium: parseFloat(manualSodium) || 0,
      },
    };
    addMealLog(selectedMeal, food);
    Alert.alert('추가 완료! 🎉', `${selectedMeal}에 "${food.name}"이(가) 추가됐어요!`);

    // 서버에 식단 기록 저장 (백그라운드)
    if (currentUser) {
      const today = new Date().toISOString().split('T')[0];
      saveMealLog(String(currentUser.id), {
        mealType: selectedMeal,
        foodName: food.name,
        quantity: 100,
        calories: food.nutrition.calories ?? 0,
        carbs: food.nutrition.carbs ?? 0,
        protein: food.nutrition.protein ?? 0,
        fat: food.nutrition.fat ?? 0,
        fiber: food.nutrition.fiber,
        sugar: food.nutrition.sugar,
        sodium: food.nutrition.sodium,
        eatDate: today,
      }).catch(() => {});
    }

    setManualName('');
    setManualCalories('');
    setManualCarbs('');
    setManualProtein('');
    setManualFat('');
    setManualFiber('');
    setManualSugar('');
    setManualSodium('');
    setManualVisible(false);
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      extraScrollHeight={20}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.titleRow, { marginTop: insets.top }]}>
        <View>
          <Text style={styles.title}>AI 식단 분석</Text>
          <Text style={styles.subtitle}>사진을 찍으면 AI가 음식을 인식하고 영양소를 불러옵니다.</Text>
        </View>
        {(image || detectedFood) && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>↺</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionLabel}>식사 시간</Text>
      <View style={styles.mealTypeRow}>
        {MEAL_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.mealTypeBtn, selectedMeal === type && styles.mealTypeBtnActive]}
            onPress={() => { setSelectedMeal(type); setSaved(false); }}
          >
            <Text style={[styles.mealTypeBtnText, selectedMeal === type && styles.mealTypeBtnTextActive]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.imageBox}>
        {image
          ? <Image source={{ uri: image }} style={styles.image} />
          : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderEmoji}>🍽️</Text>
              <Text style={styles.placeholderText}>사진을 찍거나{'\n'}갤러리에서 선택하세요</Text>
            </View>
          )}
        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>🤖 AI가 분석 중이에요...</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cameraBtn} onPress={pickFromCamera}>
          <Text style={styles.btnEmoji}>📷</Text>
          <Text style={styles.cameraBtnText}>카메라</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <Text style={styles.btnEmoji}>🖼️</Text>
          <Text style={styles.galleryBtnText}>갤러리</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.manualBtn} onPress={() => setManualVisible(true)}>
        <Text style={styles.manualBtnText}>✏️ 직접 입력하기</Text>
      </TouchableOpacity>

      <Modal visible={manualVisible} transparent animationType="slide" onRequestClose={() => setManualVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={mStyles.backdrop} activeOpacity={1} onPress={() => setManualVisible(false)} />
          <View style={mStyles.sheet}>
            <Text style={mStyles.title}>음식 직접 입력</Text>

            <Text style={mStyles.label}>음식 이름 *</Text>
            <TextInput
              style={mStyles.input}
              placeholder="예: 닭볶음탕"
              placeholderTextColor={colors.textLight}
              value={manualName}
              onChangeText={setManualName}
            />

            <Text style={mStyles.label}>칼로리 (kcal) *</Text>
            <TextInput
              style={mStyles.input}
              placeholder="예: 450"
              placeholderTextColor={colors.textLight}
              value={manualCalories}
              onChangeText={setManualCalories}
              keyboardType="numeric"
            />

            <Text style={mStyles.sectionLabel}>영양소 (선택)</Text>
            <View style={mStyles.nutriRow}>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.label}>탄수화물 (g)</Text>
                <TextInput style={mStyles.input} placeholder="0" placeholderTextColor={colors.textLight}
                  value={manualCarbs} onChangeText={setManualCarbs} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.label}>단백질 (g)</Text>
                <TextInput style={mStyles.input} placeholder="0" placeholderTextColor={colors.textLight}
                  value={manualProtein} onChangeText={setManualProtein} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.label}>지방 (g)</Text>
                <TextInput style={mStyles.input} placeholder="0" placeholderTextColor={colors.textLight}
                  value={manualFat} onChangeText={setManualFat} keyboardType="numeric" />
              </View>
            </View>
            <View style={mStyles.nutriRow}>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.label}>식이섬유 (g)</Text>
                <TextInput style={mStyles.input} placeholder="0" placeholderTextColor={colors.textLight}
                  value={manualFiber} onChangeText={setManualFiber} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.label}>당류 (g)</Text>
                <TextInput style={mStyles.input} placeholder="0" placeholderTextColor={colors.textLight}
                  value={manualSugar} onChangeText={setManualSugar} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={mStyles.label}>나트륨 (mg)</Text>
                <TextInput style={mStyles.input} placeholder="0" placeholderTextColor={colors.textLight}
                  value={manualSodium} onChangeText={setManualSodium} keyboardType="numeric" />
              </View>
            </View>

            <TouchableOpacity style={mStyles.addBtn} onPress={handleManualSave}>
              <Text style={mStyles.addBtnText}>{selectedMeal}에 추가하기 →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={() => setManualVisible(false)}>
              <Text style={mStyles.cancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {detectedFood && !loading && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultEmoji}>{food?.emoji ?? '🍽️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiLabel}>
                {detectedFood.fromApi ? '🌐 AI 분석 결과' : '🎲 AI 분석 결과 (오프라인)'} ({detectedFood.aiResult.confidence}% 확신)
              </Text>
              <Text style={styles.foodName}>{food?.name}</Text>
              <Text style={styles.perText}>{quantity}g 기준</Text>
            </View>
          </View>

          {candidates.length > 0 && (
            <View style={styles.candidatesBox}>
              <Text style={styles.candidatesTitle}>🤔 혹시 이 메뉴인가요?</Text>
              <View style={styles.candidatesRow}>
                {candidates.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.candidateBtn,
                      selectedFood?.id === c.id && styles.candidateBtnActive,
                    ]}
                    onPress={() => { setSelectedFood(c); setSaved(false); setQuantity(100); }}
                  >
                    <Text style={styles.candidateEmoji}>{c.emoji}</Text>
                    <Text
                      style={[
                        styles.candidateName,
                        selectedFood?.id === c.id && styles.candidateNameActive,
                      ]}
                      numberOfLines={2}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 수량 조절 */}
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>섭취량</Text>
            <View style={styles.quantityCtrl}>
              <TouchableOpacity
                style={styles.qBtn}
                onPress={() => setQuantity(q => Math.max(100, q - 100))}
              >
                <Text style={styles.qBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qVal}>{quantity}g</Text>
              <TouchableOpacity
                style={styles.qBtn}
                onPress={() => setQuantity(q => q + 100)}
              >
                <Text style={styles.qBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.calorieRow}>
            <Text style={styles.calorieEmoji}>🔥</Text>
            <Text style={styles.calorieText}>{computedN?.calories} kcal</Text>
          </View>

          <View style={styles.nutriRow}>
            <NutriBadge label="탄수화물" value={computedN?.carbs} unit="g" color="#F6A623" />
            <NutriBadge label="단백질" value={computedN?.protein} unit="g" color="#2ECC71" />
            <NutriBadge label="지방" value={computedN?.fat} unit="g" color="#9B59B6" />
            <NutriBadge label="식이섬유" value={computedN?.fiber} unit="g" color="#1ABC9C" />
          </View>

          {saved ? (
            <View style={styles.savedBanner}>
              <Text style={styles.savedText}>✅ {selectedMeal}에 추가됐어요!</Text>
            </View>
          ) : food?.id === -1 ? (
            <View style={styles.notFoundBanner}>
              <Text style={styles.notFoundText}>😅 레시피에 없는 음식이에요</Text>
              <Text style={styles.notFoundSub}>아직 등록되지 않은 음식입니다</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave()}>
                <Text style={styles.saveBtnText}>{selectedMeal}에 추가하기 →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editNutriBtn} onPress={openEditNutri}>
                <Text style={styles.editNutriBtnText}>✏️ 영양정보 수정 후 추가</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Modal visible={editNutriVisible} transparent animationType="slide" onRequestClose={() => setEditNutriVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={eStyles.backdrop} activeOpacity={1} onPress={() => setEditNutriVisible(false)} />
          <View style={eStyles.sheet}>
            <Text style={eStyles.title}>영양정보 수정</Text>
            <Text style={eStyles.label}>칼로리 (kcal)</Text>
            <TextInput style={eStyles.input} value={editCalories} onChangeText={setEditCalories} keyboardType="numeric" placeholderTextColor={colors.textLight} />
            <View style={eStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={eStyles.label}>탄수화물 (g)</Text>
                <TextInput style={eStyles.input} value={editCarbs} onChangeText={setEditCarbs} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={eStyles.label}>단백질 (g)</Text>
                <TextInput style={eStyles.input} value={editProtein} onChangeText={setEditProtein} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={eStyles.label}>지방 (g)</Text>
                <TextInput style={eStyles.input} value={editFat} onChangeText={setEditFat} keyboardType="numeric" />
              </View>
            </View>
            <View style={eStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={eStyles.label}>식이섬유 (g)</Text>
                <TextInput style={eStyles.input} value={editFiber} onChangeText={setEditFiber} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={eStyles.label}>당류 (g)</Text>
                <TextInput style={eStyles.input} value={editSugar} onChangeText={setEditSugar} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={eStyles.label}>나트륨 (mg)</Text>
                <TextInput style={eStyles.input} value={editSodium} onChangeText={setEditSodium} keyboardType="numeric" />
              </View>
            </View>
            <TouchableOpacity style={eStyles.addBtn} onPress={() => handleSave({
              calories: parseFloat(editCalories) || 0,
              carbs: parseFloat(editCarbs) || 0,
              protein: parseFloat(editProtein) || 0,
              fat: parseFloat(editFat) || 0,
              fiber: parseFloat(editFiber) || 0,
              sugar: parseFloat(editSugar) || 0,
              sodium: parseFloat(editSodium) || 0,
            })}>
              <Text style={eStyles.addBtnText}>{selectedMeal}에 추가하기 →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={eStyles.cancelBtn} onPress={() => setEditNutriVisible(false)}>
              <Text style={eStyles.cancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={{ height: 40 }} />
    </KeyboardAwareScrollView>
  );
}

// ── 직접 입력 모달 스타일 ──
const mStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white, borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg, padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.textLight, marginBottom: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.sm,
    padding: spacing.sm, fontSize: 14, color: colors.text, marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  nutriRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 0 },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', padding: spacing.sm, marginTop: spacing.xs },
  cancelText: { fontSize: 14, color: colors.textLight },
});

// ── 영양정보 수정 모달 스타일 ──
const eStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white, borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg, padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.textLight, marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.sm,
    padding: spacing.sm, fontSize: 14, color: colors.text, marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', padding: spacing.sm, marginTop: spacing.xs },
  cancelText: { fontSize: 14, color: colors.textLight },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  titleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.lg,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing.xl },
  subtitle: { fontSize: 13, color: colors.textLight, marginTop: 4 },
  resetBtn: {
    marginTop: spacing.xl, width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center',
    ...shadow.small, borderWidth: 1.5, borderColor: colors.border,
  },
  resetBtnText: { fontSize: 22, color: colors.text },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  mealTypeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  mealTypeBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  mealTypeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  mealTypeBtnText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  mealTypeBtnTextActive: { color: '#fff' },
  imageBox: {
    height: 260, borderRadius: borderRadius.lg, overflow: 'hidden',
    backgroundColor: colors.white, ...shadow.small,
    marginBottom: spacing.md, position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  placeholderEmoji: { fontSize: 52 },
  placeholderText: { fontSize: 14, color: colors.textLight, textAlign: 'center', lineHeight: 22 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', alignItems: 'center', gap: spacing.sm,
  },
  overlayText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  cameraBtn: {
    flex: 1, backgroundColor: colors.text, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', gap: 4,
  },
  galleryBtn: {
    flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: colors.border,
  },
  btnEmoji: { fontSize: 24 },
  cameraBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  galleryBtnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  resultCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadow.small,
  },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md,
  },
  resultEmoji: { fontSize: 48 },
  aiLabel: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  foodName: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  perText: { fontSize: 12, color: colors.textLight },
  calorieRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.md, backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.sm, padding: spacing.sm,
  },
  calorieEmoji: { fontSize: 20 },
  calorieText: { fontSize: 20, fontWeight: '800', color: '#E67E22' },
  nutriRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  savedBanner: {
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  savedText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  notFoundBanner: {
    backgroundColor: '#FFF3E0', borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFB74D',
  },
  notFoundText: { fontSize: 14, color: '#E65100', fontWeight: '700' },
  quantityRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  quantityLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  quantityCtrl: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  qBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24 },
  qVal: { fontSize: 16, fontWeight: '800', color: colors.text, minWidth: 52, textAlign: 'center' },
  candidatesBox: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  candidatesTitle: { fontSize: 12, fontWeight: '700', color: colors.textLight, marginBottom: spacing.sm },
  candidatesRow: { flexDirection: 'row', gap: spacing.sm },
  candidateBtn: {
    flex: 1, alignItems: 'center', backgroundColor: colors.white,
    borderRadius: borderRadius.md, padding: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border,
  },
  candidateBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  candidateEmoji: { fontSize: 24, marginBottom: 4 },
  candidateName: { fontSize: 11, color: colors.textLight, textAlign: 'center', fontWeight: '600' },
  candidateNameActive: { color: colors.primary },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: borderRadius.md, padding: spacing.md,
    borderWidth: 1.5, borderColor: colors.border, gap: spacing.xs,
  },
  manualBtnText: { fontSize: 14, color: colors.textLight, fontWeight: '600' },
  notFoundSub: { fontSize: 12, color: '#E65100', marginTop: 4 },
  editNutriBtn: {
    borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.primary,
  },
  editNutriBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});

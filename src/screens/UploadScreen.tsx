import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { AI_FOOD_RESULTS, DUMMY_FOODS } from '../data/dummyData';
import { MealType, AiAnalysisResult, NutritionInfo } from '../types';
import { uploadFoodImage } from '../api/diet';

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

// 더미 AI 분석 (폴백용)
function fakeAiAnalyze(): Promise<AiAnalysisResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const picked = AI_FOOD_RESULTS[Math.floor(Math.random() * AI_FOOD_RESULTS.length)];
      const food = DUMMY_FOODS.find((f) => f.id === picked.foodId) ?? DUMMY_FOODS[0];
      resolve({ aiResult: picked, food });
    }, 1800);
  });
}

// AI 반환 음식명으로 DUMMY_FOODS에서 매칭
function matchFoodByName(name: string) {
  const q = name.toLowerCase().trim();
  // 정확히 포함되는 것 먼저
  return (
    DUMMY_FOODS.find((f) => f.name.toLowerCase().includes(q)) ??
    DUMMY_FOODS.find((f) => q.includes(f.name.toLowerCase()))
  );
}

// 실제 API 호출 → 실패하면 더미로 폴백
async function realAiAnalyze(imageUri: string): Promise<AiAnalysisResult & { fromApi: boolean }> {
  try {
    const res = await uploadFoodImage(imageUri);
    if (!res.success) {
      throw new Error(res.message ?? '음식 사진이 아닙니다.');
    }
    if (res.success && res.foodName) {
      const matched = matchFoodByName(res.foodName);
      if (matched) {
        return {
          aiResult: { name: res.foodName, confidence: 90, foodId: matched.id },
          food: matched,
          fromApi: true,
        };
      }
      // 이름은 받았지만 DB에 없는 음식 → 기본 정보로 표시
      return {
        aiResult: { name: res.foodName, confidence: 85, foodId: -1 },
        food: {
          id: -1, name: res.foodName, emoji: '🍽️', category: '기타',
          nutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 },
          per: '1인분',
        },
        fromApi: true,
      };
    }
    throw new Error('API 분석 실패');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // 음식이 아닌 경우 → 에러 던지기 (폴백 안 함)
    if (message.includes('음식')) {
      throw error;
    }
    // 서버 연결 안 됨 → 더미로 폴백
    const dummy = await fakeAiAnalyze();
    return { ...dummy, fromApi: false };
  }
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
  const { addMealLog } = useApp();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectedFood, setDetectedFood] = useState<(AiAnalysisResult & { fromApi?: boolean }) | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(
    route?.params?.mealType ?? '점심',
  );
  const [saved, setSaved] = useState(false);

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
    } catch (error) {
      const message = error instanceof Error ? error.message : '분석에 실패했어요.';
      setImage(null);
      Alert.alert('음식 사진이 아니에요 🙅', message + '\n\n음식 사진을 다시 찍어주세요!');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (): void => {
    if (!detectedFood) return;
    addMealLog(selectedMeal, detectedFood.food);
    setSaved(true);
    Alert.alert('저장 완료! 🎉', `${selectedMeal}에 "${detectedFood.food.name}"이(가) 추가됐어요!`);
  };

  const food = detectedFood?.food;
  const n: NutritionInfo | undefined = food?.nutrition;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>AI 식단 분석</Text>
      <Text style={styles.subtitle}>사진을 찍으면 AI가 음식을 인식하고 영양소를 불러옵니다.</Text>

      <Text style={styles.sectionLabel}>식사 시간</Text>
      <View style={styles.mealTypeRow}>
        {MEAL_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.mealTypeBtn, selectedMeal === type && styles.mealTypeBtnActive]}
            onPress={() => setSelectedMeal(type)}
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

      {detectedFood && !loading && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultEmoji}>{food?.emoji ?? '🍽️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiLabel}>
                {detectedFood.fromApi ? '🌐 AI 분석 결과' : '🎲 AI 분석 결과 (오프라인)'} ({detectedFood.aiResult.confidence}% 확신)
              </Text>
              <Text style={styles.foodName}>{food?.name}</Text>
              <Text style={styles.perText}>{food?.per}</Text>
            </View>
          </View>

          <View style={styles.calorieRow}>
            <Text style={styles.calorieEmoji}>🔥</Text>
            <Text style={styles.calorieText}>{n?.calories} kcal</Text>
          </View>

          <View style={styles.nutriRow}>
            <NutriBadge label="탄수화물" value={n?.carbs} unit="g" color="#F6A623" />
            <NutriBadge label="단백질" value={n?.protein} unit="g" color="#2ECC71" />
            <NutriBadge label="지방" value={n?.fat} unit="g" color="#9B59B6" />
            <NutriBadge label="식이섬유" value={n?.fiber} unit="g" color="#1ABC9C" />
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
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{selectedMeal}에 추가하기 →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing.xl },
  subtitle: { fontSize: 13, color: colors.textLight, marginTop: 4, marginBottom: spacing.lg },
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
    padding: spacing.md, alignItems: 'center', borderWidth: 1.5, borderColor: '#FFB74D',
  },
  notFoundText: { color: '#E65100', fontSize: 15, fontWeight: '800' },
  notFoundSub: { color: '#BF360C', fontSize: 12, marginTop: 4 },
});

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert,
} from 'react-native';
import CalendarScreen from './CalendarScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { MealType, MealLogEntry } from '../types';
import {
  getWeeklyReport, getAiRecommend,
  WeeklyReportResponse, AiRecommendResponse,
} from '../api/diet';

type TabParamList = {
  Home: undefined;
  Upload: { mealType?: MealType };
  Recipe: undefined;
  Profile: undefined;
};

type Props = {
  navigation: BottomTabNavigationProp<TabParamList, 'Home'>;
};

const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];
const MEAL_EMOJIS: Record<MealType, string> = {
  아침: '🌅', 점심: '☀️', 저녁: '🌙', 간식: '🍎',
};

// ── 영양소 게이지 ──
interface NutrientGaugeProps {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

function NutrientGauge({ label, current, goal, color, unit = 'g' }: NutrientGaugeProps) {
  const pct = Math.min(current / (goal || 1), 1);
  const over = current > goal;
  return (
    <View style={gaugeStyles.wrapper}>
      <View style={gaugeStyles.labelRow}>
        <Text style={gaugeStyles.label}>{label}</Text>
        <Text style={[gaugeStyles.values, over && { color: '#E74C3C' }]}>
          {current}
          <Text style={gaugeStyles.goal}>/{goal}{unit}</Text>
        </Text>
      </View>
      <View style={gaugeStyles.track}>
        <View
          style={[
            gaugeStyles.fill,
            { width: `${pct * 100}%` as `${number}%`, backgroundColor: over ? '#E74C3C' : color },
          ]}
        />
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  wrapper: { marginBottom: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '600', color: colors.text },
  values: { fontSize: 12, fontWeight: '700', color: colors.primary },
  goal: { fontWeight: '400', color: colors.textLight },
  track: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});

// ── 주간 칼로리 라인 차트 ──
function WeeklyGraph({ data, goal }: { data: { day: string; calories: number }[]; goal: number }) {
  const [chartW, setChartW] = useState(0);
  const CHART_H = 100;
  const TOP_PAD = 22;
  const BOTTOM_PAD = 22;
  const DOT_R = 5;
  const LINE_T = 2.5;
  const todayIdx = data.length - 1;
  const maxVal = Math.max(...data.map((d) => d.calories), goal, 1);

  const pts = chartW > 0
    ? data.map((d, i) => {
        const x = data.length < 2 ? chartW / 2 : (i / (data.length - 1)) * chartW;
        const y = TOP_PAD + (1 - d.calories / maxVal) * CHART_H;
        return { ...d, x, y, isToday: i === todayIdx, over: d.calories > goal };
      })
    : [];

  const goalY = TOP_PAD + (1 - Math.min(goal / maxVal, 1)) * CHART_H;

  return (
    <View style={{ marginTop: spacing.sm }} onLayout={(e) => setChartW(e.nativeEvent.layout.width)}>
      <View style={{ height: TOP_PAD + CHART_H + BOTTOM_PAD, position: 'relative' }}>
        {/* 목표 칼로리 기준선 */}
        {chartW > 0 && (
          <View style={{
            position: 'absolute', left: 0, right: 0, top: goalY,
            height: 1.5, backgroundColor: '#F6A623', opacity: 0.55,
          }} />
        )}

        {/* 꺾은선 */}
        {pts.slice(1).map((p, i) => {
          const prev = pts[i];
          const dx = p.x - prev.x;
          const dy = p.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View key={i} style={{
              position: 'absolute',
              left: (prev.x + p.x) / 2 - len / 2,
              top: (prev.y + p.y) / 2 - LINE_T / 2,
              width: len, height: LINE_T,
              backgroundColor: colors.primary,
              borderRadius: LINE_T / 2,
              transform: [{ rotate: `${angle}deg` }],
            }} />
          );
        })}

        {/* 데이터 포인트 */}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            {p.calories > 0 && (
              <Text style={{
                position: 'absolute',
                left: p.x - 20, top: p.y - 19,
                width: 40, textAlign: 'center',
                fontSize: 9,
                fontWeight: p.isToday ? '800' : '600',
                color: p.over ? '#E74C3C' : p.isToday ? colors.primary : colors.textLight,
              }}>
                {p.calories >= 1000 ? `${(p.calories / 1000).toFixed(1)}k` : p.calories}
              </Text>
            )}
            <View style={{
              position: 'absolute',
              left: p.x - DOT_R, top: p.y - DOT_R,
              width: DOT_R * 2, height: DOT_R * 2, borderRadius: DOT_R,
              backgroundColor: p.over ? '#E74C3C' : p.isToday ? colors.primary : colors.white,
              borderWidth: 2,
              borderColor: p.over ? '#E74C3C' : colors.primary,
            }} />
            <Text style={{
              position: 'absolute',
              left: p.x - 15, top: TOP_PAD + CHART_H + 6,
              width: 30, textAlign: 'center',
              fontSize: 11,
              fontWeight: p.isToday ? '800' : '600',
              color: p.isToday ? colors.primary : colors.textLight,
            }}>
              {p.day}
            </Text>
          </React.Fragment>
        ))}
      </View>
      <Text style={{ fontSize: 10, color: colors.textLight, textAlign: 'center', marginTop: 4 }}>
        {'── '}목표 {goal}kcal
      </Text>
    </View>
  );
}

// ── 물 섭취 트래커 ──
function WaterTracker({ current, onAdd, onReset }: { current: number; onAdd: (n: number) => void; onReset: () => void }) {
  const goal = 2000;
  const cups = Math.floor(current / 250);
  const totalCups = 8;
  const pct = Math.min(current / goal, 1);
  return (
    <View style={waterStyles.container}>
      <View style={waterStyles.headerRow}>
        <Text style={waterStyles.title}>💧 물 섭취량</Text>
        <TouchableOpacity onPress={onReset}>
          <Text style={waterStyles.reset}>초기화</Text>
        </TouchableOpacity>
      </View>
      <View style={waterStyles.cupsRow}>
        {Array.from({ length: totalCups }, (_, i) => (
          <Text key={i} style={{ fontSize: 22, opacity: i < cups ? 1 : 0.25 }}>🥤</Text>
        ))}
      </View>
      <View style={waterStyles.track}>
        <View style={[waterStyles.fill, { width: `${pct * 100}%` as `${number}%` }]} />
      </View>
      <View style={waterStyles.infoRow}>
        <Text style={waterStyles.amount}>{current}ml <Text style={waterStyles.goal}>/ {goal}ml</Text></Text>
        <TouchableOpacity style={waterStyles.addBtn} onPress={() => onAdd(250)}>
          <Text style={waterStyles.addBtnText}>+ 한 컵 (250ml)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const waterStyles = StyleSheet.create({
  container: { marginTop: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  reset: { fontSize: 12, color: colors.textLight },
  cupsRow: { flexDirection: 'row', gap: 4, marginBottom: spacing.sm },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.sm },
  fill: { height: '100%', backgroundColor: '#3498DB', borderRadius: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 14, fontWeight: '700', color: '#3498DB' },
  goal: { fontWeight: '400', color: colors.textLight },
  addBtn: { backgroundColor: '#EBF5FB', borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  addBtnText: { fontSize: 13, color: '#3498DB', fontWeight: '700' },
});

// ── AI 평가 생성 함수 ──
// ── 주간 AI 리포트 모달 ──
function WeeklyReportModal({ visible, onClose, report }: {
  visible: boolean;
  onClose: () => void;
  report: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={evalStyles.backdrop}>
        <View style={evalStyles.sheet}>
          <View style={evalStyles.handle} />
          <Text style={evalStyles.title}>🤖 AI 주간 식단 리포트</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <Text style={evalStyles.reportText}>{report}</Text>
          </ScrollView>
          <TouchableOpacity style={evalStyles.closeBtn} onPress={onClose}>
            <Text style={evalStyles.closeBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── AI 추천 모달 ──
function RecommendModal({ visible, onClose, data }: {
  visible: boolean;
  onClose: () => void;
  data: AiRecommendResponse | null;
}) {
  if (!data) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={evalStyles.backdrop}>
        <View style={evalStyles.sheet}>
          <View style={evalStyles.handle} />
          <Text style={evalStyles.title}>✨ AI 맞춤 음식 추천</Text>
          <View style={evalStyles.reasonBox}>
            <Text style={evalStyles.reasonText}>{data.aiAnalysisReason}</Text>
          </View>
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            {data.recommendedFoods.map((food, i) => (
              <View key={food.dish_id ?? i} style={evalStyles.foodCard}>
                <Text style={evalStyles.foodRank}>{['🥇', '🥈', '🥉'][i] ?? '🍽️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={evalStyles.foodName}>{food.dish_name}</Text>
                  <Text style={evalStyles.foodNutrient}>
                    {`🔥 ${food.calories}kcal · 탄${food.carbs}g · 단${food.protein}g · 지${food.fat}g`}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={evalStyles.closeBtn} onPress={onClose}>
            <Text style={evalStyles.closeBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const evalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  reportText: { fontSize: 14, color: colors.text, lineHeight: 22 },
  reasonBox: {
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  reasonText: { fontSize: 13, color: colors.text, lineHeight: 20 },
  foodCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  foodRank: { fontSize: 24, width: 32 },
  foodName: { fontSize: 14, fontWeight: '700', color: colors.text },
  foodNutrient: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  closeBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { currentUser, todayLogs, dailyGoals, removeMealLog, weeklyCalories, todayWater, addWater, resetWater } = useApp();
  const name = currentUser?.profile?.name ?? '사용자';
  const userId = String(currentUser?.id ?? '');

  const [calendarVisible, setCalendarVisible] = useState(false);

  // 주간 AI 리포트
  const [reportVisible, setReportVisible] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // AI 맞춤 추천
  const [recommendVisible, setRecommendVisible] = useState(false);
  const [recommendData, setRecommendData] = useState<AiRecommendResponse | null>(null);
  const [recommendLoading, setRecommendLoading] = useState(false);

  const handleWeeklyReport = useCallback(async () => {
    if (!userId) { Alert.alert('오류', '로그인이 필요해요.'); return; }
    setReportLoading(true);
    try {
      const res = await getWeeklyReport(userId);
      setReportText(res.report);
      setReportVisible(true);
    } catch {
      Alert.alert('오류', '리포트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setReportLoading(false);
    }
  }, [userId]);

  const handleRecommend = useCallback(async () => {
    if (!userId) { Alert.alert('오류', '로그인이 필요해요.'); return; }
    setRecommendLoading(true);
    try {
      const res = await getAiRecommend(userId);
      setRecommendData(res);
      setRecommendVisible(true);
    } catch {
      Alert.alert('오류', '추천 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setRecommendLoading(false);
    }
  }, [userId]);

  const totals = todayLogs.reduce(
    (acc, log) => {
      const n = log.food?.nutrition;
      return {
        calories: acc.calories + (n?.calories ?? 0),
        carbs: acc.carbs + (n?.carbs ?? 0),
        protein: acc.protein + (n?.protein ?? 0),
        fat: acc.fat + (n?.fat ?? 0),
        fiber: acc.fiber + (n?.fiber ?? 0),
        sugar: acc.sugar + (n?.sugar ?? 0),
        sodium: acc.sodium + (n?.sodium ?? 0),
      };
    },
    { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  );

  const calPct = Math.min(totals.calories / (dailyGoals.calories || 1), 1);
  const calOver = totals.calories > dailyGoals.calories;

  const logsByMeal = MEAL_TYPES.reduce<Record<MealType, MealLogEntry[]>>(
    (acc, type) => {
      acc[type] = todayLogs.filter((l) => l.mealType === type);
      return acc;
    },
    { 아침: [], 점심: [], 저녁: [], 간식: [] },
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: spacing.xl + insets.top }]}>
        <View>
          <Text style={styles.greeting}>안녕하세요, {name}님 👋</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('ko-KR', {
              month: 'long', day: 'numeric', weekday: 'short',
            })}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setCalendarVisible(true)}
          >
            <Text style={styles.headerIconEmoji}>📅</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileEmoji}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 달력 모달 */}
      <CalendarScreen visible={calendarVisible} onClose={() => setCalendarVisible(false)} />

      {/* 칼로리 카드 */}
      <View style={[styles.calorieCard, calOver && styles.calorieCardOver]}>
        <Text style={styles.calorieLabel}>오늘의 칼로리</Text>
        <View style={styles.calorieRow}>
          <Text style={styles.calorieValue}>{totals.calories}</Text>
          <Text style={styles.calorieGoal}> / {dailyGoals.calories} kcal</Text>
        </View>
        <View style={styles.calProgressTrack}>
          <View
            style={[
              styles.calProgressFill,
              {
                width: `${calPct * 100}%` as `${number}%`,
                backgroundColor: calOver ? '#FFB3B3' : 'rgba(255,255,255,0.9)',
              },
            ]}
          />
        </View>
        <Text style={styles.calHint}>
          {calOver
            ? `⚠️ 목표 칼로리 ${totals.calories - dailyGoals.calories}kcal 초과`
            : `✨ 목표까지 ${dailyGoals.calories - totals.calories}kcal 남았어요`}
        </Text>
      </View>

      {/* 주간 칼로리 그래프 카드 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📊 주간 칼로리</Text>
        <WeeklyGraph data={weeklyCalories} goal={dailyGoals.calories} />
      </View>

      {/* 물 섭취 카드 */}
      <View style={styles.card}>
        <WaterTracker current={todayWater} onAdd={addWater} onReset={resetWater} />
      </View>

      {/* 영양소 게이지 카드 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>영양소 섭취 현황</Text>
        <NutrientGauge label="탄수화물" current={totals.carbs} goal={dailyGoals.carbs} color="#F6A623" />
        <NutrientGauge label="단백질" current={totals.protein} goal={dailyGoals.protein} color="#2ECC71" />
        <NutrientGauge label="지방" current={totals.fat} goal={dailyGoals.fat} color="#F093FB" />
        <NutrientGauge label="식이섬유" current={totals.fiber} goal={dailyGoals.fiber} color="#1ABC9C" />
        <NutrientGauge label="당류" current={totals.sugar} goal={dailyGoals.sugar} color="#E74C3C" />
        <NutrientGauge label="나트륨" current={totals.sodium} goal={dailyGoals.sodium} color="#E67E22" unit="mg" />
        <Text style={styles.goalHint}>
          🎯 1일 권장량은 나이·키·몸무게·성별 기준으로 계산됩니다
        </Text>
      </View>

      {/* AI 맞춤 추천 카드 */}
      <TouchableOpacity
        style={styles.aiRecommendBtn}
        onPress={handleRecommend}
        disabled={recommendLoading}
      >
        <Text style={styles.aiEvalEmoji}>✨</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiEvalTitle}>AI 맞춤 음식 추천</Text>
          <Text style={styles.aiEvalSub}>오늘 영양 상태 기반으로 추천해드려요</Text>
        </View>
        {recommendLoading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.aiEvalArrow}>→</Text>}
      </TouchableOpacity>

      {/* AI 주간 리포트 버튼 */}
      <TouchableOpacity
        style={styles.aiEvalBtn}
        onPress={handleWeeklyReport}
        disabled={reportLoading}
      >
        <Text style={styles.aiEvalEmoji}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiEvalTitle}>주간 식단 AI 리포트</Text>
          <Text style={styles.aiEvalSub}>이번 주 식단을 AI 영양사가 분석해드려요</Text>
        </View>
        {reportLoading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.aiEvalArrow}>→</Text>}
      </TouchableOpacity>

      {/* 모달 */}
      <WeeklyReportModal visible={reportVisible} onClose={() => setReportVisible(false)} report={reportText} />
      <RecommendModal visible={recommendVisible} onClose={() => setRecommendVisible(false)} data={recommendData} />

      {/* 오늘의 식사 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘의 식사</Text>
        </View>

        {/* 식단 추가 버튼 */}
        <TouchableOpacity
          style={styles.bigAddBtn}
          onPress={() => navigation.navigate('Upload', {})}
        >
          <Text style={styles.bigAddBtnEmoji}>📷</Text>
          <Text style={styles.bigAddBtnText}>식단 추가하기</Text>
          <Text style={styles.bigAddBtnSub}>사진 찍거나 검색으로 추가</Text>
        </TouchableOpacity>

        {MEAL_TYPES.map((type) => {
          const logs = logsByMeal[type];
          const mealCal = logs.reduce((s, l) => s + (l.food?.nutrition?.calories ?? 0), 0);
          return (
            <View key={type} style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <View style={styles.mealHeaderLeft}>
                  <Text style={styles.mealEmoji}>{MEAL_EMOJIS[type]}</Text>
                  <Text style={styles.mealType}>{type}</Text>
                </View>
                {logs.length > 0 && (
                  <Text style={styles.mealTotalCal}>{mealCal} kcal</Text>
                )}
              </View>

              {logs.length === 0 ? (
                <View style={styles.emptyMeal}>
                  <Text style={styles.emptyMealText}>아직 기록이 없어요</Text>
                </View>
              ) : (
                logs.map((log) => (
                  <View key={log.id} style={styles.foodItem}>
                    <Text style={styles.foodEmoji}>{log.food?.emoji ?? '🍽️'}</Text>
                    <View style={styles.foodInfo}>
                      <Text style={styles.foodName}>{log.food?.name}</Text>
                      <Text style={styles.foodNutrient}>
                        {log.food?.nutrition?.calories}kcal · 탄{log.food?.nutrition?.carbs}g · 단{log.food?.nutrition?.protein}g · 지{log.food?.nutrition?.fat}g
                      </Text>
                      <Text style={styles.foodNutrient}>
                        섬유{log.food?.nutrition?.fiber ?? 0}g · 당{log.food?.nutrition?.sugar ?? 0}g · 나트륨{log.food?.nutrition?.sodium ?? 0}mg
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => removeMealLog(log.id)}
                    >
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          );
        })}
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md,
  },
  greeting: { fontSize: 20, fontWeight: '800', color: colors.text },
  date: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  headerIconEmoji: { fontSize: 20 },
  profileBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  profileEmoji: { fontSize: 20 },
  calorieCard: {
    margin: spacing.lg, marginTop: 0,
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadow.medium,
  },
  calorieCardOver: { backgroundColor: '#E74C3C' },
  calorieLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  calorieRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  calorieValue: { fontSize: 40, fontWeight: '800', color: '#fff' },
  calorieGoal: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  calProgressTrack: {
    height: 12, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6, marginTop: spacing.sm, overflow: 'hidden',
  },
  calProgressFill: { height: '100%', borderRadius: 6 },
  calHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  card: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadow.small,
  },
  goalHint: { fontSize: 11, color: colors.textLight, marginTop: spacing.sm, textAlign: 'center' },
  aiRecommendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: '#1e5c2e', borderRadius: borderRadius.lg,
    padding: spacing.md, ...shadow.small,
  },
  aiEvalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: '#1a1a2e', borderRadius: borderRadius.lg,
    padding: spacing.md, ...shadow.small,
  },
  aiEvalEmoji: { fontSize: 28 },
  aiEvalTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  aiEvalSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  aiEvalArrow: { fontSize: 18, color: 'rgba(255,255,255,0.5)' },
  section: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  bigAddBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.md,
    ...shadow.small,
  },
  bigAddBtnEmoji: { fontSize: 28, marginBottom: 4 },
  bigAddBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  bigAddBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  mealSection: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    marginBottom: spacing.sm, overflow: 'hidden', ...shadow.small,
  },
  mealHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  mealHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mealEmoji: { fontSize: 18 },
  mealType: { fontSize: 15, fontWeight: '700', color: colors.text },
  mealTotalCal: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  emptyMeal: { padding: spacing.md },
  emptyMealText: { fontSize: 13, color: colors.textLight, textAlign: 'center' },
  foodItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.background, gap: spacing.sm,
  },
  foodEmoji: { fontSize: 28, width: 36, textAlign: 'center' },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 14, fontWeight: '700', color: colors.text },
  foodNutrient: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center',
  },
  deleteBtnText: { fontSize: 12, color: '#E74C3C', fontWeight: '700' },
});


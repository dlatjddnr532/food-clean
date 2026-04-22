import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { MealType, MealLogEntry } from '../types';

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

// ── 주간 칼로리 그래프 ──
function WeeklyGraph({ data, goal }: { data: { day: string; calories: number }[]; goal: number }) {
  const maxCal = Math.max(...data.map((d) => d.calories), goal, 1);
  const todayIdx = data.length - 1;
  return (
    <View style={wStyles.container}>
      <View style={wStyles.bars}>
        {data.map((d, i) => {
          const isToday = i === todayIdx;
          const pct = d.calories / maxCal;
          const over = d.calories > goal;
          return (
            <View key={i} style={wStyles.barCol}>
              {d.calories > 0 && (
                <Text style={wStyles.calLabel}>{d.calories > 999 ? `${Math.round(d.calories / 100) / 10}k` : d.calories}</Text>
              )}
              <View style={wStyles.barTrack}>
                <View style={[
                  wStyles.barFill,
                  { height: `${Math.max(pct * 100, d.calories > 0 ? 4 : 0)}%` as `${number}%` },
                  isToday && wStyles.barToday,
                  over && wStyles.barOver,
                ]} />
                <View style={[wStyles.goalLine, { bottom: `${(goal / maxCal) * 100}%` as `${number}%` }]} />
              </View>
              <Text style={[wStyles.dayLabel, isToday && wStyles.dayLabelToday]}>{d.day}</Text>
            </View>
          );
        })}
      </View>
      <Text style={wStyles.hint}>점선: 목표 칼로리 {goal}kcal</Text>
    </View>
  );
}

const wStyles = StyleSheet.create({
  container: { marginTop: spacing.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  calLabel: { fontSize: 9, color: colors.textLight, marginBottom: 2 },
  barTrack: {
    width: '100%', flex: 1, backgroundColor: colors.border,
    borderRadius: 4, overflow: 'visible', justifyContent: 'flex-end', position: 'relative',
  },
  barFill: { width: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  barToday: { backgroundColor: colors.primary },
  barOver: { backgroundColor: '#E74C3C' },
  goalLine: {
    position: 'absolute', left: -2, right: -2, height: 1.5,
    backgroundColor: '#F6A623', borderStyle: 'dashed',
  },
  dayLabel: { fontSize: 11, color: colors.textLight, marginTop: 4, fontWeight: '600' },
  dayLabelToday: { color: colors.primary, fontWeight: '800' },
  hint: { fontSize: 10, color: colors.textLight, textAlign: 'center', marginTop: spacing.xs },
});

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

export default function HomeScreen({ navigation }: Props) {
  const { currentUser, todayLogs, dailyGoals, removeMealLog, weeklyCalories, todayWater, addWater, resetWater } = useApp();
  const name = currentUser?.profile?.name ?? '사용자';

  const totals = todayLogs.reduce(
    (acc, log) => {
      const n = log.food?.nutrition;
      return {
        calories: acc.calories + (n?.calories ?? 0),
        carbs: acc.carbs + (n?.carbs ?? 0),
        protein: acc.protein + (n?.protein ?? 0),
        fat: acc.fat + (n?.fat ?? 0),
      };
    },
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
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
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>안녕하세요, {name}님 👋</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('ko-KR', {
              month: 'long', day: 'numeric', weekday: 'short',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.profileEmoji}>👤</Text>
        </TouchableOpacity>
      </View>

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
        <NutrientGauge label="탄수화물" current={totals.carbs} goal={dailyGoals.carbs} color="#F6D365" />
        <NutrientGauge label="단백질" current={totals.protein} goal={dailyGoals.protein} color="#2ECC71" />
        <NutrientGauge label="지방" current={totals.fat} goal={dailyGoals.fat} color="#F093FB" />
        <Text style={styles.goalHint}>
          🎯 1일 권장량은 나이·키·몸무게·성별 기준으로 계산됩니다
        </Text>
      </View>

      {/* 오늘의 식사 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘의 식사</Text>
        </View>

        {/* 식단 추가 버튼 (하나로 통합) */}
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

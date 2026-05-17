import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
} from 'react-native';
import CalendarScreen from './CalendarScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
function generateEvaluation(
  totals: { calories: number; carbs: number; protein: number; fat: number; fiber: number; sugar: number; sodium: number },
  goals: { calories: number; carbs: number; protein: number; fat: number; fiber: number; sugar: number; sodium: number },
  foods: string[],
) {
  if (foods.length === 0) {
    return {
      score: 0, grade: '-', gradeColor: '#999',
      summary: '오늘 아직 식단 기록이 없어요 😴',
      details: [] as { emoji: string; text: string }[],
      advice: '아침부터 균형 잡힌 식사를 기록해보세요!',
    };
  }

  let score = 100;
  const details: { emoji: string; text: string }[] = [];

  const calR = totals.calories / (goals.calories || 1);
  const proR = totals.protein / (goals.protein || 1);
  const fatR = totals.fat / (goals.fat || 1);
  const fibR = totals.fiber / (goals.fiber || 1);
  const sugR = totals.sugar / (goals.sugar || 1);
  const sodR = totals.sodium / (goals.sodium || 1);

  // 칼로리
  if (calR > 1.15) { score -= 20; details.push({ emoji: '⚠️', text: `칼로리 ${totals.calories - goals.calories}kcal 초과됐어요` }); }
  else if (calR < 0.65) { score -= 10; details.push({ emoji: '📉', text: `칼로리가 목표의 ${Math.round(calR * 100)}%에 그쳤어요. 더 드세요!` }); }
  else { details.push({ emoji: '✅', text: `칼로리 섭취가 적절해요 (${totals.calories}/${goals.calories}kcal)` }); }

  // 단백질
  if (proR < 0.65) { score -= 15; details.push({ emoji: '💪', text: `단백질이 부족해요! 닭가슴살·달걀·두부를 추가해보세요` }); }
  else if (proR >= 0.9) { details.push({ emoji: '✅', text: `단백질 섭취 충분해요! (${totals.protein}g)` }); }
  else { details.push({ emoji: '🔶', text: `단백질을 조금 더 보충하면 좋겠어요 (${totals.protein}/${goals.protein}g)` }); }

  // 지방
  if (fatR > 1.3) { score -= 10; details.push({ emoji: '🧈', text: `지방이 많아요. 튀긴 음식·버터를 줄여보세요` }); }
  else if (fatR <= 1.0) { details.push({ emoji: '✅', text: `지방 섭취가 적절해요` }); }

  // 식이섬유
  if (fibR < 0.5) { score -= 10; details.push({ emoji: '🥗', text: `식이섬유가 부족해요. 채소·과일·통곡물을 더 드세요` }); }
  else if (fibR >= 0.85) { details.push({ emoji: '✅', text: `식이섬유 섭취가 훌륭해요!` }); }

  // 당류
  if (sugR > 1.2) { score -= 15; details.push({ emoji: '🍭', text: `당류가 과다 섭취됐어요. 단 음식·음료를 줄여보세요` }); }
  else { details.push({ emoji: '✅', text: `당류 섭취가 양호해요` }); }

  // 나트륨
  if (sodR > 1.2) { score -= 10; details.push({ emoji: '🧂', text: `나트륨이 많아요. 짠 음식·국물을 줄여보세요` }); }

  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D';
  const gradeColor = score >= 80 ? '#2ECC71' : score >= 60 ? '#F6A623' : '#E74C3C';

  const adviceList = [
    proR < 0.7 ? '단백질 보충을 위해 저녁에 달걀이나 두부 요리를 추가해보세요.' : null,
    fibR < 0.6 ? '식이섬유를 늘리려면 샐러드나 과일을 간식으로 드세요.' : null,
    sugR > 1.1 ? '내일은 설탕이 들어간 음료·과자를 피해보세요.' : null,
    sodR > 1.1 ? '나트륨 배출을 위해 물을 충분히 마셔보세요.' : null,
    score >= 85 ? '오늘 식단 관리 정말 잘 하셨어요! 내일도 이렇게 유지해보세요 💪' : null,
  ].filter(Boolean) as string[];

  const advice = adviceList[0] ?? '균형 잡힌 식단을 위해 다양한 식품군을 골고루 드세요!';

  return { score, grade, gradeColor, summary: `오늘 ${foods.length}가지 식품을 드셨어요`, details, advice };
}

// ── AI 평가 모달 ──
function AiEvalModal({ visible, onClose, result }: {
  visible: boolean;
  onClose: () => void;
  result: ReturnType<typeof generateEvaluation> | null;
}) {
  if (!result) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={evalStyles.backdrop}>
        <View style={evalStyles.sheet}>
          <View style={evalStyles.handle} />
          <Text style={evalStyles.title}>🤖 AI 식단 평가</Text>

          {/* 점수 */}
          <View style={evalStyles.scoreBox}>
            <Text style={[evalStyles.grade, { color: result.gradeColor }]}>{result.grade}</Text>
            <Text style={[evalStyles.score, { color: result.gradeColor }]}>{result.score}점</Text>
            <Text style={evalStyles.scoreSub}>{result.summary}</Text>
          </View>

          {/* 항목별 평가 */}
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {result.details.map((d, i) => (
              <View key={i} style={evalStyles.detailRow}>
                <Text style={evalStyles.detailEmoji}>{d.emoji}</Text>
                <Text style={evalStyles.detailText}>{d.text}</Text>
              </View>
            ))}
          </ScrollView>

          {/* 조언 */}
          <View style={evalStyles.adviceBox}>
            <Text style={evalStyles.adviceLabel}>💡 오늘의 조언</Text>
            <Text style={evalStyles.adviceText}>{result.advice}</Text>
          </View>

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
  scoreBox: { alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.md },
  grade: { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  score: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  scoreSub: { fontSize: 13, color: colors.textLight, marginTop: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  detailEmoji: { fontSize: 16, width: 22 },
  detailText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
  adviceBox: {
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.md,
    padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md,
  },
  adviceLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  adviceText: { fontSize: 13, color: colors.text, lineHeight: 20 },
  closeBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    padding: spacing.md, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { currentUser, todayLogs, dailyGoals, removeMealLog, weeklyCalories, todayWater, addWater, resetWater } = useApp();
  const name = currentUser?.profile?.name ?? '사용자';
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [evalVisible, setEvalVisible] = useState(false);
  const [evalResult, setEvalResult] = useState<ReturnType<typeof generateEvaluation> | null>(null);

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

      {/* AI 평가 버튼 */}
      <TouchableOpacity
        style={styles.aiEvalBtn}
        onPress={() => {
          const foods = todayLogs.map((l) => l.food?.name).filter(Boolean) as string[];
          setEvalResult(generateEvaluation(totals, dailyGoals, foods));
          setEvalVisible(true);
        }}
      >
        <Text style={styles.aiEvalEmoji}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiEvalTitle}>오늘 식단 AI 평가받기</Text>
          <Text style={styles.aiEvalSub}>오늘 먹은 것들을 분석해드려요</Text>
        </View>
        <Text style={styles.aiEvalArrow}>→</Text>
      </TouchableOpacity>

      {/* AI 평가 모달 */}
      <AiEvalModal visible={evalVisible} onClose={() => setEvalVisible(false)} result={evalResult} />

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


import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp, calculateDailyGoals } from '../context/AppContext';
import { ActivityLevel, Gender } from '../types';

interface ActivityLevelOption {
  key: ActivityLevel;
  label: string;
  desc: string;
  emoji: string;
}

const ACTIVITY_LEVELS: ActivityLevelOption[] = [
  { key: 'sedentary', label: '거의 활동 없음', desc: '주로 앉아서 생활', emoji: '🪑' },
  { key: 'light', label: '가벼운 활동', desc: '주 1-2회 가벼운 운동', emoji: '🚶' },
  { key: 'moderate', label: '보통 활동', desc: '주 3-5회 운동', emoji: '🏃' },
  { key: 'active', label: '활발한 활동', desc: '매일 운동', emoji: '💪' },
];

export default function ProfileScreen() {
  const { currentUser, updateProfile, logout, dailyGoals } = useApp();
  const profile = currentUser?.profile;

  const [editing, setEditing] = useState(false);
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'male');
  const [age, setAge] = useState(profile?.age ?? '');
  const [height, setHeight] = useState(profile?.height ?? '');
  const [weight, setWeight] = useState(profile?.weight ?? '');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activityLevel ?? 'moderate',
  );

  useEffect(() => {
    if (profile) {
      setGender(profile.gender);
      setAge(profile.age);
      setHeight(profile.height);
      setWeight(profile.weight);
      setActivityLevel(profile.activityLevel);
    }
  }, [currentUser]);

  const previewGoals = calculateDailyGoals({ gender, age, height, weight, activityLevel });
  const goals = editing ? previewGoals : dailyGoals;

  const handleSave = (): void => {
    if (!age || !height || !weight) {
      Alert.alert('입력 오류', '나이, 키, 몸무게를 모두 입력해주세요.');
      return;
    }
    updateProfile({ gender, age, height, weight, activityLevel });
    setEditing(false);
    Alert.alert('저장 완료! ✅', '신체 정보가 업데이트됐어요.');
  };

  const handleCancel = (): void => {
    if (profile) {
      setGender(profile.gender);
      setAge(profile.age);
      setHeight(profile.height);
      setWeight(profile.weight);
      setActivityLevel(profile.activityLevel);
    }
    setEditing(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 프로필 헤더 */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>{profile?.gender === 'female' ? '👩' : '👨'}</Text>
        </View>
        <Text style={styles.nickname}>{profile?.name ?? '사용자'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        <TouchableOpacity style={styles.editBadge} onPress={() => setEditing(true)}>
          <Text style={styles.editBadgeText}>✏️ 정보 수정</Text>
        </TouchableOpacity>
      </View>

      {/* 1일 권장량 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          🎯 나의 1일 권장량
          {editing && <Text style={styles.previewTag}> (미리보기)</Text>}
        </Text>
        <Text style={styles.goalDesc}>
          {profile?.gender === 'female' ? '여성' : '남성'} ·{' '}
          {profile?.age ?? '-'}세 · {profile?.height ?? '-'}cm · {profile?.weight ?? '-'}kg 기준
        </Text>
        <View style={styles.goalsGrid}>
          {(
            [
              { label: '칼로리', value: goals.calories, unit: 'kcal', emoji: '🔥', color: '#E74C3C' },
              { label: '탄수화물', value: goals.carbs, unit: 'g', emoji: '🌾', color: '#F6A623' },
              { label: '단백질', value: goals.protein, unit: 'g', emoji: '💪', color: '#2ECC71' },
              { label: '지방', value: goals.fat, unit: 'g', emoji: '🥑', color: '#9B59B6' },
            ] as const
          ).map((g) => (
            <View key={g.label} style={[styles.goalItem, { borderColor: g.color }]}>
              <Text style={styles.goalEmoji}>{g.emoji}</Text>
              <Text style={[styles.goalValue, { color: g.color }]}>{g.value}</Text>
              <Text style={styles.goalUnit}>{g.unit}</Text>
              <Text style={styles.goalLabel}>{g.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 신체 정보 폼 */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>신체 정보</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editLink}>수정 ✏️</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>성별</Text>
        <View style={styles.genderRow}>
          {([{ key: 'male', label: '남성 👨' }, { key: 'female', label: '여성 👩' }] as { key: Gender; label: string }[]).map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.genderBtn, gender === g.key && styles.genderBtnActive, !editing && styles.disabled]}
              onPress={() => editing && setGender(g.key)}
            >
              <Text style={[styles.genderText, gender === g.key && styles.genderTextActive]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {(
          [
            { label: '나이', value: age, setter: setAge, unit: '세', placeholder: '예: 25' },
            { label: '키', value: height, setter: setHeight, unit: 'cm', placeholder: '예: 170' },
            { label: '몸무게', value: weight, setter: setWeight, unit: 'kg', placeholder: '예: 65' },
          ] as const
        ).map((field) => (
          <View key={field.label}>
            <Text style={styles.label}>{field.label}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={field.value}
                onChangeText={field.setter}
                keyboardType="numeric"
                placeholder={field.placeholder}
                placeholderTextColor={colors.textLight}
                editable={editing}
              />
              <Text style={styles.unit}>{field.unit}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.label}>활동량</Text>
        {ACTIVITY_LEVELS.map((level) => (
          <TouchableOpacity
            key={level.key}
            style={[
              styles.activityBtn,
              activityLevel === level.key && styles.activityBtnActive,
              !editing && styles.disabled,
            ]}
            onPress={() => editing && setActivityLevel(level.key)}
          >
            <View style={styles.activityLeft}>
              <Text style={styles.activityEmoji}>{level.emoji}</Text>
              <View>
                <Text style={[styles.activityLabel, activityLevel === level.key && styles.activityLabelActive]}>
                  {level.label}
                </Text>
                <Text style={styles.activityDesc}>{level.desc}</Text>
              </View>
            </View>
            {activityLevel === level.key && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        ))}

        {editing && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>저장하기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 로그아웃 */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() =>
          Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
            { text: '취소', style: 'cancel' },
            { text: '로그아웃', style: 'destructive', onPress: logout },
          ])
        }
      >
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  profileHeader: {
    alignItems: 'center', paddingVertical: spacing.xl,
    backgroundColor: colors.white, borderBottomWidth: 1,
    borderBottomColor: colors.border, marginBottom: spacing.md,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primaryLight, justifyContent: 'center',
    alignItems: 'center', marginBottom: spacing.sm, ...shadow.small,
  },
  avatarEmoji: { fontSize: 38 },
  nickname: { fontSize: 22, fontWeight: '800', color: colors.text },
  email: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  editBadge: {
    marginTop: spacing.sm, backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  editBadgeText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  card: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadow.small,
  },
  cardTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  previewTag: { fontSize: 12, color: colors.accent, fontWeight: '700' },
  editLink: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  goalDesc: { fontSize: 12, color: colors.textLight, marginBottom: spacing.md },
  goalsGrid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  goalItem: {
    flex: 1, minWidth: '40%', alignItems: 'center',
    borderWidth: 1.5, borderRadius: borderRadius.md, padding: spacing.md,
  },
  goalEmoji: { fontSize: 20, marginBottom: 4 },
  goalValue: { fontSize: 22, fontWeight: '800' },
  goalUnit: { fontSize: 11, color: colors.textLight },
  goalLabel: { fontSize: 12, color: colors.text, fontWeight: '600', marginTop: 2 },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.text,
    marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center',
  },
  genderBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderText: { fontSize: 15, fontWeight: '700', color: colors.textLight },
  genderTextActive: { color: '#fff' },
  disabled: { opacity: 0.6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.sm, padding: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.background,
  },
  inputDisabled: { backgroundColor: colors.background },
  unit: { fontSize: 15, color: colors.textLight, fontWeight: '600', width: 30 },
  activityBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border,
  },
  activityBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activityEmoji: { fontSize: 20 },
  activityLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  activityLabelActive: { color: colors.primary },
  activityDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  checkMark: { fontSize: 18, color: colors.primary, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: {
    flex: 1, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center',
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textLight, fontSize: 15, fontWeight: '700' },
  saveBtn: {
    flex: 2, backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  logoutBtn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: '#FFF0F0', borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FFD0D0',
  },
  logoutText: { color: '#E74C3C', fontSize: 15, fontWeight: '700' },
});

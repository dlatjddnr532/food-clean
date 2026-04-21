import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { Gender } from '../types';

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Signup'>;
};

const STEPS = ['계정 정보', '신체 정보'];

export default function SignupScreen({ navigation }: Props) {
  const { signup } = useApp();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const handleNextStep = (): void => {
    if (!name || !email || !password || !passwordConfirm) {
      Alert.alert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }
    if (password.length < 4) {
      Alert.alert('비밀번호 오류', '비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('비밀번호 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    setStep(1);
  };

  const handleSignup = async (): Promise<void> => {
    if (!age || !height || !weight) {
      Alert.alert('입력 오류', '나이, 키, 몸무게를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    await new Promise<void>((r) => setTimeout(r, 800));
    const result = signup({ name, email, password, gender, age, height, weight });
    setLoading(false);
    if (result.success) {
      Alert.alert('가입 완료! 🎉', '로그인해주세요.', [
        { text: '확인', onPress: () => navigation.navigate('Login') },
      ]);
    } else {
      Alert.alert('가입 실패', result.message ?? '오류가 발생했습니다.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step === 0 ? navigation.goBack() : setStep(0))}
        >
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        <Text style={styles.title}>회원가입</Text>
        <Text style={styles.subtitle}>푸드로그와 함께 건강한 식단을 시작하세요</Text>

        <View style={styles.stepRow}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                <Text style={[styles.stepNum, i <= step && styles.stepNumActive]}>
                  {i + 1}
                </Text>
              </View>
              <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>
                {s}
              </Text>
            </View>
          ))}
          <View style={styles.stepLine} />
        </View>

        <View style={styles.form}>
          {step === 0 && (
            <>
              <Text style={styles.formTitle}>계정 정보 입력</Text>
              {(
                [
                  { label: '이름', value: name, setter: setName, placeholder: '이름을 입력하세요', secure: false, type: 'default' },
                  { label: '이메일', value: email, setter: setEmail, placeholder: 'example@email.com', secure: false, type: 'email-address' },
                  { label: '비밀번호', value: password, setter: setPassword, placeholder: '4자 이상 입력', secure: true, type: 'default' },
                  { label: '비밀번호 확인', value: passwordConfirm, setter: setPasswordConfirm, placeholder: '비밀번호 재입력', secure: true, type: 'default' },
                ] as const
              ).map((field) => (
                <View key={field.label}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textLight}
                    value={field.value}
                    onChangeText={field.setter}
                    secureTextEntry={field.secure}
                    autoCapitalize="none"
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
                <Text style={styles.nextBtnText}>다음 →</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.formTitle}>신체 정보 입력</Text>
              <Text style={styles.formHint}>입력하신 정보로 1일 권장 영양소가 계산돼요</Text>

              <Text style={styles.label}>성별</Text>
              <View style={styles.genderRow}>
                {([{ key: 'male', label: '남성 👨' }, { key: 'female', label: '여성 👩' }] as { key: Gender; label: string }[]).map((g) => (
                  <TouchableOpacity
                    key={g.key}
                    style={[styles.genderBtn, gender === g.key && styles.genderBtnActive]}
                    onPress={() => setGender(g.key)}
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
                      style={[styles.input, { flex: 1 }]}
                      value={field.value}
                      onChangeText={field.setter}
                      keyboardType="numeric"
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.textLight}
                    />
                    <Text style={styles.unit}>{field.unit}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.nextBtn, loading && { opacity: 0.7 }]}
                onPress={handleSignup}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.nextBtnText}>가입 완료 🎉</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginText}>
              이미 계정이 있으신가요?{' '}
              <Text style={styles.loginTextBold}>로그인</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl },
  backBtn: { marginBottom: spacing.sm },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textLight, marginBottom: spacing.lg },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing.lg, position: 'relative',
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepNum: { fontSize: 14, fontWeight: '700', color: colors.textLight },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: colors.textLight, fontWeight: '600' },
  stepLabelActive: { color: colors.primary },
  stepLine: {
    position: 'absolute', top: 15, left: '25%', right: '25%',
    height: 2, backgroundColor: colors.border, zIndex: -1,
  },
  form: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadow.small,
  },
  formTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 },
  formHint: { fontSize: 12, color: colors.textLight, marginBottom: spacing.sm },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.text,
    marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.sm, padding: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.background,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unit: { fontSize: 15, color: colors.textLight, fontWeight: '600', width: 30 },
  genderRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  genderBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center',
  },
  genderBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderText: { fontSize: 15, fontWeight: '700', color: colors.textLight },
  genderTextActive: { color: '#fff' },
  nextBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.lg,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  loginText: { color: colors.textLight, fontSize: 14 },
  loginTextBold: { color: colors.primary, fontWeight: '700' },
});

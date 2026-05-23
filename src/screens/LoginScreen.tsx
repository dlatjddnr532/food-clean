import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요.');
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
      >
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🥗</Text>
          </View>
          <Text style={styles.appName}>푸드로그</Text>
          <Text style={styles.appSubtitle}>AI가 분석해주는 나의 식단</Text>
        </View>

        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>
            💡 테스트 계정: test@food.com / test1234
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="example@email.com"
            placeholderTextColor={colors.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder="비밀번호 입력"
            placeholderTextColor={colors.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.loginBtnText}>로그인</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
            style={styles.signupLink}
          >
            <Text style={styles.signupText}>
              계정이 없으신가요?{' '}
              <Text style={styles.signupTextBold}>회원가입</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoArea: { alignItems: 'center', marginBottom: spacing.lg },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md, ...shadow.medium,
  },
  logoEmoji: { fontSize: 40 },
  appName: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  appSubtitle: { fontSize: 14, color: colors.textLight, marginTop: 4 },
  hintBanner: {
    backgroundColor: '#FFF8E1', borderRadius: borderRadius.sm,
    padding: spacing.sm, marginBottom: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.accent,
  },
  hintText: { fontSize: 12, color: '#8D6E63', fontWeight: '600' },
  form: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.lg, ...shadow.small,
  },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.text,
    marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.sm, padding: spacing.md,
    fontSize: 15, color: colors.text, backgroundColor: colors.background,
  },
  loginBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.lg,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  signupLink: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  signupText: { color: colors.textLight, fontSize: 14 },
  signupTextBold: { color: colors.primary, fontWeight: '700' },
});

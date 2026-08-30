import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth-context';

export default function SignInScreen() {
  const { sendSignInCode, verifySignInCode } = useAuth();
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSendCode() {
    if (!email.trim()) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    const { error } = await sendSignInCode(email.trim());
    setIsSubmitting(false);
    if (error) {
      setErrorMessage(error);
    } else {
      setStep('code');
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    const { error } = await verifySignInCode(email.trim(), code.trim());
    setIsSubmitting(false);
    if (error) {
      setErrorMessage(error);
    }
  }

  const inputStyle = [
    styles.input,
    { color: Colors[colorScheme].text, borderColor: Colors[colorScheme].tint },
  ];

  if (step === 'code') {
    return (
      <View style={styles.container}>
        <Image source={require('../assets/images/logo.png')} style={styles.logo} />
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.subtitle}>We sent a sign-in code to {email.trim()}.</Text>
        <TextInput
          style={inputStyle}
          value={code}
          onChangeText={setCode}
          placeholder="12345678"
          placeholderTextColor="#888"
          keyboardType="number-pad"
          autoFocus
          editable={!isSubmitting}
          onSubmitEditing={handleVerifyCode}
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <Pressable
          style={[styles.button, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={handleVerifyCode}
          disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={Colors[colorScheme].background} />
          ) : (
            <Text style={[styles.buttonText, { color: Colors[colorScheme].background }]}>
              Verify
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            setStep('email');
            setCode('');
            setErrorMessage(null);
          }}>
          <Text style={styles.link}>Use a different email</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/logo.png')} style={styles.logo} />
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Enter your email and we'll send you a sign-in code.</Text>
      <TextInput
        style={inputStyle}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#888"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!isSubmitting}
        onSubmitEditing={handleSendCode}
      />
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <Pressable
        style={[styles.button, { backgroundColor: Colors[colorScheme].tint }]}
        onPress={handleSendCode}
        disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={Colors[colorScheme].background} />
        ) : (
          <Text style={[styles.buttonText, { color: Colors[colorScheme].background }]}>
            Send sign-in code
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: {
    color: '#e53e3e',
  },
  button: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  link: {
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});

import React, { Component, type PropsWithChildren } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { darkColors as colors } from '../theme';

interface Props extends PropsWithChildren {
  screenName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    if (router.canGoBack()) {
      router.back();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>
            {this.props.screenName} ekranında bir hata oluştu
          </Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'Beklenmeyen bir hata oluştu'}
          </Text>
          <View style={styles.buttons}>
            {router.canGoBack() && (
              <Pressable
                style={styles.secondaryButton}
                onPress={this.handleGoBack}
                accessibilityRole="button"
                accessibilityLabel="Geri dön"
              >
                <Text style={styles.secondaryButtonText}>Geri Dön</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.primaryButton}
              onPress={this.handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Yenile"
            >
              <Text style={styles.primaryButtonText}>Yenile</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  emoji: { fontSize: 40, marginBottom: 16 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export function withScreenErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string,
) {
  return function ScreenWithErrorBoundary(props: P) {
    return (
      <ScreenErrorBoundary screenName={screenName}>
        <WrappedComponent {...props} />
      </ScreenErrorBoundary>
    );
  };
}

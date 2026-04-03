// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary — catches render errors in screen subtrees
// Wrap critical screens to prevent full-app crashes
// Usage: <ErrorBoundary> <YourScreen /> </ErrorBoundary>
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { captureError } from '../lib/monitoring'
import { Colors, Spacing, FontSize, FontWeight } from '../constants/theme'

interface Props   { children: React.ReactNode; fallback?: React.ReactNode }
interface State   { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, { componentStack: info.componentStack ?? '' })
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>حدث خطأ غير متوقع</Text>
        <Text style={styles.message}>
          {__DEV__ ? this.state.error?.message : 'يرجى إعادة المحاولة'}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={this.reset}>
          <Text style={styles.btn_text}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, backgroundColor: Colors.background,
  },
  emoji:   { fontSize: 56, marginBottom: Spacing.lg },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.black, marginBottom: Spacing.md },
  message: { fontSize: FontSize.md, color: Colors.gray500, textAlign: 'center', marginBottom: Spacing.xl },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  btn_text: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
})

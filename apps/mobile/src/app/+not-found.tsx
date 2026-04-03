import { Link, Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { Colors, FontSize, Spacing } from '../constants/theme'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'الصفحة غير موجودة' }} />
      <View style={styles.container}>
        <Text style={styles.emoji}>🔍</Text>
        <Text style={styles.title}>هذه الصفحة غير موجودة</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={styles.link_text}>العودة للرئيسية</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emoji:     { fontSize: 56, marginBottom: Spacing.lg },
  title:     { fontSize: FontSize.xl, color: Colors.black, marginBottom: Spacing.lg, textAlign: 'center' },
  link:      { marginTop: Spacing.md },
  link_text: { fontSize: FontSize.md, color: Colors.primary, textDecorationLine: 'underline' },
})

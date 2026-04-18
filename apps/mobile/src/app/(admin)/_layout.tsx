// ─────────────────────────────────────────────────────────────────────────────
// Admin layout — tab navigation for admin/superadmin users only
// Route guard: any non-admin who somehow reaches this group is bounced back
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { useRouter } from 'expo-router'
import { Text } from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { Colors, FontSize } from '../../constants/theme'

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: FontSize.lg, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
}

export default function AdminLayout() {
  const role   = useAuthStore(s => s.role)
  const router = useRouter()

  useEffect(() => {
    if (role && role !== 'admin' && role !== 'superadmin') {
      router.replace('/(tabs)')
    }
  }, [role, router])

  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarActiveTintColor:   Colors.error,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          borderTopColor:  Colors.border,
          backgroundColor: Colors.white,
          height:          60,
          paddingBottom:   8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="kyc"
        options={{
          title: 'KYC',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="disputes"
        options={{
          title: 'النزاعات',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚖️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'المستخدمون',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'التقارير',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs layout — bottom navigation for customer
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, FontSize, FontWeight } from '../../constants/theme'
import { useMessagingStore } from '../../stores/messagingStore'

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
}

function BadgeIcon({ emoji, focused, count }: { emoji: string; focused: boolean; count: number }) {
  return (
    <View style={{ position: 'relative' }}>
      <TabIcon emoji={emoji} focused={focused} />
      {count > 0 && (
        <View style={badgeStyles.dot}>
          <Text style={badgeStyles.text}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </View>
  )
}

const badgeStyles = StyleSheet.create({
  dot: {
    position: 'absolute', top: -4, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.white,
  },
  text: { color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold },
})

export default function TabsLayout() {
  const { t } = useTranslation()
  const totalUnread = useMessagingStore(s =>
    Object.values(s.unreadCount).reduce((a, b) => a + b, 0)
  )

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          borderTopColor: Colors.border,
          backgroundColor: Colors.white,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: FontSize.xs },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t('tabs.jobs'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="💼" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarIcon: ({ focused }) => (
            <BadgeIcon emoji="💬" focused={focused} count={totalUnread} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      {/* Provider dashboard — hidden from customer tab bar, accessible via router.replace('/(tabs)/provider') */}
      <Tabs.Screen
        name="provider"
        options={{ href: null }}
      />
    </Tabs>
  )
}

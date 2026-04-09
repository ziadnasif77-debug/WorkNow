// ─────────────────────────────────────────────────────────────────────────────
// Job Applications Screen — provider views all applicants for a specific job
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, Linking,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { EmptyState } from '../../components/marketplace'
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '../../constants/theme'
import type { JobApplication } from '@workfix/types'

const STATUS_COLOR: Record<JobApplication['status'], string> = {
  pending:     Colors.warning,
  viewed:      Colors.primary,
  shortlisted: Colors.success,
  rejected:    Colors.error,
}

export default function JobApplicationsScreen() {
  const { t }    = useTranslation()
  const { id }   = useLocalSearchParams<{ id: string }>()
  const { jobApplications, jobApplicationsLoading, loadJobApplications } = useJobsStore()

  useEffect(() => {
    if (id) void loadJobApplications(id)
  }, [id])

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('jobs.viewApplications')} />

      <FlatList
        data={jobApplications}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          jobApplicationsLoading
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
            : <EmptyState emoji="📭" title={t('jobs.noApplications')} subtitle="" />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.applicantName}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
                  {t(`jobs.app_${item.status}`)}
                </Text>
              </View>
            </View>

            {/* Contact info — visible to provider */}
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.applicantEmail}`)}>
              <Text style={styles.contact}>✉️ {item.applicantEmail}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.applicantPhone}`)}>
              <Text style={styles.contact}>📞 {item.applicantPhone}</Text>
            </TouchableOpacity>

            {item.coverNote ? (
              <Text style={styles.coverNote} numberOfLines={3}>{item.coverNote}</Text>
            ) : null}

            {item.cvUrl ? (
              <TouchableOpacity
                style={styles.cvBtn}
                onPress={() => Linking.openURL(item.cvUrl!)}
                activeOpacity={0.8}
              >
                <Text style={styles.cvBtnText}>📎 {item.cvFileName ?? t('jobs.uploadCV')}</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.date}>
              {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  list:       { padding: Spacing.md, gap: Spacing.md },
  card:       { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  name:       { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  badge:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  badgeText:  { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  contact:    { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  coverNote:  { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },
  cvBtn:      { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: Spacing.md, alignSelf: 'flex-start' },
  cvBtnText:  { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  date:       { fontSize: FontSize.xs, color: Colors.gray400 },
})

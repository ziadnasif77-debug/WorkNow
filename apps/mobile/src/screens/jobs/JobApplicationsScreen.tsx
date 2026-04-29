// ─────────────────────────────────────────────────────────────────────────────
// Job Applications Screen — provider views all applicants for a specific job
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useJobsStore } from '../../stores/jobsStore'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Badge, Button, Card, EmptyState, SkeletonList } from '../../components/ui'
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme'
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
            ? <SkeletonList count={4} hasAvatar />
            : <EmptyState emoji="📭" title={t('jobs.noApplications')} subtitle="" />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.card_top}>
              <Text style={styles.name}>{item.applicantName}</Text>
              <Badge
                variant="custom"
                bg={STATUS_COLOR[item.status] + '20'}
                color={STATUS_COLOR[item.status]}
                label={t(`jobs.app_${item.status}`)}
              />
            </View>

            {/* Contact info — visible to provider */}
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.applicantEmail}`)}>
              <Text style={styles.contact}>✉️ {item.applicantEmail}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.applicantPhone}`)}>
              <Text style={styles.contact}>📞 {item.applicantPhone}</Text>
            </TouchableOpacity>

            {item.coverNote ? (
              <Text style={styles.cover_note} numberOfLines={3}>{item.coverNote}</Text>
            ) : null}

            {item.cvUrl ? (
              <Button
                label={`📎 ${item.cvFileName ?? t('jobs.uploadCV')}`}
                onPress={() => Linking.openURL(item.cvUrl!)}
                variant="outline"
                size="sm"
                fullWidth={false}
              />
            ) : null}

            <Text style={styles.date}>
              {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
            </Text>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  list:       { padding: Spacing.md, gap: Spacing.md },
  card_top:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  name:       { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gray900 },
  contact:    { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  cover_note: { fontSize: FontSize.sm, color: Colors.gray600, lineHeight: 20 },
  date:       { fontSize: FontSize.xs, color: Colors.gray400 },
})

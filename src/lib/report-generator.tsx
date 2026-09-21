import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { prisma } from './db';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2px solid #1E293B',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    color: '#0F172A',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#0F172A',
    marginTop: 20,
    marginBottom: 10,
    fontWeight: 'bold',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottom: '1px solid #F1F5F9',
  },
  dimensionName: {
    fontSize: 12,
    color: '#334155',
    width: '40%',
  },
  barContainer: {
    width: '40%',
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    marginTop: 2,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 5,
  },
  scoreValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: 'bold',
    width: '15%',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 10,
    borderTop: '1px solid #E2E8F0',
    paddingTop: 10,
  }
});

interface ScoreData {
  dimension: { name: string };
  finalScore: number;
}

const ReportDocument = ({ user, scores }: { user: any, scores: ScoreData[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Cognitive Assessment Report</Text>
        <Text style={styles.subtitle}>Candidate: {user.name} | Target Role: {user.targetRole}</Text>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Dimension Scores</Text>
        {scores.map((score, i) => (
          <View key={i} style={styles.scoreRow}>
            <Text style={styles.dimensionName}>{score.dimension.name}</Text>
            <View style={styles.barContainer}>
              <View style={{ ...styles.barFill, width: `${Math.min(100, Math.max(0, score.finalScore))}%` }} />
            </View>
            <Text style={styles.scoreValue}>{score.finalScore.toFixed(1)} / 100</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        Confidential Report — Generated securely by CognitiveEdge System
      </Text>
    </Page>
  </Document>
);

export async function generateReportPDF(sessionId: string): Promise<Buffer> {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
      finalScores: {
        include: { dimension: true }
      }
    }
  });

  if (!session) throw new Error('Session not found');

  const pdfBuffer = await renderToBuffer(<ReportDocument user={session.user} scores={session.finalScores} />);
  return pdfBuffer as Buffer;
}

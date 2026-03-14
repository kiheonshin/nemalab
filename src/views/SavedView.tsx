// ============================================================================
// SavedView — Saved experiments list
// ============================================================================

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/common';
import { PageLayout } from '../components/layout';
import { useStore } from '../store';
import { deepClone } from '../engine/math';
import { timeLabel } from '../engine/math';
import styles from './SavedView.module.css';

export function SavedView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const savedRuns = useStore((s) => s.savedRuns);
  const loadSavedRuns = useStore((s) => s.loadSavedRuns);
  const deleteRun = useStore((s) => s.deleteRun);
  const clearAllRuns = useStore((s) => s.clearAllRuns);
  const createSimulation = useStore((s) => s.createSimulation);
  const showToast = useStore((s) => s.showToast);

  useEffect(() => {
    loadSavedRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoad = (run: typeof savedRuns[number]) => {
    useStore.setState({
      appliedConfig: deepClone(run.config),
      draftConfig: deepClone(run.config),
      appliedSeed: run.seed,
      draftSeed: run.seed,
      dirtyPaths: new Set<string>(),
      visualDirtyPaths: new Set<string>(),
    });
    createSimulation(run.config, run.seed);
    showToast(t('toast.loaded'));
    navigate('/');
  };

  const handleDelete = (id: string) => {
    deleteRun(id);
    showToast(t('toast.deleted'));
  };

  return (
    <PageLayout
      eyebrow={t('nav.saved')}
      title={t('saved.title')}
      actions={
        savedRuns.length > 0 ? (
          <div className={styles.toolbar}>
            <Button variant="ghost" size="small" onClick={clearAllRuns}>
              {t('saved.clearAll')}
            </Button>
          </div>
        ) : undefined
      }
      contentClassName={styles.pageContent}
    >

      {savedRuns.length === 0 ? (
        <Card className={styles.emptyState}>
          <p>
            {t('saved.empty')}
          </p>
        </Card>
      ) : (
        <div className={styles.grid}>
          {savedRuns.map((run) => (
            <Card key={run.id} padding="default" className={styles.savedCard}>
              <div className={styles.cardBody}>
                <div className={styles.headerBlock}>
                  <span className={styles.presetLabel}>{run.config.presetName || 'Lab'}</span>
                  <h3 className={styles.cardTitle}>
                    {run.name}
                  </h3>
                  <p className={styles.meta}>
                    {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className={styles.summaryList}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Preset</span>
                    <span className={styles.summaryValue}>{run.config.presetName}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Seed</span>
                    <span className={styles.summaryValue}>{run.seed}</span>
                  </div>
                  {run.metrics && (
                    <>
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>{t('monitor.elapsed')}</span>
                        <span className={styles.summaryValue}>{timeLabel(run.metrics.elapsed)}</span>
                      </div>
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>{t('monitor.collisions')}</span>
                        <span className={styles.summaryValue}>{run.metrics.collisions}</span>
                      </div>
                      <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>{t('monitor.turns')}</span>
                        <span className={styles.summaryValue}>{run.metrics.turns}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.actions}>
                  <Button size="small" variant="primary" onClick={() => handleLoad(run)}>
                    {t('saved.load')}
                  </Button>
                  <Button size="small" variant="ghost" onClick={() => handleDelete(run.id)}>
                    {t('saved.delete')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

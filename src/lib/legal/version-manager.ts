// Version management system for legal documents

import type { 
  LegalVersion, 
  DocumentLineage,
  ChangeDetection 
} from '@/types/lineage';
import type { LegalDocument, LegalContent } from '@/types/legal';
import { diffLines, diffWords } from 'diff';

export class VersionManager {
  /**
   * Create a new version entry for a document
   */
  createVersion(params: {
    documentId: string;
    versionNumber: string;
    effectiveDate: Date;
    publicationDate: Date;
    reformType?: LegalVersion['reformType'];
    reformedArticles?: string[];
    reformDescription?: string;
    previousVersionId?: string;
  }): LegalVersion {
    return {
      versionId: this.generateVersionId(params.documentId),
      versionNumber: params.versionNumber,
      effectiveDate: params.effectiveDate,
      publicationDate: params.publicationDate,
      reformType: params.reformType,
      reformedArticles: params.reformedArticles,
      reformDescription: params.reformDescription,
      previousVersionId: params.previousVersionId,
      isCurrentVersion: true
    };
  }

  /**
   * Compare two versions of a document
   */
  compareVersions(
    oldVersion: LegalDocument,
    newVersion: LegalDocument
  ): {
    changes: Array<{
      type: 'added' | 'removed' | 'modified';
      location: string;
      oldContent?: string;
      newContent?: string;
    }>;
    summary: {
      articlesAdded: number;
      articlesRemoved: number;
      articlesModified: number;
      totalChanges: number;
    };
  } {
    const changes: Array<{
      type: 'added' | 'removed' | 'modified';
      location: string;
      oldContent?: string;
      newContent?: string;
    }> = [];

    // Create maps for easier comparison
    const oldArticles = new Map(
      oldVersion.content.map(c => [c.id, c])
    );
    const newArticles = new Map(
      newVersion.content.map(c => [c.id, c])
    );

    let articlesAdded = 0;
    let articlesRemoved = 0;
    let articlesModified = 0;

    // Check for removed articles
    oldArticles.forEach((oldContent, id) => {
      if (!newArticles.has(id)) {
        changes.push({
          type: 'removed',
          location: this.getContentLocation(oldContent),
          oldContent: oldContent.text
        });
        articlesRemoved++;
      }
    });

    // Check for added or modified articles
    newArticles.forEach((newContent, id) => {
      const oldContent = oldArticles.get(id);
      
      if (!oldContent) {
        // Article was added
        changes.push({
          type: 'added',
          location: this.getContentLocation(newContent),
          newContent: newContent.text
        });
        articlesAdded++;
      } else if (oldContent.text !== newContent.text) {
        // Article was modified
        changes.push({
          type: 'modified',
          location: this.getContentLocation(newContent),
          oldContent: oldContent.text,
          newContent: newContent.text
        });
        articlesModified++;
      }
    });

    return {
      changes,
      summary: {
        articlesAdded,
        articlesRemoved,
        articlesModified,
        totalChanges: changes.length
      }
    };
  }

  /**
   * Generate a diff between two text contents
   */
  generateTextDiff(
    oldText: string,
    newText: string,
    granularity: 'line' | 'word' = 'line'
  ): Array<{
    type: 'unchanged' | 'added' | 'removed';
    value: string;
  }> {
    const diffFunc = granularity === 'line' ? diffLines : diffWords;
    const diff = diffFunc(oldText, newText);

    return diff.map(part => ({
      type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
      value: part.value
    }));
  }

  /**
   * Find related versions based on reform chain
   */
  findRelatedVersions(
    versions: LegalVersion[],
    versionId: string
  ): {
    ancestors: LegalVersion[];
    descendants: LegalVersion[];
  } {
    const ancestors: LegalVersion[] = [];
    const descendants: LegalVersion[] = [];
    
    // Build version map
    const versionMap = new Map(
      versions.map(v => [v.versionId, v])
    );

    // Find ancestors
    const currentId = versionId;
    let current = versionMap.get(currentId);
    
    while (current?.previousVersionId) {
      const previous = versionMap.get(current.previousVersionId);
      if (previous) {
        ancestors.push(previous);
        current = previous;
      } else {
        break;
      }
    }

    // Find descendants
    versions.forEach(version => {
      if (version.previousVersionId === versionId) {
        descendants.push(version);
        // Recursively find descendants of descendants
        const subDescendants = this.findRelatedVersions(versions, version.versionId);
        descendants.push(...subDescendants.descendants);
      }
    });

    return { 
      ancestors: ancestors.reverse(), // Oldest first
      descendants 
    };
  }

  /**
   * Generate version timeline
   */
  generateTimeline(versions: LegalVersion[]): Array<{
    date: Date;
    version: LegalVersion;
    type: 'publication' | 'effective';
    description: string;
  }> {
    const timeline: Array<{
      date: Date;
      version: LegalVersion;
      type: 'publication' | 'effective';
      description: string;
    }> = [];

    versions.forEach(version => {
      // Add publication event
      timeline.push({
        date: version.publicationDate,
        version,
        type: 'publication',
        description: `Versión ${version.versionNumber} publicada`
      });

      // Add effective date event if different
      if (version.effectiveDate.getTime() !== version.publicationDate.getTime()) {
        timeline.push({
          date: version.effectiveDate,
          version,
          type: 'effective',
          description: `Versión ${version.versionNumber} entra en vigor`
        });
      }
    });

    // Sort by date
    return timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Check if document needs update
   */
  async checkForUpdates(
    lineage: DocumentLineage,
    checkConfig: ChangeDetection
  ): Promise<ChangeDetection> {
    const now = new Date();
    
    // Skip if not time to check yet
    if (checkConfig.nextCheckDate > now) {
      return checkConfig;
    }

    // This would normally check the source URL
    // For now, we'll simulate the check
    const changesDetected = Math.random() > 0.9; // 10% chance of changes

    const updatedConfig: ChangeDetection = {
      ...checkConfig,
      lastCheckDate: now,
      nextCheckDate: this.calculateNextCheckDate(now, checkConfig.checkFrequency),
      changesDetected
    };

    if (changesDetected) {
      updatedConfig.changeType = 'content';
      updatedConfig.changeDetails = 'Reforma detectada en documento fuente';
    }

    return updatedConfig;
  }

  /**
   * Generate reform summary
   */
  generateReformSummary(versions: LegalVersion[]): {
    totalReforms: number;
    reformsByType: Record<string, number>;
    mostRecentReform?: LegalVersion;
    averageTimeBetweenReforms: number;
  } {
    const reforms = versions.filter(v => v.reformType);
    const reformsByType: Record<string, number> = {};

    reforms.forEach(reform => {
      if (reform.reformType) {
        reformsByType[reform.reformType] = (reformsByType[reform.reformType] || 0) + 1;
      }
    });

    // Calculate average time between reforms
    let totalDays = 0;
    if (reforms.length > 1) {
      for (let i = 1; i < reforms.length; i++) {
        const days = this.daysBetween(
          reforms[i-1].effectiveDate,
          reforms[i].effectiveDate
        );
        totalDays += days;
      }
    }

    return {
      totalReforms: reforms.length,
      reformsByType,
      mostRecentReform: reforms[reforms.length - 1],
      averageTimeBetweenReforms: reforms.length > 1 
        ? totalDays / (reforms.length - 1) 
        : 0
    };
  }

  // Helper methods
  private generateVersionId(documentId: string): string {
    return `${documentId}_v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getContentLocation(content: LegalContent): string {
    if (content.type === 'article') {
      return `Artículo ${content.number}`;
    } else if (content.type === 'chapter') {
      return `Capítulo ${content.number}: ${content.title}`;
    } else if (content.type === 'title') {
      return `Título ${content.number}: ${content.title}`;
    }
    return content.title || 'Sin título';
  }

  private calculateNextCheckDate(
    from: Date,
    frequency: ChangeDetection['checkFrequency']
  ): Date {
    const next = new Date(from);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    
    return next;
  }

  private daysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date2.getTime() - date1.getTime()) / oneDay));
  }
}
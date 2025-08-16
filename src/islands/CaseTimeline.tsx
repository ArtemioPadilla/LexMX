import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';

export interface CaseEvent {
  id: string;
  type: 'created' | 'status_change' | 'document_added' | 'note_added' | 'deadline' | 'party_added' | 'chat_started' | 'custom';
  title: string;
  description?: string;
  date: Date;
  icon?: string;
  color?: string;
  metadata?: any;
}

interface CaseTimelineProps {
  caseId: string;
  caseCreatedAt: Date;
  caseUpdatedAt: Date;
  documents: Array<{ id: string; name: string; uploadedAt: Date }>;
  notes: Array<{ id: string; content: string; createdAt: Date }>;
  deadlines: Array<{ id: string; title: string; date: Date; type: string; completed: boolean }>;
  parties: Array<{ id: string; name: string; role: string }>;
  statusChanges?: Array<{ date: Date; from: string; to: string }>;
  onAddEvent?: (event: Omit<CaseEvent, 'id'>) => void;
}

export default function CaseTimeline({
  caseId,
  caseCreatedAt,
  caseUpdatedAt,
  documents,
  notes,
  deadlines,
  parties,
  statusChanges = [],
  onAddEvent
}: CaseTimelineProps) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventData, setNewEventData] = useState({
    title: '',
    description: '',
    type: 'custom' as const,
    date: new Date().toISOString().split('T')[0]
  });
  
  // Generate events from case data
  useEffect(() => {
    const generatedEvents: CaseEvent[] = [];
    
    // Case creation event
    generatedEvents.push({
      id: 'created',
      type: 'created',
      title: t('cases.timeline.caseCreated'),
      date: caseCreatedAt,
      icon: '📁',
      color: 'bg-green-500'
    });
    
    // Document events
    documents.forEach(doc => {
      generatedEvents.push({
        id: `doc_${doc.id}`,
        type: 'document_added',
        title: t('cases.timeline.documentAdded'),
        description: doc.name,
        date: doc.uploadedAt,
        icon: '📄',
        color: 'bg-blue-500'
      });
    });
    
    // Note events
    notes.forEach(note => {
      generatedEvents.push({
        id: `note_${note.id}`,
        type: 'note_added',
        title: t('cases.timeline.noteAdded'),
        description: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
        date: note.createdAt,
        icon: '📝',
        color: 'bg-yellow-500'
      });
    });
    
    // Deadline events (both past and future)
    deadlines.forEach(deadline => {
      generatedEvents.push({
        id: `deadline_${deadline.id}`,
        type: 'deadline',
        title: deadline.title,
        description: `${t(`cases.deadlineTypes.${deadline.type}`)} ${deadline.completed ? '✓' : ''}`,
        date: deadline.date,
        icon: deadline.completed ? '✅' : '⏰',
        color: deadline.completed ? 'bg-gray-500' : 
               deadline.date < new Date() ? 'bg-red-500' : 'bg-orange-500',
        metadata: { completed: deadline.completed, type: deadline.type }
      });
    });
    
    // Status change events
    statusChanges.forEach((change, index) => {
      generatedEvents.push({
        id: `status_${index}`,
        type: 'status_change',
        title: t('cases.timeline.statusChanged'),
        description: `${change.from} → ${change.to}`,
        date: change.date,
        icon: '🔄',
        color: 'bg-purple-500'
      });
    });
    
    // Check for chat conversations
    const chatStorageKey = `lexmx_case_chat_${caseId}`;
    const savedChat = localStorage.getItem(chatStorageKey);
    if (savedChat) {
      try {
        const chatData = JSON.parse(savedChat);
        if (chatData.messages && chatData.messages.length > 1) {
          const firstUserMessage = chatData.messages.find((m: any) => m.type === 'user');
          if (firstUserMessage) {
            generatedEvents.push({
              id: `chat_${chatData.conversationId}`,
              type: 'chat_started',
              title: t('cases.timeline.chatStarted'),
              description: t('cases.timeline.messagesCount', { count: chatData.messages.length }),
              date: new Date(firstUserMessage.timestamp),
              icon: '💬',
              color: 'bg-indigo-500'
            });
          }
        }
      } catch (error) {
        console.error('Error loading chat data for timeline:', error);
      }
    }
    
    // Sort events by date (newest first by default)
    generatedEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    setEvents(generatedEvents);
  }, [caseId, caseCreatedAt, documents, notes, deadlines, parties, statusChanges]);
  
  // Filter events
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(event => event.type === filter);
  }, [events, filter]);
  
  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: CaseEvent[] } = {};
    
    filteredEvents.forEach(event => {
      const dateKey = event.date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });
    
    return groups;
  }, [filteredEvents]);
  
  const handleAddCustomEvent = () => {
    if (!newEventData.title) return;
    
    const newEvent: Omit<CaseEvent, 'id'> = {
      type: 'custom',
      title: newEventData.title,
      description: newEventData.description,
      date: new Date(newEventData.date),
      icon: '📌',
      color: 'bg-gray-500'
    };
    
    if (onAddEvent) {
      onAddEvent(newEvent);
    }
    
    // Add to local events immediately
    setEvents(prev => [{
      ...newEvent,
      id: `custom_${Date.now()}`
    }, ...prev].sort((a, b) => b.date.getTime() - a.date.getTime()));
    
    // Reset form
    setNewEventData({
      title: '',
      description: '',
      type: 'custom',
      date: new Date().toISOString().split('T')[0]
    });
    setShowAddEvent(false);
  };
  
  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return t('cases.timeline.today');
    if (days === 1) return t('cases.timeline.yesterday');
    if (days === -1) return t('cases.timeline.tomorrow');
    if (days > 0 && days < 7) return t('cases.timeline.daysAgo', { days });
    if (days < 0 && days > -7) return t('cases.timeline.inDays', { days: Math.abs(days) });
    return '';
  };
  
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Timeline Header */}
      <div className="flex items-center justify-between mb-6 p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('cases.timeline.title')}
            </h3>
          </div>
          
          {/* Filter Dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all hover:shadow-md"
          >
            <option value="all">{t('cases.timeline.filterAll')}</option>
            <option value="document_added">{t('cases.timeline.filterDocuments')}</option>
            <option value="note_added">{t('cases.timeline.filterNotes')}</option>
            <option value="deadline">{t('cases.timeline.filterDeadlines')}</option>
            <option value="chat_started">{t('cases.timeline.filterChats')}</option>
            <option value="custom">{t('cases.timeline.filterCustom')}</option>
          </select>
        </div>
        
        <button
          onClick={() => setShowAddEvent(!showAddEvent)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
        >
          + {t('cases.timeline.addEvent')}
        </button>
      </div>
      
      {/* Add Event Form */}
      {showAddEvent && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <input
              type="text"
              placeholder={t('cases.timeline.eventTitle')}
              value={newEventData.title}
              onChange={(e) => setNewEventData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <textarea
              placeholder={t('cases.timeline.eventDescription')}
              value={newEventData.description}
              onChange={(e) => setNewEventData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
              rows={2}
            />
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={newEventData.date}
                onChange={(e) => setNewEventData(prev => ({ ...prev, date: e.target.value }))}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button
                onClick={handleAddCustomEvent}
                disabled={!newEventData.title}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                {t('common.add')}
              </button>
              <button
                onClick={() => setShowAddEvent(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 transition-all shadow-sm"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{t('cases.timeline.noEvents')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center mb-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                  <div className="px-4 py-1 bg-white dark:bg-gray-800 rounded-full text-sm font-medium text-gray-600 dark:text-gray-400 shadow-sm border border-gray-200 dark:border-gray-700">
                    {date}
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                </div>
                
                {/* Events for this date */}
                <div className="space-y-4 relative">
                  {/* Connecting line */}
                  <div className="absolute left-5 top-8 bottom-0 w-0.5 bg-gradient-to-b from-gray-300 via-gray-200 to-transparent dark:from-gray-600 dark:via-gray-700"></div>
                  
                  {dateEvents.map((event, _index) => (
                    <div
                      key={event.id}
                      className="flex items-start space-x-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 border border-gray-100 dark:border-gray-700 relative"
                    >
                      {/* Event Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 ${event.color || 'bg-gray-500'} rounded-full flex items-center justify-center text-white shadow-lg z-10 ring-4 ring-white dark:ring-gray-800`}>
                        <span className="text-lg">{event.icon || '📌'}</span>
                      </div>
                      
                      {/* Event Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                              {event.title}
                            </h4>
                            {event.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 text-right">
                            <div className="font-medium">
                              {event.date.toLocaleTimeString('es-MX', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            {getRelativeTime(event.date) && (
                              <div className="mt-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full inline-block">
                                {getRelativeTime(event.date)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Future deadline warning */}
                        {event.type === 'deadline' && !event.metadata?.completed && event.date > new Date() && (
                          <div className="mt-3 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-xs text-orange-700 dark:text-orange-300 flex items-center space-x-1">
                            <span>⚠️</span>
                            <span>{t('cases.timeline.upcomingDeadline')}</span>
                          </div>
                        )}
                        
                        {/* Past deadline warning */}
                        {event.type === 'deadline' && !event.metadata?.completed && event.date < new Date() && (
                          <div className="mt-3 px-3 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center space-x-1">
                            <span>⚠️</span>
                            <span>{t('cases.timeline.overdueDeadline')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Timeline Summary */}
      <div className="mt-4 p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-sm border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{t('cases.timeline.totalEvents', { count: events.length })}</span>
          <span>{t('cases.timeline.lastUpdated', { 
            date: caseUpdatedAt.toLocaleDateString('es-MX'),
            time: caseUpdatedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
          })}</span>
        </div>
      </div>
    </div>
  );
}
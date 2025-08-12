import React, { useState, useEffect } from 'react';

interface HydrationBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  testId?: string;
}

/**
 * Wrapper component to handle SSR/hydration mismatches
 * Ensures client-only code doesn't run during SSR
 */
export function HydrationBoundary({ 
  children, 
  fallback = null,
  testId = 'hydration-boundary'
}: HydrationBoundaryProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated once we're on the client
    setIsHydrated(true);
  }, []);

  // During SSR and initial client render, show fallback
  if (!isHydrated) {
    return (
      <div data-testid={`${testId}-loading`} className="hydration-fallback">
        {fallback}
      </div>
    );
  }

  // After hydration, show the actual content
  return (
    <div data-testid={testId} className="hydration-boundary">
      {children}
    </div>
  );
}

/**
 * Hook to check if we're on the client side
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

/**
 * Hook to safely use localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    // Only access localStorage on client
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

/**
 * Loading skeleton component for better UX during hydration
 */
export function LoadingSkeleton({ 
  width = '100%', 
  height = '20px',
  className = ''
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      data-testid="loading-skeleton"
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      style={{ width, height }}
    />
  );
}

/**
 * Component-specific loading states
 */
export const LoadingStates = {
  ChatInterface: () => (
    <div className="flex flex-col h-full p-4 space-y-4">
      <LoadingSkeleton height="60px" />
      <div className="flex-1 space-y-3">
        <LoadingSkeleton height="40px" width="60%" />
        <LoadingSkeleton height="40px" width="80%" />
        <LoadingSkeleton height="40px" width="70%" />
      </div>
      <LoadingSkeleton height="80px" />
    </div>
  ),

  CaseManager: () => (
    <div className="flex h-full">
      <div className="w-80 p-4 space-y-4 border-r">
        <LoadingSkeleton height="40px" />
        <LoadingSkeleton height="40px" />
        <div className="space-y-2">
          <LoadingSkeleton height="60px" />
          <LoadingSkeleton height="60px" />
          <LoadingSkeleton height="60px" />
        </div>
      </div>
      <div className="flex-1 p-4">
        <LoadingSkeleton height="200px" />
      </div>
    </div>
  ),

  ProviderSetup: () => (
    <div className="p-6 space-y-6">
      <LoadingSkeleton height="40px" width="300px" />
      <LoadingSkeleton height="120px" />
      <div className="grid grid-cols-2 gap-4">
        <LoadingSkeleton height="100px" />
        <LoadingSkeleton height="100px" />
        <LoadingSkeleton height="100px" />
        <LoadingSkeleton height="100px" />
      </div>
    </div>
  ),

  CorpusSelector: () => (
    <div className="p-2">
      <LoadingSkeleton height="40px" />
    </div>
  ),

  DocumentRequestForm: () => (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <LoadingSkeleton height="40px" width="300px" />
      <LoadingSkeleton height="80px" />
      <LoadingSkeleton height="60px" />
      <LoadingSkeleton height="40px" width="150px" />
    </div>
  ),

  DocumentViewer: () => (
    <div className="p-4 space-y-4">
      <LoadingSkeleton height="40px" />
      <LoadingSkeleton height="400px" />
    </div>
  ),

  MobileMenu: () => (
    <div className="p-2">
      <LoadingSkeleton height="40px" />
    </div>
  ),

  WikiNavigation: () => (
    <div className="p-4 space-y-2">
      <LoadingSkeleton height="30px" />
      <LoadingSkeleton height="30px" />
      <LoadingSkeleton height="30px" />
    </div>
  ),

  NotificationCenter: () => (
    <div className="p-4 space-y-2">
      <LoadingSkeleton height="40px" />
      <LoadingSkeleton height="60px" />
      <LoadingSkeleton height="60px" />
    </div>
  ),

  DocumentRequestList: () => (
    <div className="p-4 space-y-3">
      <LoadingSkeleton height="80px" />
      <LoadingSkeleton height="80px" />
      <LoadingSkeleton height="80px" />
    </div>
  ),

  DocumentViewerWrapper: () => (
    <div className="p-4">
      <LoadingSkeleton height="500px" />
    </div>
  ),

  LegalGlossary: () => (
    <div className="p-4 space-y-2">
      <LoadingSkeleton height="40px" width="200px" />
      <LoadingSkeleton height="100px" />
    </div>
  ),

  LegislativeProcess: () => (
    <div className="p-4 space-y-3">
      <LoadingSkeleton height="40px" />
      <LoadingSkeleton height="200px" />
    </div>
  ),

  GovernmentStructure: () => (
    <div className="p-4 space-y-3">
      <LoadingSkeleton height="40px" />
      <LoadingSkeleton height="300px" />
    </div>
  ),

  ModerationPanel: () => (
    <div className="p-4 space-y-4">
      <LoadingSkeleton height="40px" />
      <LoadingSkeleton height="100px" />
      <LoadingSkeleton height="100px" />
    </div>
  ),

  ProviderRecommendation: () => (
    <div className="p-2">
      <LoadingSkeleton height="60px" />
    </div>
  ),

  LanguageSelector: () => (
    <div className="inline-block">
      <LoadingSkeleton height="40px" width="80px" />
    </div>
  ),

  ThemeToggle: () => (
    <div className="inline-block">
      <LoadingSkeleton height="40px" width="100px" />
    </div>
  ),
};
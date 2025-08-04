import { useStore } from '@nanostores/react';
import { t } from './utils';

export function useTranslation() {
  const translate = useStore(t);
  
  return {
    t: translate,
  };
}
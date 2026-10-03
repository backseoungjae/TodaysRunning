import { useEffect, useState, type ReactNode } from 'react';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';
import { ScreenContainer } from '@/shared/components/ScreenContainer';

import { getDatabase } from './database';

export function DatabaseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getDatabase().then(
      () => {
        if (active) setStatus('ready');
      },
      () => {
        if (active) setStatus('error');
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  if (status === 'ready') return children;
  return (
    <ScreenContainer>
      <AppText>
        {status === 'loading'
          ? '저장소를 준비하고 있어요.'
          : '저장소를 열 수 없어요. 다시 시도해 주세요.'}
      </AppText>
      {status === 'error' && (
        <AppButton
          label="다시 시도"
          onPress={() => {
            setStatus('loading');
            setAttempt((value) => value + 1);
          }}
        />
      )}
    </ScreenContainer>
  );
}

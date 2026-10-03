import { useRef, useState } from 'react';

import { useLocationPermission } from '@/shared/hooks/useLocationPermission';
import { confirmLocationPermission, confirmOpenAppSettings } from '@/shared/services/locationPermissionAlerts';
import { openAppSettings } from '@/shared/services/locationService';

export function useSettingsLocationPermission() {
  const permissionState = useLocationPermission();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const locked = useRef(false);

  async function perform(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (reason) {
      setActionError(reason instanceof Error && reason.message.includes('브라우저')
        ? reason.message : '위치 권한 설정을 열지 못했어요. 다시 시도해 주세요.');
    } finally {
      await permissionState.refresh();
      locked.current = false;
      setBusy(false);
    }
  }

  function toggle(enabled: boolean) {
    void perform(async () => {
      const current = permissionState.permission;
      if (!current) return;
      if (!enabled || !current.foreground.canAskAgain && !current.foreground.granted) {
        if (await confirmOpenAppSettings()) await openAppSettings();
      } else if (await confirmLocationPermission()) {
        await permissionState.request();
      }
    });
  }

  return {
    ...permissionState,
    busy,
    actionError,
    toggle,
    openSettings: () => { void perform(openAppSettings); },
  };
}

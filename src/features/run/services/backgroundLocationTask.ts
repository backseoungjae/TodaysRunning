import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { BACKGROUND_LOCATION_TASK } from '@/constants/gpsConfig';

import { processBackgroundLocations, reportBackgroundLocationError } from './backgroundLocationService';

// Imported by the root layout and tracker so headless execution can find the task before mounting any screen.
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: LocationObject[] }>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      await reportBackgroundLocationError('백그라운드 위치 신호를 받을 수 없어요. 위치 권한과 위치 서비스를 확인해 주세요.');
      return;
    }
    if (data && Array.isArray(data.locations)) await processBackgroundLocations(data.locations);
  });
}

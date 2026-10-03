import Constants from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { AppButton } from '@/shared/components/AppButton';
import { AppText } from '@/shared/components/AppText';

import type { RunMapProps } from '../types/runMapTypes';

export function RunMap({
  coordinates, currentLocation = null, showCurrentLocation = true,
  followCurrentLocation = true, interactive = true, fitRoute = false, onFollowChange,
}: RunMapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const initialCenter = currentLocation ?? coordinates[0];
  // Copy only when a new accepted coordinate is appended; timer updates do not rebuild the polyline.
  const route = useMemo(() => [...coordinates], [coordinates]);

  useEffect(() => {
    if (ready && fitRoute && route.length >= 2) map.current?.fitToCoordinates(route, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false,
    });
  }, [ready, fitRoute, route]);

  useEffect(() => {
    if (ready && followCurrentLocation && currentLocation) {
      map.current?.animateCamera({ center: currentLocation }, { duration: 400 });
    }
  }, [ready, followCurrentLocation, currentLocation]);

  function recenter() {
    if (!ready || !currentLocation) return;
    onFollowChange?.(true);
    map.current?.animateCamera({ center: currentLocation }, { duration: 400 });
  }
  function interact() {
    if (interactive) onFollowChange?.(false);
  }

  if (Platform.OS === 'android' && Constants.expoConfig?.extra?.maps?.androidConfigured !== true) return (
    <View style={styles.waiting}>
      <AppText>지도를 사용할 수 없어요.</AppText>
      <AppText variant="caption">지도 설정이 완료된 앱에서 다시 확인해 주세요. 러닝 거리와 경로 기록은 계속 사용할 수 있어요.</AppText>
    </View>
  );

  if (!initialCenter) return (
    <View style={styles.waiting}>
      <AppText>GPS 신호를 기다리고 있어요.</AppText>
      <AppText variant="caption">위치가 확인되면 지도와 러닝 경로가 표시됩니다.</AppText>
    </View>
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={map}
        testID="run-map"
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ ...initialCenter, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
        onMapReady={() => setReady(true)}
        onTouchStart={interact}
        onPanDrag={interact}
        onRegionChange={(_, details) => { if (details.isGesture) interact(); }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
      >
        {route.length >= 2 && <Polyline coordinates={route} strokeColor="#208AEF" strokeWidth={5} />}
        {showCurrentLocation && currentLocation && (
          <Marker coordinate={currentLocation} title="현재 위치" pinColor="#208AEF" tracksViewChanges={false} />
        )}
      </MapView>
      <View style={styles.controls}>
        <AppText variant="caption">{fitRoute ? '완료한 러닝 경로' : followCurrentLocation ? '현재 위치 따라가는 중' : '지도를 자유롭게 보는 중'}</AppText>
        {interactive && currentLocation && <AppButton label="현재 위치로" onPress={recenter} disabled={!ready} />}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { width: '100%', gap: 8 },
  map: { width: '100%', height: 360, borderRadius: 12 },
  controls: { gap: 8 },
  waiting: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 8 },
});

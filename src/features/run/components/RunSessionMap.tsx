import { useRunStore } from '../store/runStore';
import { RunMap } from './RunMap';

export function RunSessionMap() {
  const currentLocation = useRunStore((state) => state.currentLocation);
  const coordinates = useRunStore((state) => state.routeCoordinates);
  const followCurrentLocation = useRunStore((state) => state.isMapFollowing);
  const setMapFollowing = useRunStore((state) => state.setMapFollowing);
  return <RunMap coordinates={coordinates} currentLocation={currentLocation}
    followCurrentLocation={followCurrentLocation} onFollowChange={setMapFollowing} />;
}

import type { RunCoordinate } from '../store/runStore';

export type RunMapProps = {
  coordinates: readonly RunCoordinate[];
  currentLocation?: RunCoordinate | null;
  showCurrentLocation?: boolean;
  followCurrentLocation?: boolean;
  interactive?: boolean;
  fitRoute?: boolean;
  onFollowChange?: (following: boolean) => void;
};

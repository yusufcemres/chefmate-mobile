import { create } from 'zustand';

interface ScanHandoffStore {
  pendingPhotos: string[];
  autoStart: boolean;
  setPending: (uris: string[], autoStart?: boolean) => void;
  clear: () => void;
}

export const useScanHandoffStore = create<ScanHandoffStore>((set) => ({
  pendingPhotos: [],
  autoStart: false,
  setPending: (uris, autoStart = true) => set({ pendingPhotos: uris, autoStart }),
  clear: () => set({ pendingPhotos: [], autoStart: false }),
}));

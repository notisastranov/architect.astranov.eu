import { create } from "zustand";

export interface MapPin {
  id: string;
  lat: number;
  lon: number;
  label: string;
}

interface PinState {
  pins: MapPin[];
  add: (lat: number, lon: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const usePins = create<PinState>((set, get) => ({
  pins: [],
  add: (lat, lon) =>
    set({
      pins: [
        ...get().pins,
        { id: `pin-${Date.now().toString(36)}`, lat, lon, label: `P${get().pins.length + 1}` },
      ],
    }),
  remove: (id) => set({ pins: get().pins.filter((p) => p.id !== id) }),
  clear: () => set({ pins: [] }),
}));

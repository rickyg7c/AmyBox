import { create } from 'zustand';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Box {
  id: string;
  boxNumber: number;
  destinationRoom: string;
  items: string[];
  photoUrl: string; // base64 string
  createdAt: number;
  moveId: string;
}

interface BoxState {
  boxes: Box[];
  isLoaded: boolean;
  moveId: string | null;
  subscription: RealtimeChannel | null;
  loadBoxes: (moveId: string) => Promise<void>;
  addBox: (box: Omit<Box, 'id' | 'createdAt' | 'moveId'>) => Promise<void>;
  updateBox: (id: string, box: Partial<Box>) => Promise<void>;
  deleteBox: (id: string) => Promise<void>;
  setMoveId: (id: string) => void;
}

export const useBoxStore = create<BoxState>((setStore, getStore) => ({
  boxes: [],
  isLoaded: false,
  moveId: null,
  subscription: null,

  setMoveId: (id: string) => {
    setStore({ moveId: id });
    localStorage.setItem('boxscout-move-id', id);
  },

  loadBoxes: async (moveId: string) => {
    const supabase = getSupabase();
    setStore({ isLoaded: false, boxes: [] });

    if (!supabase) {
      console.warn('Supabase not configured. Falling back to local storage.');
      const localData = localStorage.getItem(`boxscout-boxes-${moveId}`);
      const boxes = localData ? JSON.parse(localData) : [];
      setStore({ boxes, isLoaded: true });
      return;
    }

    const existingSub = getStore().subscription;
    if (existingSub) await supabase.removeChannel(existingSub);

    setStore({ isLoaded: false, boxes: [] });

    // 1. Fetch initial data
    const { data, error } = await supabase
      .from('boxes')
      .select('*')
      .eq('move_id', moveId)
      .order('box_number', { ascending: true });

    if (error) {
      console.error('Error fetching boxes:', error);
      toast.error('Failed to load boxes from Supabase');
      setStore({ isLoaded: true });
      return;
    }

    // Map snake_case DB to camelCase frontend
    const mappedBoxes: Box[] = (data || []).map((row: any) => ({
      id: row.id,
      boxNumber: row.box_number,
      destinationRoom: row.destination_room,
      items: row.items || [],
      photoUrl: row.photo_url,
      createdAt: new Date(row.created_at).getTime(),
      moveId: row.move_id
    }));

    setStore({ boxes: mappedBoxes, isLoaded: true });

    // 2. Subscribe to changes
    const channel = supabase
      .channel(`move-${moveId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'boxes',
          filter: `move_id=eq.${moveId}`,
        },
        (payload) => {
          const currentBoxes = getStore().boxes;
          
          if (payload.eventType === 'INSERT') {
            const newBox = payload.new;
            // Prevent duplicates if already added optimistically
            if (currentBoxes.some(b => b.id === newBox.id)) return;

            const mappedBox: Box = {
              id: newBox.id,
              boxNumber: newBox.box_number,
              destinationRoom: newBox.destination_room,
              items: newBox.items || [],
              photoUrl: newBox.photo_url,
              createdAt: new Date(newBox.created_at).getTime(),
              moveId: newBox.move_id
            };
            setStore({ boxes: [...currentBoxes, mappedBox].sort((a, b) => a.boxNumber - b.boxNumber) });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            setStore({
              boxes: currentBoxes.map(b => b.id === updated.id ? {
                ...b,
                boxNumber: updated.box_number,
                destinationRoom: updated.destination_room,
                items: updated.items || [],
                photoUrl: updated.photo_url,
                // Keep existing fields if not in payload (though usually full row is sent)
              } : b).sort((a, b) => a.boxNumber - b.boxNumber)
            });
          } else if (payload.eventType === 'DELETE') {
            setStore({
              boxes: currentBoxes.filter(b => b.id !== payload.old.id)
            });
          }
        }
      )
      .subscribe();

    setStore({ subscription: channel });
  },

  addBox: async (boxData) => {
    const { moveId, boxes } = getStore();
    if (!moveId) return;

    const supabase = getSupabase();
    
    if (!supabase) {
      const newBox: Box = {
        id: Math.random().toString(36).substring(2, 9),
        ...boxData,
        createdAt: Date.now(),
        moveId
      };
      const newBoxes = [...boxes, newBox].sort((a, b) => a.boxNumber - b.boxNumber);
      setStore({ boxes: newBoxes });
      localStorage.setItem(`boxscout-boxes-${moveId}`, JSON.stringify(newBoxes));
      return;
    }

    const dbBox = {
      move_id: moveId,
      box_number: boxData.boxNumber,
      destination_room: boxData.destinationRoom,
      items: boxData.items,
      photo_url: boxData.photoUrl,
    };

    const { data, error } = await supabase.from('boxes').insert(dbBox).select().single();

    if (error) {
      console.error('Error adding box:', error);
      toast.error('Failed to add box');
    } else if (data) {
      // Update local state immediately so user sees it without waiting for realtime
      const mappedBox: Box = {
        id: data.id,
        boxNumber: data.box_number,
        destinationRoom: data.destination_room,
        items: data.items || [],
        photoUrl: data.photo_url,
        createdAt: new Date(data.created_at).getTime(),
        moveId: data.move_id
      };
      setStore({ boxes: [...boxes, mappedBox].sort((a, b) => a.boxNumber - b.boxNumber) });
    }
  },

  updateBox: async (id, updates) => {
    const { moveId, boxes } = getStore();
    const supabase = getSupabase();
    
    if (!supabase) {
      const newBoxes = boxes.map(b => b.id === id ? { ...b, ...updates } : b)
        .sort((a, b) => a.boxNumber - b.boxNumber);
      setStore({ boxes: newBoxes });
      if (moveId) localStorage.setItem(`boxscout-boxes-${moveId}`, JSON.stringify(newBoxes));
      return;
    }

    const dbUpdates: any = {};
    if (updates.boxNumber !== undefined) dbUpdates.box_number = updates.boxNumber;
    if (updates.destinationRoom !== undefined) dbUpdates.destination_room = updates.destinationRoom;
    if (updates.items !== undefined) dbUpdates.items = updates.items;
    if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;

    const { data, error } = await supabase
      .from('boxes')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating box:', error);
      toast.error('Failed to update box');
    } else if (data) {
      // Update local state immediately
      setStore({
        boxes: boxes.map(b => b.id === id ? {
          ...b,
          boxNumber: data.box_number,
          destinationRoom: data.destination_room,
          items: data.items || [],
          photoUrl: data.photo_url,
        } : b).sort((a, b) => a.boxNumber - b.boxNumber)
      });
    }
  },

  deleteBox: async (id) => {
    const { moveId, boxes } = getStore();
    const supabase = getSupabase();
    
    if (!supabase) {
      const newBoxes = boxes.filter(b => b.id !== id);
      setStore({ boxes: newBoxes });
      if (moveId) localStorage.setItem(`boxscout-boxes-${moveId}`, JSON.stringify(newBoxes));
      return;
    }

    const { error } = await supabase
      .from('boxes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting box:', error);
      toast.error('Failed to delete box');
    } else {
      // Update local state immediately
      setStore({
        boxes: boxes.filter(b => b.id !== id)
      });
    }
  },
}));

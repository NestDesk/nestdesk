// Shared types for the property setup wizard

export type RoomStatus =
  | "vacant"
  | "occupied"
  | "occupied_partial"
  | "maintenance"
  | "inactive";

export type OccupancyType = 1 | 2 | 3 | 4 | number;

export type Floor = {
  id: string;
  name: string;
  created_at: string;
};

export type Room = {
  id: string;
  floor_id: string;
  room_number: string;
  capacity: number;
  rent_amount: number | null;
  status: RoomStatus;
  created_at: string;
  occupancy?: number;
};

// A preview room not yet saved to DB (used in wizard stage 2)
export type DraftRoom = {
  localId: string; // temp uuid for React key
  floorId: string;
  roomNumber: string;
  capacity: number;
};

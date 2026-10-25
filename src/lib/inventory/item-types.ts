import {
  AppWindow,
  Archive,
  Bath,
  Bed,
  CookingPot,
  DoorOpen,
  Droplet,
  Grid2x2,
  LampCeiling,
  Laptop,
  Layers,
  Library,
  type LucideIcon,
  Package,
  RectangleVertical,
  Refrigerator,
  Shirt,
  ShowerHead,
  Sofa,
  Table,
  Toilet,
} from "lucide-react";

export const ITEM_TYPES = [
  { id: "window", label: "Window", icon: AppWindow },
  { id: "door", label: "Door", icon: DoorOpen },
  { id: "mirror", label: "Mirror", icon: RectangleVertical },
  { id: "floor", label: "Floor", icon: Grid2x2 },
  { id: "rug", label: "Rug", icon: Layers },
  { id: "light-fixture", label: "Light fixture", icon: LampCeiling },
  { id: "shelf", label: "Shelf", icon: Library },
  { id: "desk", label: "Desk", icon: Laptop },
  { id: "table", label: "Table", icon: Table },
  { id: "sofa", label: "Sofa", icon: Sofa },
  { id: "bed", label: "Bed", icon: Bed },
  { id: "closet", label: "Closet", icon: Shirt },
  { id: "cabinet", label: "Cabinet", icon: Archive },
  { id: "countertop", label: "Countertop", icon: CookingPot },
  { id: "appliance", label: "Appliance", icon: Refrigerator },
  { id: "sink", label: "Sink", icon: Droplet },
  { id: "toilet", label: "Toilet", icon: Toilet },
  { id: "shower", label: "Shower", icon: ShowerHead },
  { id: "bathtub", label: "Bathtub", icon: Bath },
  { id: "other", label: "Other", icon: Package },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

export type ItemTypeId = (typeof ITEM_TYPES)[number]["id"];

export const ITEM_TYPE_IDS = ITEM_TYPES.map((type) => type.id) as [ItemTypeId, ...ItemTypeId[]];

export function getItemType(id: string) {
  return ITEM_TYPES.find((type) => type.id === id);
}

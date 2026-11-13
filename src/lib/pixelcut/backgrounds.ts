import lake from "@/assets/pixelcut/bg-nature-lake.jpg";
import office from "@/assets/pixelcut/bg-office.jpg";
import studioGray from "@/assets/pixelcut/bg-studio-gray.jpg";
import studioWarm from "@/assets/pixelcut/bg-studio-warm.jpg";

export const PHOTO_BACKGROUNDS = [
  { id: "studio-gray", label: "Studio gray", category: "Studio", src: studioGray },
  { id: "studio-warm", label: "Warm studio", category: "Studio", src: studioWarm },
  { id: "office", label: "Office", category: "Office", src: office },
  { id: "lake", label: "Mountain lake", category: "Nature", src: lake },
] as const;

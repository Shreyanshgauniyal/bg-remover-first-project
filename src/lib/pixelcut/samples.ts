import sneaker from "@/assets/pixelcut/sample-sneaker.jpg";
import sneakerCut from "@/assets/pixelcut/sample-sneaker-cutout.webp";
import portrait from "@/assets/pixelcut/sample-portrait.jpg";
import portraitCut from "@/assets/pixelcut/sample-portrait-cutout.webp";
import dog from "@/assets/pixelcut/sample-dog.jpg";
import dogCut from "@/assets/pixelcut/sample-dog-cutout.webp";

// "after" images are real results from the same AI the app uses.
export const SAMPLES = [
  { id: "sneaker", label: "Product", filename: "sneaker.jpg", before: sneaker, after: sneakerCut },
  { id: "portrait", label: "Portrait", filename: "portrait.jpg", before: portrait, after: portraitCut },
  { id: "dog", label: "Pet", filename: "dog.jpg", before: dog, after: dogCut },
] as const;

/** Tatueringsstilar som artister kan tagga sin profil med. */
export const TATTOO_STYLES = [
  "Geometric",
  "Realism",
  "Traditional",
  "Neo-traditional",
  "Fine Line",
  "Blackwork",
  "Dotwork",
  "Watercolor",
  "Japanese",
  "Tribal",
  "Lettering",
  "Minimalist",
] as const;

export type TattooStyle = (typeof TATTOO_STYLES)[number];

export const PRICE_LEVELS: { value: number; label: string }[] = [
  { value: 1, label: "kr" },
  { value: 2, label: "kr kr" },
  { value: 3, label: "kr kr kr" },
  { value: 4, label: "kr kr kr kr" },
];

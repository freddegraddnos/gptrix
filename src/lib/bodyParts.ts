/** Body parts that can be selected before the camera starts in Live Try-On. */
export type TrackerKind = "hand" | "pose";

/** How the overlay should treat the body part. */
export type PlacementKind = "joint" | "surface" | "hand" | "free";

export type BodyPart = {
  id: string;
  label: string;
  /** Which landmark tracking best suits the body part. */
  tracker: TrackerKind;
  /** Flexible joint (arm/leg), flat surface (torso), or free placement. */
  placement: PlacementKind;
  /** Short placement tip shown in the overlay. */
  hint: string;
  /** Body parts that are hard to film on oneself. */
  hardToSelfFilm?: boolean;
};


export const SELF_FILM_TIP =
  "This body part can be hard to film yourself – ask someone else to hold the phone, or use the rear camera with the phone on a stand/against a mirror.";

export const BODY_PARTS: BodyPart[] = [
  {
    id: "forearm",
    label: "Forearm",
    tracker: "hand",
    placement: "joint",
    hint: "Keep the forearm in frame with the hand visible – tracking is based on the wrist.",
  },
  {
    id: "upperarm",
    label: "Upper arm",
    tracker: "pose",
    placement: "joint",
    hint: "Make sure the shoulder and elbow are visible in frame.",
  },
  {
    id: "calf",
    label: "Calf/lower leg",
    tracker: "pose",
    placement: "joint",
    hint: "Film the leg so the knee and ankle are visible.",
  },
  {
    id: "thigh",
    label: "Thigh",
    tracker: "pose",
    placement: "joint",
    hint: "Film the thigh so the hip and knee are visible.",
  },
  {
    id: "shoulder",
    label: "Shoulder",
    tracker: "pose",
    placement: "surface",
    hint: "Point the camera at the shoulder with the upper body in frame.",
    hardToSelfFilm: true,
  },
  {
    id: "chest",
    label: "Chest",
    tracker: "pose",
    placement: "surface",
    hint: "Hold the camera straight in front of the chest with both shoulders in frame.",
  },
  {
    id: "back",
    label: "Back",
    tracker: "pose",
    placement: "surface",
    hint: "Film the back straight from behind with both shoulders in frame.",
    hardToSelfFilm: true,
  },
  {
    id: "ankle",
    label: "Ankle/foot",
    tracker: "pose",
    placement: "joint",
    hint: "Point the camera at the foot with the ankle in frame.",
  },
  {
    id: "hand",
    label: "Hand/finger",
    tracker: "hand",
    placement: "hand",
    hint: "Keep the whole hand in frame with fingers slightly spread.",
  },
  {
    id: "neck",
    label: "Neck",
    tracker: "pose",
    placement: "surface",
    hint: "Tilt the head slightly forward and film the neck from behind.",
    hardToSelfFilm: true,
  },
  {
    id: "other",
    label: "Other (free placement)",
    tracker: "pose",
    placement: "free",
    hint: "Free placement – move the motif manually in the image.",
  },
];

export const getBodyPart = (id: string | null | undefined) =>
  BODY_PARTS.find((p) => p.id === id) ?? null;

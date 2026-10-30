/** Multi-pose AR: modes/body parts captured with the same calibration. */
export type Pose = {
  id: string;
  label: string;
  hint: string;
};

export const POSES: Pose[] = [
  {
    id: "straight",
    label: "Straight arm",
    hint: "Hold your arm straight in front of you, palm facing down.",
  },
  {
    id: "bent",
    label: "Bent arm",
    hint: "Bend your elbow ~90° and point the camera at your forearm.",
  },
  {
    id: "side",
    label: "From the side",
    hint: "Turn your arm so you see the side of your forearm in profile.",
  },
  {
    id: "palm-up",
    label: "Palm up",
    hint: "Turn your palm upward — the inside of the forearm is visible.",
  },
  {
    id: "palm-down",
    label: "Palm down",
    hint: "Turn your palm downward — the outside of the forearm is visible.",
  },
  {
    id: "back",
    label: "Back",
    hint: "Use a mirror or ask someone to film your back straight from behind.",
  },
  {
    id: "ribs",
    label: "Ribs",
    hint: "Raise your arm and point the camera at your ribcage side.",
  },
  {
    id: "thigh",
    label: "Thigh",
    hint: "Sit or stand upright — film the thigh from the front or side.",
  },
  {
    id: "calf",
    label: "Calf",
    hint: "Film the calf from behind with the leg lightly flexed.",
  },
  {
    id: "foot",
    label: "Foot",
    hint: "Point the camera straight down at the top of the foot.",
  },
  {
    id: "nape",
    label: "Nape",
    hint: "Tilt your head slightly forward and film the nape from behind.",
  },
  {
    id: "throat",
    label: "Throat",
    hint: "Tilt your head slightly back and film the front of your neck.",
  },
];

export const poseLabel = (id: string | null | undefined) =>
  POSES.find((p) => p.id === id)?.label ?? null;

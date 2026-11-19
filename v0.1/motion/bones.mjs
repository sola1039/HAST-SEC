const body = ["hips", "spine", "chest", "upperChest", "neck", "head", "leftEye", "rightEye", "jaw"];
const limbs = ["Shoulder", "UpperArm", "LowerArm", "Hand", "UpperLeg", "LowerLeg", "Foot", "Toes"];
const fingers = ["Thumb", "Index", "Middle", "Ring", "Little"];
export const BONE_NAMES = Object.freeze([
  ...body,
  ...["left", "right"].flatMap(side => [
    ...limbs.map(part => side + part),
    ...fingers.flatMap(finger => (finger === "Thumb"
      ? ["Metacarpal", "Proximal", "Distal"]
      : ["Proximal", "Intermediate", "Distal"]).map(part => side + finger + part))
  ])
]);
export const REQUIRED_BONES = Object.freeze([
  "hips", "spine", "head",
  ...["left", "right"].flatMap(side =>
    ["UpperArm", "LowerArm", "Hand", "UpperLeg", "LowerLeg", "Foot"].map(part => side + part))
]);
export const EXPRESSION_NAMES = Object.freeze(["aa", "ih", "ou", "ee", "oh"]);
export function canonicalBoneName(name, vrmVersion) {
  if (vrmVersion === "0") {
    return name.replace(/ThumbProximal$/, "ThumbMetacarpal")
      .replace(/ThumbIntermediate$/, "ThumbProximal");
  }
  return name;
}

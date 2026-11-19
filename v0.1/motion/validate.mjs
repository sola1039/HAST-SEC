import {MOTION_SCHEMA} from "./schema.mjs";
import {validateSchema, fail} from "./schema_validate.mjs";

export function validateMotion(clip) {
  validateSchema(clip, MOTION_SCHEMA);
  if (!clip.name.trim()) fail("$.name", "名称不能为空白");
  if (!clip.source.id.trim()) fail("$.source.id", "来源标识不能为空白");
  const checkLength = (values, expected, path) => {
    if (values.length !== expected) fail(path, "通道数量与排列定义不一致");
  };
  let previousTime = -1;
  for (let index = 0; index < clip.frames.length; index++) {
    const frame = clip.frames[index];
    const path = "$.frames[" + index + "]";
    if ((index === 0 && frame.time !== 0) || frame.time <= previousTime) {
      fail(path + ".time", "首帧必须为0, 后续时间必须严格递增");
    }
    previousTime = frame.time;
    checkLength(frame.local_rotations, clip.bone_order.length, path + ".local_rotations");
    checkLength(frame.expressions, clip.expression_order.length, path + ".expressions");
    for (let bone = 0; bone < frame.local_rotations.length; bone++) {
      if (Math.abs(Math.hypot(...frame.local_rotations[bone]) - 1) > 1e-4) {
        fail(path + ".local_rotations[" + bone + "]", "四元数必须归一化, 不自动改写输入");
      }
    }
    if (frame.confidence) {
      checkLength(frame.confidence.bones, clip.bone_order.length, path + ".confidence.bones");
      checkLength(frame.confidence.expressions, clip.expression_order.length, path + ".confidence.expressions");
    }
  }
  return clip;
}

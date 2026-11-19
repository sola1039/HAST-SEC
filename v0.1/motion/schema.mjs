import {BONE_NAMES, EXPRESSION_NAMES} from "./bones.mjs";

export const SPACE = Object.freeze({
  handedness: "right", up: "+Y", forward: "+Z",
  position_unit: "meter", time_unit: "second", quaternion_order: "xyzw",
  rotation_space: "normalized_local_rest_delta",
  root_space: "normalized_root_rest_offset"
});
const number = {type: "number"};
const unit = {type: "number", minimum: 0, maximum: 1};
const nullableUnit = {...unit, type: ["number", "null"]};
const vector = size => ({type: "array", minItems: size, maxItems: size, items: number});
const array = (items, maximum, minimum = 0) => ({
  type: "array", minItems: minimum, maxItems: maximum, items
});
const object = (properties, required = Object.keys(properties)) => ({
  type: "object", properties, required, additionalProperties: false
});
const text = maximum => ({type: "string", minLength: 1, maxLength: maximum});
const asset = {
  ...text(1024),
  pattern: "^(?!/)(?!.*[\\\\:])(?!.*(^|/)[.][.](/|$))[^\\u0000-\\u001f]+$",
  description: "实验台根目录下的相对路径, 使用正斜杠. 只记录引用, 读写模块不加载媒体."
};
const frame = object({
  time: {...number, minimum: 0, description: "秒, 首帧为0, 后续严格递增. 以时间戳为准, 不假定固定帧率."},
  root_position: {
    ...vector(3),
    description: "相对标准骨架参考髋位置的位移, 在固定根坐标系下以米表示. 不再叠加第二条场景根位移."
  },
  local_rotations: {
    ...array(vector(4), 55, 1),
    description: "按bone_order排列的归一化局部旋转, 相对标准T姿态. 单位四元数, xyzw顺序, 允许误差1e-4. 整体朝向由hips旋转承担."
  },
  expressions: {...array(unit, 5), description: "按expression_order排列的独立口型权重."},
  contacts: object({
    leftFoot: {type: ["boolean", "null"]}, rightFoot: {type: ["boolean", "null"]}
  }),
  confidence: {
    ...object({root: nullableUnit, bones: array(nullableUnit, 55), expressions: array(nullableUnit, 5)}),
    description: "提取质量估计, 不是动作幅度或评分控制器概率. null表示未知."
  }
}, ["time", "root_position", "local_rotations", "expressions"]);
export const MOTION_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "本地动作实验台格式第一版",
  description: "跨提取, 训练与播放的JSON交换格式. 单位和空间固定, 来源标识用于按来源划分数据. 动态数组对应关系另由validateMotion校验. 负零按JSON规则保存为零, 不改变姿态数值.",
  ...object({
    format: {type: "string", const: "lumen-motion"},
    version: {type: "integer", const: 1},
    name: text(256),
    space: object(Object.fromEntries(Object.entries(SPACE).map(([key, value]) => [key, {type: "string", const: value}]))),
    source: object({
      id: text(128), kind: {type: "string", enum: ["validation", "video", "generated", "capture", "reference"]},
      uri: asset
    }, ["id", "kind"]),
    bone_order: {
      ...array({type: "string", enum: BONE_NAMES}, 55, 1), uniqueItems: true,
      description: "角色解剖学左右, 使用新版标准骨骼名称. 不含列出的骨骼在完整姿态回放中保持参考姿态, 不沿用上一帧残留."
    },
    expression_order: {...array({type: "string", enum: EXPRESSION_NAMES}, 5), uniqueItems: true},
    action_ids: {...array(text(128), 16), uniqueItems: true},
    audio: object({uri: asset, offset_seconds: {...number, minimum: 0, description: "音频时间 = 动作时间 + 此偏移."}}),
    frames: {...array(frame, 18000, 1), description: "每帧均为完整的已声明通道快照, 不使用增量或隐式补帧. contacts和confidence缺失均表示未知."}
  }, ["format", "version", "name", "space", "source", "bone_order", "expression_order", "frames"])
};

import {Quaternion, Euler, MathUtils} from "three";
import {SPACE} from "./schema.mjs";
import {validateMotion} from "./validate.mjs";
import {bindPoseWriter} from "./pose_frame.mjs";
import {syncAvatar} from "./avatar_sync.mjs";

export class PoseController {
  constructor(vrm, profile) {
    this.vrm = vrm; this.profile = profile; this.humanoid = vrm.humanoid;
    this.direction = profile.vrm_version === "0" ? -1 : 1;
    this.expressions = Object.keys(profile.expression_presets);
    if (profile.bone_order.some(name => !this.humanoid.getNormalizedBoneNode(name))) {
      throw new Error("角色标准骨架与配置不一致.");
    }
  }
  adapt(values) {
    return values.map((value, index) => {
      const result = index === 0 || index === 2 ? value * this.direction : value;
      return result === 0 ? 0 : result;
    });
  }
  node(name) {
    if (!this.profile.bone_order.includes(name)) throw new Error("无法控制该骨骼.");
    return this.humanoid.getNormalizedBoneNode(name);
  }
  vector(values) {
    if (!Array.isArray(values) || values.length !== 3 || values.some(value => !Number.isFinite(value))) {
      throw new Error("控制参数必须是三个有限数值.");
    }
  }
  sync() {
    syncAvatar(this.vrm);
  }
  setRotation(name, angles) {
    this.node(name); this.vector(angles);
    const rotation = new Quaternion().setFromEuler(new Euler(...angles.map(MathUtils.degToRad), "XYZ"));
    this.humanoid.setNormalizedPose({[name]: {rotation: this.adapt(rotation.toArray())}});
    this.sync();
  }
  getAngles(name) {
    this.node(name);
    const rotation = this.humanoid.getNormalizedPose()[name].rotation;
    const euler = new Euler().setFromQuaternion(new Quaternion().fromArray(this.adapt(rotation)), "XYZ");
    return [euler.x, euler.y, euler.z].map(MathUtils.radToDeg);
  }
  setRoot(position) {
    this.vector(position);
    this.humanoid.setNormalizedPose({hips: {position: this.adapt(position)}});
    this.sync();
  }
  setExpression(name, value) {
    if (!this.expressions.includes(name) || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error("口型名称或权重无效.");
    }
    if (!this.vrm.expressionManager?.getExpression(name)) throw new Error("角色不支持该口型.");
    this.vrm.expressionManager.setValue(name, value); this.sync();
  }
  resetBone(name) {
    this.setRotation(name, [0, 0, 0]);
    if (name === "hips") this.setRoot([0, 0, 0]);
  }
  reset() {
    this.humanoid.resetNormalizedPose();
    for (const name of this.expressions) this.vrm.expressionManager?.setValue(name, 0);
    this.sync();
  }
  capture() {
    const pose = this.humanoid.getNormalizedPose();
    return validateMotion({
      format: "lumen-motion", version: 1, name: "手动骨骼姿态",
      space: {...SPACE}, source: {id: "manual-pose", kind: "reference"},
      bone_order: [...this.profile.bone_order], expression_order: [...this.expressions],
      frames: [{
        time: 0, root_position: this.adapt(pose.hips.position),
        local_rotations: this.profile.bone_order.map(name => this.adapt(pose[name].rotation)),
        expressions: this.expressions.map(name => this.vrm.expressionManager?.getValue(name) ?? 0)
      }]
    });
  }
  applyFrame(clip, index) {
    validateMotion(clip);
    if (!Number.isInteger(index) || !clip.frames[index]) throw new Error("动作帧不存在.");
    bindPoseWriter(this, clip.bone_order, clip.expression_order)(clip.frames[index]);
  }
  bindSampler(sampler) {
    const write = bindPoseWriter(this, sampler.boneOrder, sampler.expressionOrder);
    return (time, bridgeProgress = null) => write(bridgeProgress === null ? sampler.sample(time) : sampler.bridge(bridgeProgress));
  }
}

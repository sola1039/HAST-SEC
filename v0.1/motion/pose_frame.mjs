export function bindPoseWriter(controller, bones, expressions) {
  if (bones.some(name => !controller.profile.bone_order.includes(name))
    || expressions.some(name => !controller.expressions.includes(name)
      || !controller.vrm.expressionManager?.getExpression(name))) throw new Error("动作包含角色不支持的通道.");
  const boneOrder = [...bones], expressionOrder = [...expressions];
  return frame => {
    const pose = Object.fromEntries(boneOrder.map((name, index) =>
      [name, {rotation:controller.adapt(frame.local_rotations[index])}]));
    pose.hips ??= {}; pose.hips.position = controller.adapt(frame.root_position);
    controller.humanoid.resetNormalizedPose();
    for (const name of controller.expressions) controller.vrm.expressionManager?.setValue(name, 0);
    controller.humanoid.setNormalizedPose(pose);
    expressionOrder.forEach((name, index) => controller.vrm.expressionManager.setValue(name, frame.expressions[index]));
    controller.sync();
  };
}

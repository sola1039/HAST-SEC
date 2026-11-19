// 按VRM运行库的顺序同步人形、表情和附加骨骼约束.
// 姿态求解会多次同步同一帧, 此处不推进弹簧物理时间.
export function syncAvatar(vrm) {
  vrm.update(0);
  vrm.scene.updateMatrixWorld(true);
}

const $=id=>document.getElementById(id);
export const motionName=key=>key.replace(/^left-/,'左侧-').replace(/^right-/,'右侧-').replace(/^body-/,'全身-');
export function trainingPanel(){}
export function panels(state){
 $('control').textContent=state.seconds.toFixed(2)+'秒 / '+(state.playing?'运行中':'已暂停');
}

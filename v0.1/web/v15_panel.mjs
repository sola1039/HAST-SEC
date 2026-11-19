export function candidatePanel(){
 document.title='HAST-SEC v0.1';
 document.querySelector('header h1').textContent='HAST-SEC';
 document.querySelector('header p').textContent='中文交互 / 连续运动 / 实时稳定优化 / v0.1';
 const input=document.getElementById('text');input.value='你好';input.placeholder='和角色聊天, 或说: 挥挥左手';
 input.parentElement.firstChild.textContent='与角色聊天';
 document.getElementById('send').textContent='发送';
}

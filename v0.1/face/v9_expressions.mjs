const pair=(name,value)=>({[name+'Left']:value,[name+'Right']:value});
export const EXPRESSION_LABELS={neutral:'自然',friendly:'亲切',happy:'开心',surprised:'惊讶',confused:'困惑',shy:'害羞',angry:'生气',sad:'难过',pout:'鼓脸',admire:'惊喜',loving:'喜爱',heart:'爱心眼',star:'星星眼'};
export const EXPRESSION_POSES={
 neutral:{mouthSmile:.08,...pair('browSmile',.04)},
 friendly:{mouthSmile:.45,eyeSmile:.12,...pair('browSmile',.2),blush:.08},
 happy:{mouthSmile:.75,eyeSmile:.65,...pair('browSmile',.45),blush:.18},
 surprised:{...pair('eyeWide',.8),...pair('browUp',.65),mouthPanic:.35},
 confused:{...pair('browWorry',.45),browUpRight:.25,mouthPanic:.12,eyeWorry:.18},
 shy:{blush:.7,...pair('browShy',.65),mouthSmile:.35,eyeSmile:.25},
 angry:{mouthAngry:.5,eyeAngry:.65,...pair('browAngry',.75)},
 sad:{mouthPanic:.45,eyeWorry:.5,...pair('browWorry',.75),tears:.18},
 pout:{cheekPuff:.65,mouthAngry:.15,...pair('browDown',.15)},
 admire:{...pair('eyeWide',.3),mouthSmile:.45,...pair('browUp',.2)},
 loving:{blush:.45,mouthSmile:.5,...pair('browSmile',.2)},
 heart:{heartEyes:.6,blush:.45,mouthSmile:.5},
 star:{starEyes:.6,...pair('eyeWide',.3),mouthSmile:.45,...pair('browUp',.2)}
};
export function expressionFromText(text){
 const rules=[['neutral',/不要爱心眼|不要星星眼|关闭特效/],['heart',/爱心眼|桃心眼/],['star',/星星眼/],['angry',/生气|愤怒|可恶|讨厌/],['sad',/难过|伤心|悲伤|失落|不开心/],['shy',/害羞|脸红|不好意思/],['surprised',/惊讶|震惊|没想到/],['confused',/困惑|疑惑|不明白|为什么/],['loving',/喜欢|喜爱/],['admire',/惊喜|崇拜/],['pout',/鼓脸|鼓腮|嘟嘴/],['neutral',/自然|平静|恢复|重置|不要笑/],['happy',/开心|高兴|笑|快乐/],['friendly',/亲切|谢谢|你好/]];
 return rules.find(([,pattern])=>pattern.test(text))?.[0]??null;
}

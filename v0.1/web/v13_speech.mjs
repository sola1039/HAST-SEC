export function localSpeech(event,status){
 let sequence=0,timer=null;
 const engine=window.speechSynthesis;
 function stop(){sequence++;clearTimeout(timer);event(false);engine?.cancel();}
 async function speak(text){
  stop();const ticket=sequence;if(!engine||!window.SpeechSynthesisUtterance){status('浏览器不支持本地朗读.');return;}
  let voices=engine.getVoices();if(!voices.length){await new Promise(resolve=>{const done=()=>{clearTimeout(wait);engine.removeEventListener('voiceschanged',done);resolve();},wait=setTimeout(done,700);engine.addEventListener('voiceschanged',done);});voices=engine.getVoices();}
  if(ticket!==sequence)return;const voice=voices.find(v=>v.localService&&v.lang.startsWith('zh'));
  if(!voice){status('没有可用的本机中文语音, 已保留文字回复.');return;}
  const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;
  utterance.onstart=()=>{if(ticket===sequence)event(true);};const done=()=>{if(ticket===sequence){clearTimeout(timer);event(false);}};
  utterance.onend=done;utterance.onerror=done;timer=setTimeout(()=>{if(ticket===sequence)stop();},60000);engine.speak(utterance);
 }
 return {speak,stop};
}

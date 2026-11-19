// 按字素分页, 保留emoji组合、换行和全部文字. 每页恰好提供三行位置.
export function dialoguePages(text,width,measure){
 if(typeof text!=='string'||!Number.isFinite(width)||width<=0)throw Error('气泡文本或宽度无效.');
 const lines=[],segmenter=new Intl.Segmenter('zh',{granularity:'grapheme'});let line='';
 for(const {segment}of segmenter.segment(text)){
  if(segment==='\n'||segment==='\r\n'){lines.push(line+segment);line='';continue;}
  if(line&&measure(line+segment)>width){lines.push(line);line='';}line+=segment;
 }
 if(line||!lines.length)lines.push(line);const pages=[];
 for(let i=0;i<lines.length;i+=3)pages.push(lines.slice(i,i+3));return pages;
}

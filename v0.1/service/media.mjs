import {createReadStream} from "node:fs";
export function parseRange(header,size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error("读取范围无效.");
  let start, end;
  if (!match[1]) {const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new Error("读取范围无效."); start = Math.max(0,size-suffix); end = size-1;}
  else {start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]),size-1) : size-1;}
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start < 0 || end < start) throw new Error("读取范围无效.");
  return [start,end];
}
export function streamMedia(request,response,path,size,headers) {
  let range;
  try {range = parseRange(request.headers.range,size);}
  catch {response.writeHead(416,{"content-range":"bytes */" + size}); response.end(); return;}
  const extra = range ? {"content-range":`bytes ${range[0]}-${range[1]}/${size}`,"content-length":range[1]-range[0]+1} : {"content-length":size};
  response.writeHead(range ? 206 : 200,{...headers,...extra,"accept-ranges":"bytes"});
  if (request.method === "HEAD") return response.end();
  const stream = createReadStream(path,range ? {start:range[0],end:range[1]} : undefined);
  stream.on("error",() => response.destroy()); response.on("close",() => stream.destroy()); stream.pipe(response);
}

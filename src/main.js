import './style.css';
import {validateFile,validateMode,mixChannels,formatTurns,safeBasename,SAMPLE_RATE} from './core.js';
import {downloadText} from './export.js';

const $=id=>document.getElementById(id);
let english=false,busy=false,loading=false,decoded=null,filename='transcript',objectUrl=null,worker=null;
const downloads=new Map();
let currentStatus={zh:'选择一个文件开始。',en:'Choose a file to begin.',error:false};
for (const el of document.querySelectorAll('[data-en]')) el.dataset.zh=el.textContent;
const tr=(zh,en)=>english?en:zh;
function status(zh,en,error=false){currentStatus={zh,en,error};$('status').textContent=tr(zh,en);$('status').classList.toggle('error',error);}
function refreshExports(){const has=$('transcript').value.length>0;document.querySelectorAll('[data-format]').forEach(b=>b.disabled=!has);$('copy').disabled=!has;$('count').textContent=has?`${$('transcript').value.length} ${tr('字','characters')}`:'';}
function setBusy(value){busy=value;$('start').disabled=value||loading||!decoded;$('cancel').hidden=!value;$('audio-file').disabled=value;for(const id of ['language','quality','speakers','device'])$(id).disabled=value||(id==='quality'&&$('speakers').value==='auto');$('dropzone').style.opacity=value?'.5':'1';}
function hint(){const mode=$('speakers').value;$('quality').disabled=busy||mode==='auto';$('speaker-hint').textContent=mode==='auto'?tr('实验功能：60 秒以内，最多 3 位说话人；标签可能有误，需校对。此模式使用标准识别档位。','Experimental: up to 60 seconds and 3 speakers. Labels can be wrong; please check them. Uses the standard recognition model.'):mode==='channels'?tr('仅当左、右声道分别录了两位说话人时使用。普通立体声录音不能据此区分人物。','Use only if each stereo channel contains a different speaker. Ordinary stereo audio does not separate people.'):tr('直接输出识别文字，不添加说话人或时间标签。','Plain recognized text, without speaker labels or timestamps.');}
$('locale').onclick=()=>{english=!english;document.documentElement.lang=english?'en':'zh-CN';for(const el of document.querySelectorAll('[data-en]'))el.textContent=english?el.dataset.en:el.dataset.zh;$('locale').textContent=english?'中文':'English';$('transcript').placeholder=tr('识别结果会出现在这里。不会自动总结、翻译或润色。','Your transcription appears here. No summaries, translation or rewriting.');status(currentStatus.zh,currentStatus.en,currentStatus.error);hint();refreshExports();};
$('speakers').onchange=hint;hint();

async function choose(file){
  if(busy||loading)return;
  loading=true;setBusy(false);$('transcript').value='';refreshExports();decoded=null;
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}$('player').hidden=true;$('file-info').hidden=true;
  try{
    validateFile(file);status('正在读取录音…','Reading audio…');
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)throw new Error('This browser does not support audio decoding. Try current Chrome or Edge.');
    const context=new Context({sampleRate:SAMPLE_RATE});let buffer;
    try{buffer=await context.decodeAudioData(await file.arrayBuffer());}catch{throw new Error('Unable to decode this file. Try an unprotected MP3 or M4A (AAC), or convert it to WAV.');}finally{await context.close();}
    if(buffer.sampleRate!==SAMPLE_RATE)throw new Error('Audio decoding did not produce 16 kHz. Try current Chrome or Edge.');
    validateMode('none',buffer.duration,buffer.numberOfChannels);
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice());
    decoded={audio:mixChannels(channels),channels,duration:buffer.duration};filename=safeBasename(file.name);
    $('file-info').textContent=`${file.name} · ${Math.floor(buffer.duration/60)}:${String(Math.floor(buffer.duration%60)).padStart(2,'0')} · ${buffer.numberOfChannels} ${tr('声道','channel(s)')}`;$('file-info').hidden=false;
    objectUrl=URL.createObjectURL(file);$('player').src=objectUrl;$('player').hidden=false;
    status('已准备好。点击开始转文字。','Ready. Click Transcribe.');
  }catch(e){status(`无法读取：${e.message}`,e.message,true);}finally{loading=false;setBusy(false);}
}
$('audio-file').onchange=e=>choose(e.target.files?.[0]);
for(const type of ['dragover','dragleave','drop'])$('dropzone').addEventListener(type,e=>{e.preventDefault();$('dropzone').classList.toggle('over',type==='dragover');if(type==='drop')choose(e.dataTransfer.files?.[0]);});
function makeWorker(){
  const instance=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  instance.onerror=e=>finishError(e.message||'The recognition worker could not start.');
  instance.onmessage=({data})=>{
    if(data.type==='download'){
      downloads.set(data.file,{loaded:data.loaded,total:data.total});let loaded=0,total=0;for(const d of downloads.values())if(Number.isFinite(d.total)){loaded+=d.loaded;total+=d.total;}
      $('progress').hidden=false;if(total){$('progress').max=total;$('progress').value=loaded;}
      status(`正在下载模型：${Math.round(loaded/1048576)} / ${Math.round(total/1048576)} MB` ,`Downloading model: ${Math.round(loaded/1048576)} / ${Math.round(total/1048576)} MB`);
    }else if(data.type==='stage'){
      $('progress').hidden=false;$('progress').removeAttribute('value');
      const messages={model:['加载模型… 首次使用需要下载，请稍候。','Loading model… First use requires a download.'],transcribing:['正在识别，请保持页面打开…','Transcribing. Keep this tab open…'],speakers:['正在区分说话人…','Identifying speakers…'],right:['正在识别右声道…','Transcribing the right channel…'],fallback:['GPU 不可用，正在改用 CPU…','GPU unavailable. Falling back to CPU…']};const msg=messages[data.stage];if(msg)status(...msg);
    }else if(data.type==='complete'){
      const result=data.result;$('transcript').value=result.turns?formatTurns(result.turns,english):result.text||'';refreshExports();$('progress').hidden=true;setBusy(false);
      status($('transcript').value?`识别完成（${result.device==='wasm'?'CPU':'GPU'}）。可直接导出，或自行校对。`:'没有识别到文字。请检查录音或更换语言。',$('transcript').value?`Done (${result.device==='wasm'?'CPU':'GPU'}). Download directly or check the text.`:'No text recognized. Check the recording or choose another language.');
    }else if(data.type==='error')finishError(data.message);
  };
  return instance;
}
function finishError(message){status(`识别未完成：${message}`,`Transcription failed: ${message}`,true);$('progress').hidden=true;setBusy(false);if(worker){worker.terminate();worker=null;}}
$('start').onclick=()=>{
  if(!decoded||busy)return;
  try{validateMode($('speakers').value,decoded.duration,decoded.channels.length);}catch(e){status(e.message,e.message,true);return;}
  setBusy(true);$('transcript').value='';refreshExports();downloads.clear();status('正在启动识别…','Starting recognition…');
  try{worker ||= makeWorker();worker.postMessage({audio:decoded.audio,channels:$('speakers').value==='channels'?decoded.channels:[],language:$('language').value,quality:$('quality').value,speakers:$('speakers').value,device:$('device').value});}catch(e){finishError(e.message);}
};
$('cancel').onclick=()=>{worker?.terminate();worker=null;$('progress').hidden=true;setBusy(false);status('已取消；可以重新开始。','Cancelled. You can start again.');};
$('transcript').oninput=refreshExports;
document.querySelectorAll('[data-format]').forEach(button=>button.onclick=()=>{try{downloadText($('transcript').value,button.dataset.format,filename);}catch(e){status(e.message,e.message,true);}});
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('transcript').value);status('已复制。','Copied.');}catch{status('复制失败，请选中文字后手动复制。','Copy failed. Select the text and copy manually.',true);}};
window.addEventListener('beforeunload',()=>{worker?.terminate();if(objectUrl)URL.revokeObjectURL(objectUrl);});

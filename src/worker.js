import { pipeline, env, AutoProcessor, AutoModelForAudioFrameClassification } from '@huggingface/transformers';
import { SAMPLE_RATE, validateMode, labelWords, stereoTurns } from './core.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1; // Works on static hosts without isolation headers.
const cache = new Map();
let segmentation;
let active = false;
function send(type, data = {}) { self.postMessage({type,...data}); }
function progress(event) { if (event.status === 'progress') send('download',{file:event.file,loaded:event.loaded,total:event.total}); }
async function transcriber(quality, device, speakers) {
  const id = speakers === 'auto' ? 'onnx-community/whisper-base_timestamped' : `onnx-community/whisper-${quality}`;
  const key = `${id}:${device}`;
  if (!cache.has(key)) {
    send('stage',{stage:'model'});
    const promise = pipeline('automatic-speech-recognition', id, {
      device, dtype:device === 'webgpu' ? {encoder_model:'fp32',decoder_model_merged:'q4'} : 'q8', progress_callback:progress,
    });
    cache.set(key,promise);
    try {await promise;} catch(e) {cache.delete(key);throw e;}
  }
  return cache.get(key);
}
async function segment(audio) {
  send('stage',{stage:'speakers'});
  if (!segmentation) {
    segmentation = Promise.all([
      AutoProcessor.from_pretrained('onnx-community/pyannote-segmentation-3.0',{progress_callback:progress}),
      AutoModelForAudioFrameClassification.from_pretrained('onnx-community/pyannote-segmentation-3.0',{device:'wasm',dtype:'fp32',progress_callback:progress}),
    ]);
    try {await segmentation;} catch(e) {segmentation=null;throw e;}
  }
  const [processor,model] = await segmentation;
  const {logits} = await model(await processor(audio));
  return processor.post_process_speaker_diarization(logits,audio.length)[0].map(s=>({...s,label:model.config.id2label[s.id]}));
}
async function run(data,device) {
  const {audio,channels,language,quality,speakers} = data;
  validateMode(speakers,audio.length / SAMPLE_RATE,channels.length);
  const asr = await transcriber(quality,device,speakers);
  send('stage',{stage:'transcribing',device});
  const options={task:'transcribe',language,chunk_length_s:30,stride_length_s:5,return_timestamps:speakers === 'auto' ? 'word' : true,
    chunk_callback:chunk=>send('chunk',{text:chunk.text || ''})};
  if (speakers === 'channels') {
    const left = await asr(channels[0],options);
    send('stage',{stage:'right'});
    const right = await asr(channels[1],options);
    return {turns:stereoTurns(left,right),device};
  }
  const transcript = await asr(audio,options);
  if (speakers === 'auto') {
    const segments = await segment(audio);
    if (!transcript.chunks?.length) throw new Error('The model did not return word timestamps. Try without speaker labels.');
    return {turns:labelWords(transcript.chunks,segments,audio.length/SAMPLE_RATE),device};
  }
  return {text:transcript.text,device};
}
self.onmessage = async ({data}) => {
  if (active) return;
  active = true;
  try {
    let device=data.device;
    if (device === 'auto') {
      try {device = await navigator.gpu?.requestAdapter() ? 'webgpu' : 'wasm';} catch {device='wasm';}
    }
    let result;
    try {result=await run(data,device);} catch(e) {
      if (data.device !== 'auto' || device !== 'webgpu') throw e;
      send('stage',{stage:'fallback'});result=await run(data,'wasm');
    }
    send('complete',{result});
  } catch(e) { send('error',{message:e.message || String(e)}); }
  finally {active=false;}
};

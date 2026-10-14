import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFile,validateMode,mixChannels,safeBasename,speakerAt,labelWords,formatTurns,stereoTurns,xmlEscape} from '../src/core.js';
import {makeDocx,exportPayload} from '../src/export.js';
import {unzipSync,strFromU8} from 'fflate';

test('accepted audio extensions, empty data and size limits',()=>{
  for(const name of ['test.mp3','中文.M4A','test.wav'])validateFile({name,size:10});
  for(const file of [{name:'x.exe',size:10},{name:'x.mp3',size:0},{name:'x.mp3',size:201*1024*1024}])assert.throws(()=>validateFile(file));
});
test('mixing preserves scale and supports mono without aliasing',()=>{
  const mono=new Float32Array([1,-1]);assert.deepEqual([...mixChannels([mono])],[1,-1]);
  assert.notEqual(mixChannels([mono]),mono);
  assert.deepEqual([...mixChannels([mono,new Float32Array([-1,1])])],[0,0]);
  assert.throws(()=>mixChannels([]));assert.throws(()=>mixChannels([mono,new Float32Array([0])]));
});
test('speaker mode rejects incompatible or excessively long inputs',()=>{
  validateMode('none',1800,1);validateMode('auto',60,1);validateMode('channels',600,2);
  for(const args of [['channels',5,1],['auto',61,1],['none',1801,1],['none',NaN,1],['bad',3,1]])assert.throws(()=>validateMode(...args));
});
test('speaker attribution uses overlap, ignores silence and handles missing timestamps',()=>{
  const segments=[{id:0,start:0,end:10,label:'NO_SPEAKER'},{id:1,start:0,end:2,label:'SPEAKER_1'},{id:2,start:2,end:4,label:'SPEAKER_2'}];
  assert.equal(speakerAt(.5,1,segments,4),'SPEAKER_1');assert.equal(speakerAt(1.9,3,segments,4),'SPEAKER_2');
  assert.equal(speakerAt(null,3,segments,4),'UNKNOWN');assert.equal(speakerAt(3,null,segments,4),'SPEAKER_2');
  assert.equal(speakerAt(5,6,segments,6),'UNKNOWN');
});
test('contiguous word labels retain every word and overlapping speakers',()=>{
  const turns=labelWords([{text:' Hello',timestamp:[0,.5]},{text:' world.',timestamp:[.5,1]},{text:' 你好',timestamp:[1,2]}],[{id:1,label:'SPEAKER_1',start:0,end:1},{id:4,label:'SPEAKER_1+SPEAKER_2',start:1,end:2}],2);
  assert.deepEqual(turns,[{speaker:'SPEAKER_1',text:' Hello world.'},{speaker:'SPEAKER_1+SPEAKER_2',text:' 你好'}]);
  assert.equal(formatTurns(turns,true),'Speaker 1: Hello world.\n\nSpeaker 1+2: 你好');
});
test('stereo channel turns are ordered by recording time',()=>{
  const turns=stereoTurns({chunks:[{text:' left',timestamp:[2,3]}]},{chunks:[{text:' right',timestamp:[0,1]}]});
  assert.deepEqual(turns,[{speaker:'RIGHT',text:' right'},{speaker:'LEFT',text:' left'}]);
});
test('speaker numbering follows first appearance and remains consistent when a voice returns',()=>{
  assert.equal(formatTurns([{speaker:'SPEAKER_3',text:' one'},{speaker:'SPEAKER_2',text:' two'},{speaker:'SPEAKER_3+SPEAKER_2',text:' both'},{speaker:'SPEAKER_3',text:' back'}],true),'Speaker 1: one\n\nSpeaker 2: two\n\nSpeaker 1+2: both\n\nSpeaker 1: back');
});
test('safe output filenames cannot become paths',()=>{
  assert.equal(safeBasename('../../notes.m4a'),'.._.._notes');assert.equal(safeBasename('录音.mp3'),'录音');
  assert.equal(safeBasename('.mp3'),'transcript');
});
test('TXT and Markdown preserve exact text without automatic markup',()=>{
  const text='中文 & English\n  second line\n';
  for(const type of ['txt','md'])assert.equal(new TextDecoder().decode(exportPayload(text,type).data),text);
  assert.throws(()=>exportPayload(text,'html'));
});
test('Word output is a valid OPC archive with escaped bilingual paragraphs',()=>{
  const zip=unzipSync(makeDocx('中文 <hello> & "test"\n\n next\tline'));
  assert.deepEqual(Object.keys(zip).sort(),['[Content_Types].xml','_rels/.rels','word/document.xml'].sort());
  const xml=strFromU8(zip['word/document.xml']);assert.match(xml,/中文 &lt;hello&gt; &amp; &quot;test&quot;/);
  assert.match(xml,/xml:space="preserve"/);assert.equal((xml.match(/<w:p>/g)||[]).length,3);
  assert.match(strFromU8(zip['_rels/.rels']),/Target="word\/document.xml"/);
});
test('XML export strips prohibited controls while keeping Unicode and whitespace',()=>{
  assert.equal(xmlEscape('中文\0\t\n😀<&'),'中文\t\n😀&lt;&amp;');
  assert.equal(xmlEscape('\ud800\uffff你好😀'),'你好😀');
});

# Validation record

Date: 2026-10-14. App version: 0.1.0.

## Automated checks

- Node.js 26.8.1 on macOS: 11 regression tests passed.
- Production build with Vite 6.4.4 passed.
- Exported Word archive and every XML part parsed successfully with Python's
  standard library. Chinese, English and blank paragraphs were preserved.
- Dependency check after updates: npm audit reported zero known vulnerabilities.

## Browser checks

Production build tested in desktop Chrome, with generated speech rather than
personal recordings. No test audio is included in the repository.

| Input and mode | Observed result |
|---|---|
| English MP3, tiny model, CPU | Recognized the test and tomorrow's meeting at 3 in the afternoon |
| Chinese AAC/M4A, standard model, automatic device selection | `你好,今天我们测试录音转文字,会议将在明天下午3点开始。` |
| Two sequential generated voices, automatic speaker mode | Two voice labels separated the English test and the second speaker's reply |
| Stereo AAC/M4A, one voice per channel, CPU | Left and right speech both recognized, in recording-time order |
| Actual browser TXT/Markdown/Word downloads | All three downloads contained the exact displayed English transcript; Word XML parsed correctly |

Representative English output: `Hello, this is a recording transcription test,
the meeting starts tomorrow at 3 in the afternoon.`
Punctuation/numeric rendering comes from the recognizer. No summarizer or text
rewriter is run. These are smoke tests, not speech accuracy measurements.

Cancel during a new model load stopped the worker and re-enabled starting.
The final automatic-speaker display was rechecked with first-appearance numbering
(`Speaker 1`, `Speaker 2`). No Word desktop application compatibility claim is
made from XML parsing alone.

The attempted Chrome viewport override did not change the measured 1470-pixel
viewport. Responsive CSS is included, but this is not recorded as a successful
phone-layout or mobile-recognition test.

## Hosted deployment

GitHub Pages: https://608tt.github.io/audio-to-text/

The public page was opened in Chrome and actually transcribed the generated
English MP3 in CPU/tiny mode. Its result matched the local production preview.
Both the 11-test/build workflow and Pages build/deploy workflow succeeded for
the published source. The browser app's URL and worker/WASM paths were therefore
verified on the real project Pages path, not just localhost.

## Limits

No representative recognition or diarization benchmark has been run. No test
establishes universal accuracy, mobile support, offline availability after cache
eviction, or processing speed for 30-minute files. The 200 MB / 30-minute and
60-second speaker limits are input limits. Model host availability is external.

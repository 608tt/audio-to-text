# Third-party notices

This repository contains the author's app code, not pretrained model weights.

- Transformers.js: Apache-2.0, https://github.com/huggingface/transformers.js
- fflate: MIT, https://github.com/101arrowz/fflate
- Vite: MIT, https://github.com/vitejs/vite
- ONNX Runtime (dependency): MIT, https://github.com/microsoft/onnxruntime
- OpenAI Whisper and ONNX conversions: model cards/license files at
  https://huggingface.co/openai/whisper-base and https://huggingface.co/onnx-community/whisper-base
- Timestamped model: https://huggingface.co/onnx-community/whisper-base_timestamped
- Pyannote segmentation ONNX model (model card: MIT):
  https://huggingface.co/onnx-community/pyannote-segmentation-3.0

The official example at https://huggingface.co/spaces/Xenova/whisper-speaker-diarization
informed API usage and device/dtype choices. The app UI, exports and workflow are
implemented independently. No source from that example is bundled here.

Dependency license files remain in installed packages. Model download URLs and
licenses are controlled by their publishers; using this app does not relicense them.

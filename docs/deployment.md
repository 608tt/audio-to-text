# Deployment

`npm run build` creates a static `dist/` directory. Host it over HTTPS, including
all assets. The relative Vite base supports a GitHub project Pages path.
There is no backend, database, secret or transcription API.

To publish a fork on GitHub Pages, choose Settings → Pages → Source → GitHub Actions.
The included workflow tests and builds the app, uploads `dist/` and deploys it.
Update the README demo links to your own account/repository.

Recognition runs in a module worker. WASM uses one thread so cross-origin
isolation headers are not required. WebGPU needs a compatible browser and a
secure origin (HTTPS or localhost). Model files download from Hugging Face;
publishing the HTML does not eliminate that network dependency.

Serving the app on a shared static host does not upload visitor audio. Do not
add server uploads, request logging of transcripts, or third-party analytics.

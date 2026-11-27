# ACOUSTICA Windows output

Extract the entire package, run ACOUSTICA.exe (Windows x64). It opens http://127.0.0.1:8769/ in your browser. Select Windows output (native) and Start input, then play audio through the Windows default multimedia playback device. Stop closes capture. Close the helper window to exit. The helper listens only on localhost, requires a same-origin browser WebSocket, does not capture the microphone or display, and does not send audio off the PC. If the output device changes, stop and reconnect. Mono/stereo or first two channels of multichannel playback are supported. No screen sharing or separate .NET installation is required by the self-contained package. Real endpoint capture and latency remain unverified; CI tests build and local server startup, not a physical sound device.

Dependencies: NAudio 2.2.1 (MIT), .NET 8 (MIT), Three.js r170 (MIT); source links and license notices in the repository and packaged dependencies.

# WebRTC tutorials
The series of tutorial apps for WebRTC using Angular (Typescript), Android (Java), SignalR (C#) and NodeJS (Typescript).

The tutorial apps include:
- basic peer-to-peer implementation (for web and mobile apps),
- multi-peer implementation (for web apps) via all four of the most known WebRTC topologies - MESH, STAR, SFU (Selective Forwarding Unit) and MCU (Multipoint Control Unit).

The signaling server is implemented using Microsoft SignalR. The media (streaming) server is implemented using NodeJS.

# The MCU audio/video track(s) mixing
The audio/video track(s) mixing for MCU (Multipoint Control Unit) topology is implemented fully custom in NodeJS, using [node-webrtc](https://github.com/node-webrtc/node-webrtc) and its Nonstandard APIs. The implementation can be seen in the [MediaStreamMixer class](https://github.com/dalkofjac/webrtc-tutorials/blob/master/MediaServer/src/app/models/media-stream-mixer.ts).

# The face recognition (with MediaPipe)
The face recognition (anonymization) in Android app is implemented using [Google's MediaPipe](https://github.com/google-ai-edge/mediapipe) algorithms. The implementation can be seen in the [FaceAnonymizer class](https://github.com/dalkofjac/webrtc-tutorials/blob/master/WebRTCAndroidApp/app/src/main/java/com/example/webrtcandroidapp/ai/FaceAnonymizer.java). To test it out, just set the "USE_FACE_ANONYMIZATION" flag to "true" in [AndroidCameraCapturer class](https://github.com/dalkofjac/webrtc-tutorials/blob/master/WebRTCAndroidApp/app/src/main/java/com/example/webrtcandroidapp/capturers/AndroidCameraCapturer.java).

# Blog
Find more details on the implementation itself on the [blog site](https://ekobit.com/author/dkofjacekobit-hr/).

# License
This repository uses [MIT license](https://github.com/dalkofjac/webrtc-tutorials/blob/master/LICENSE). Copyright (c) Dalibor Kofjač.

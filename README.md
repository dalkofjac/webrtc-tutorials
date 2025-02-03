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

# Android-based AR smartglass support
The WebRTC Android app now has full support for Android-based Augmented Reality smartglass devices (such as Vuzix M400, Google Glass EE2, RealWear Navigator 500, Almer Arc2 and similar). The implementation can be seen in [WebRTCAndroidApp](https://github.com/dalkofjac/webrtc-tutorials/tree/master/WebRTCAndroidApp). To test it out, just set the "USE_SMARTGLASS_OPTIMIZATION" flag to "true" in [WebRTCAndroidApp class](https://github.com/dalkofjac/webrtc-tutorials/blob/master/WebRTCAndroidApp/app/src/main/java/com/example/webrtcandroidapp/WebRTCAndroidApp.java).

# Blog
Find more details on the implementation itself on the [blog site](https://ekobit.com/author/dkofjacekobit-hr/) and [my LinkedIn](https://www.linkedin.com/in/dalibor-kofjac/).

# License
This repository uses [MIT license](https://github.com/dalkofjac/webrtc-tutorials/blob/master/LICENSE). Copyright (c) Dalibor Kofjač.

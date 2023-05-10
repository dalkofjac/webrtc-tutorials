"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaStreamMixer = exports.VideoSinkBundle = void 0;
const wrtc_1 = require("wrtc");
const canvas_1 = require("canvas");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RTCVideoSource, RTCVideoSink, rgbaToI420, i420ToRgba, RTCAudioSink, RTCAudioSource } = require('wrtc').nonstandard;
class VideoSinkBundle {
}
exports.VideoSinkBundle = VideoSinkBundle;
class MediaStreamMixer {
    constructor(streams) {
        this.streams = streams;
        this.canvas = (0, canvas_1.createCanvas)(640, 480);
        this.context = this.canvas.getContext('2d');
        this.frameInterval = 10;
        this.width = 640;
        this.height = 480;
        this.videoSource = new RTCVideoSource();
        this.audioSource = new RTCAudioSource();
        this.videoSinkBundles = new Array();
        this.audioSinks = new Array();
        if (streams === null || streams === void 0 ? void 0 : streams.length) {
            this.appendStreams(streams);
        }
        this.drawFramesToCanvas();
    }
    isAudioOnly() {
        for (let i = 0; i < this.streams.length; i++) {
            if (this.streams[i].getTracks().filter(function (t) {
                return t.kind === 'video';
            }).length > 0)
                return false;
        }
        return true;
    }
    drawFramesToCanvas() {
        if (this.videoSinkBundles.length) {
            const videosLength = this.videoSinkBundles.length;
            this.canvas.width = videosLength > 1 ? this.width * 2 : this.width;
            let height = 1;
            if (videosLength === 3 || videosLength === 4) {
                height = 2;
            }
            if (videosLength === 5 || videosLength === 6) {
                height = 3;
            }
            if (videosLength === 7 || videosLength === 8) {
                height = 4;
            }
            if (videosLength === 9 || videosLength === 10) {
                height = 5;
            }
            this.canvas.height = this.height * height;
            this.videoSinkBundles.forEach((videoSink, idx) => {
                if (videoSink.lastFrame) {
                    this.drawImage(videoSink.lastFrame, idx);
                }
            });
            const canvasFrame = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const webrtcFrame = { width: this.canvas.width, height: this.canvas.height, data: new Uint8ClampedArray(this.canvas.width * this.canvas.height * 1.5) };
            rgbaToI420(canvasFrame, webrtcFrame);
            this.videoSource.onFrame(webrtcFrame);
        }
        setTimeout(this.drawFramesToCanvas.bind(this), this.frameInterval);
    }
    drawImage(frame, idx) {
        let x = 0;
        let y = 0;
        if (idx === 1) {
            x = this.width;
        }
        if (idx === 2) {
            y = this.height;
        }
        if (idx === 3) {
            x = this.width;
            y = this.height;
        }
        if (idx === 4) {
            y = this.height * 2;
        }
        if (idx === 5) {
            x = this.width;
            y = this.height * 2;
        }
        if (idx === 6) {
            y = this.height * 3;
        }
        if (idx === 7) {
            x = this.width;
            y = this.height * 3;
        }
        const canvasFrame = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.width * frame.height * 4) };
        i420ToRgba(frame, canvasFrame);
        const imageData = new canvas_1.ImageData(new Uint8ClampedArray(canvasFrame.data), canvasFrame.width, canvasFrame.height);
        const frameCanvas = (0, canvas_1.createCanvas)(frame.width, frame.height);
        const frameCtx = frameCanvas.getContext('2d');
        frameCtx.putImageData(imageData, 0, 0);
        this.context.drawImage(frameCanvas, x, y, this.width, this.height);
    }
    getMixedStream() {
        const mixedAudioStream = this.getMixedAudioStream();
        const mixedVideoStream = (this.isAudioOnly()) ? undefined : this.getMixedVideoStream();
        if (mixedVideoStream == undefined) {
            return mixedAudioStream;
        }
        else {
            if (mixedAudioStream) {
                mixedAudioStream.getTracks().filter(function (t) {
                    return t.kind === 'audio';
                }).forEach(track => {
                    mixedVideoStream.addTrack(track);
                });
            }
            return mixedVideoStream;
        }
    }
    getMixedVideoStream() {
        this.resetVideoStreams();
        const imagesTrack = this.videoSource.createTrack();
        const capturedStream = new wrtc_1.MediaStream([imagesTrack]);
        const videoStream = new wrtc_1.MediaStream({ id: 'nodejs_video_stream' });
        capturedStream.getTracks().filter(function (t) {
            return t.kind === 'video';
        }).forEach(track => {
            videoStream.addTrack(track);
        });
        return videoStream;
    }
    getMixedAudioStream() {
        const audioTrack = this.audioSource.createTrack();
        const capturedStream = new wrtc_1.MediaStream([audioTrack]);
        const audioStream = new wrtc_1.MediaStream({ id: 'nodejs_audio_stream' });
        capturedStream.getTracks().filter(function (t) {
            return t.kind === 'audio';
        }).forEach(track => {
            audioStream.addTrack(track);
        });
        return audioStream;
    }
    appendStreams(streams) {
        if (!streams) {
            throw 'First parameter is required.';
        }
        if (!(streams instanceof Array)) {
            streams = [streams];
        }
        this.streams.concat(streams);
        streams.forEach(stream => {
            if (stream.getTracks().filter(function (t) {
                return t.kind === 'video';
            }).length) {
                stream.getVideoTracks().forEach((videoTrack) => {
                    const sinkBundle = new VideoSinkBundle();
                    sinkBundle.videoSink = new RTCVideoSink(videoTrack);
                    sinkBundle.videoSink.onframe = (frameObject) => {
                        if (frameObject === null || frameObject === void 0 ? void 0 : frameObject.frame) {
                            sinkBundle.lastFrame = frameObject.frame;
                        }
                    };
                    this.videoSinkBundles.push(sinkBundle);
                });
            }
            if (stream.getTracks().filter(function (t) {
                return t.kind === 'audio';
            }).length) {
                stream.getAudioTracks().forEach((audioTrack) => {
                    const audioSink = new RTCAudioSink(audioTrack);
                    audioSink.ondata = (data) => {
                        if (data) {
                            this.audioSource.onData(data);
                        }
                    };
                    this.audioSinks.push(audioSink);
                });
            }
        });
    }
    releaseStreams() {
        this.videoSinkBundles.forEach(videoSinkSet => {
            videoSinkSet.videoSink.stop();
        });
        this.audioSinks.forEach(audioSink => {
            audioSink.stop();
        });
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    resetVideoStreams(streams) {
        if (streams && !(streams instanceof Array)) {
            streams = [streams];
        }
        this._resetVideoStreams(streams);
    }
    _resetVideoStreams(streams) {
        streams = streams || this.streams;
        streams.forEach(stream => {
            if (!stream.getTracks().filter(function (t) {
                return t.kind === 'video';
            }).length) {
                return;
            }
        });
    }
}
exports.MediaStreamMixer = MediaStreamMixer;
//# sourceMappingURL=mixer.js.map
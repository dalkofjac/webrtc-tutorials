"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiStreamsMixer = exports.VideoSinkSet = void 0;
const wrtc_1 = require("wrtc");
const canvas_1 = require("canvas");
const jsdom_1 = __importDefault(require("jsdom"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RTCVideoSource, RTCVideoSink, rgbaToI420, i420ToRgba } = require('wrtc').nonstandard;
const { JSDOM } = jsdom_1.default;
class VideoSinkSet {
}
exports.VideoSinkSet = VideoSinkSet;
class MultiStreamsMixer {
    constructor(_arrayOfMediaStreams, elementClass = 'multi-streams-mixer') {
        this.videoSinks = new Array();
        this.arrayOfMediaStreams = _arrayOfMediaStreams;
        this.elementClass = elementClass;
        this.isStopDrawingFrames = false;
        this.canvas = (0, canvas_1.createCanvas)(640, 480);
        this.context = this.canvas.getContext('2d');
        this.disableLogs = false;
        this.frameInterval = 10;
        this.width = 640;
        this.height = 480;
        this.useGainNode = true;
        this.audioContext = undefined;
        this.videoSource = new RTCVideoSource();
        this.dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`);
    }
    isPureAudio() {
        for (let i = 0; i < this.arrayOfMediaStreams.length; i++) {
            if (this.arrayOfMediaStreams[i].getTracks().filter(function (t) {
                return t.kind === 'video';
            }).length > 0)
                return false;
        }
        return true;
    }
    getAudioContext() {
        if (typeof AudioContext !== 'undefined') {
            return new AudioContext();
        }
        else if (typeof this.dom.window.webkitAudioContext !== 'undefined') {
            return new this.dom.window.webkitAudioContext();
        }
        else if (typeof this.dom.window.mozAudioContext !== 'undefined') {
            return new this.dom.window.mozAudioContext();
        }
    }
    startDrawingFrames() {
        this.drawVideosToCanvas();
    }
    drawVideosToCanvas() {
        if (this.isStopDrawingFrames) {
            return;
        }
        const videosLength = this.videoSinks.length;
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
        this.videoSinks.forEach((videoSink, idx) => {
            if (videoSink.frameCanvas) {
                this.drawImage(videoSink.frameCanvas, idx);
            }
        });
        const canvasFrame = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const webrtcFrame = { width: this.canvas.width, height: this.canvas.height, data: new Uint8ClampedArray(this.canvas.width * this.canvas.height * 1.5) };
        rgbaToI420(canvasFrame, webrtcFrame);
        this.videoSource.onFrame(webrtcFrame);
        setTimeout(this.drawVideosToCanvas.bind(this), this.frameInterval);
    }
    drawImage(frameCanvas, idx) {
        if (this.isStopDrawingFrames) {
            return;
        }
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
        this.context.drawImage(frameCanvas, x, y, this.width, this.height);
    }
    getMixedStream() {
        this.isStopDrawingFrames = false;
        const mixedAudioStream = undefined;
        //const mixedAudioStream = this.getMixedAudioStream();
        const mixedVideoStream = (this.isPureAudio()) ? undefined : this.getMixedVideoStream();
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
        // via: @pehrsons
        if (this.audioContext == undefined)
            this.audioContext = this.getAudioContext();
        this.audioSources = new Array();
        if (this.useGainNode === true) {
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = 0; // don't hear self
        }
        let audioTracksLength = 0;
        this.arrayOfMediaStreams.forEach(stream => {
            if (!stream.getTracks().filter(function (t) {
                return t.kind === 'audio';
            }).length) {
                return;
            }
            audioTracksLength++;
            const _audioSource = this.audioContext.createMediaStreamSource(stream);
            if (this.useGainNode === true) {
                _audioSource.connect(this.gainNode);
            }
            this.audioSources.push(_audioSource);
        });
        if (!audioTracksLength) {
            return undefined;
        }
        this.audioDestination = this.audioContext.createMediaStreamDestination();
        this.audioSources.forEach(_audioSource => {
            _audioSource.connect(this.audioDestination);
        });
        return this.audioDestination.stream;
    }
    appendStreams(streams) {
        if (!streams) {
            throw 'First parameter is required.';
        }
        if (!(streams instanceof Array)) {
            streams = [streams];
        }
        this.arrayOfMediaStreams.concat(streams);
        streams.forEach(stream => {
            if (stream.getTracks().filter(function (t) {
                return t.kind === 'video';
            }).length) {
                stream.getVideoTracks().forEach(videoTrack => {
                    const sinkSet = new VideoSinkSet();
                    sinkSet.videoSink = new RTCVideoSink(videoTrack);
                    sinkSet.videoSink.onframe = ({ frame }) => {
                        const canvasFrame = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.width * frame.height * 4) };
                        i420ToRgba(frame, canvasFrame);
                        const imageData = new canvas_1.ImageData(new Uint8ClampedArray(canvasFrame.data), canvasFrame.width, canvasFrame.height);
                        const frameCanvas = (0, canvas_1.createCanvas)(frame.width, frame.height);
                        const frameCtx = frameCanvas.getContext('2d');
                        frameCtx.putImageData(imageData, 0, 0);
                        sinkSet.frameCanvas = frameCanvas;
                    };
                    this.videoSinks.push(sinkSet);
                });
            }
            if (stream.getTracks().filter(function (t) {
                return t.kind === 'audio';
            }).length && this.audioContext) {
                const audioSource = this.audioContext.createMediaStreamSource(stream);
                audioSource.connect(this.audioDestination);
                this.audioSources.push(audioSource);
            }
        });
    }
    releaseStreams() {
        this.isStopDrawingFrames = true;
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.audioSources.length) {
            this.audioSources.forEach(source => {
                source.disconnect();
            });
            this.audioSources = [];
        }
        if (this.audioDestination) {
            this.audioDestination.disconnect();
            this.audioDestination = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.audioContext = null;
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    resetVideoStreams(streams) {
        if (streams && !(streams instanceof Array)) {
            streams = [streams];
        }
        this._resetVideoStreams(streams);
    }
    _resetVideoStreams(streams) {
        streams = streams || this.arrayOfMediaStreams;
        // via: @adrian-ber
        streams.forEach(stream => {
            if (!stream.getTracks().filter(function (t) {
                return t.kind === 'video';
            }).length) {
                return;
            }
        });
    }
}
exports.MultiStreamsMixer = MultiStreamsMixer;
//# sourceMappingURL=mixer.js.map
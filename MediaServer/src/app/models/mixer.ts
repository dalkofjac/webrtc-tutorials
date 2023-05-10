import { MediaStream, MediaStreamTrack } from 'wrtc';
import { Canvas, createCanvas, CanvasRenderingContext2D, ImageData } from 'canvas';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RTCVideoSource, RTCVideoSink, rgbaToI420, i420ToRgba, RTCAudioSink, RTCAudioSource } = require('wrtc').nonstandard;

export interface AudioSource {
  createTrack(): MediaStreamTrack;
  onData(data: AudioData): void;
}

export interface AudioSink {
  stop(): void;
  readonly stopped: boolean;
  ondata: (data: AudioData) => void;
}

export interface AudioData {
  samples: Int16Array;
  sampleRate: number;
  bitsPerSample?: number;
  channelCount?: number;
  numberOfFrames?: number;
}

export interface VideoSource {
  readonly isScreencast: boolean;
  readonly needsDenoising: boolean;
  createTrack(): MediaStreamTrack;
  onFrame(frame: VideoFrame): void;
}

export interface VideoSink {
  stop(): void;
  readonly stopped: boolean;
  onframe: (frameObject: VideoFrameObject) => void;
}

export interface VideoFrameObject {
  frame: VideoFrame;
}

export interface VideoFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  rotation?: number;
}

export class VideoSinkBundle {
  videoSink: VideoSink;
  lastFrame: VideoFrame;
}

export class MediaStreamMixer {
  private streams: Array<MediaStream>;

  private videoSource: VideoSource;
  private audioSource: AudioSource;
  private videoSinkBundles: Array<VideoSinkBundle>;
  private audioSinks: Array<AudioSink>;

  private canvas: Canvas;
  private context: CanvasRenderingContext2D;

  private width: number;
  private height: number;
  private frameInterval: number;

  constructor(streams: Array<MediaStream>) {
    this.streams = streams;
    this.canvas = createCanvas(640, 480);
    this.context = this.canvas.getContext('2d');
    this.frameInterval = 10;
    this.width = 640;
    this.height = 480;
    this.videoSource = new RTCVideoSource();
    this.audioSource = new RTCAudioSource();
    this.videoSinkBundles = new Array<VideoSinkBundle>();
    this.audioSinks = new Array<AudioSink>();

    if (streams?.length) {
      this.appendStreams(streams);
    }
    this.drawFramesToCanvas();
  }

  private isAudioOnly(): boolean {
    for (let i = 0; i < this.streams.length; i++){
      if (this.streams[i].getTracks().filter(function(t) {
                return t.kind === 'video';
            }).length > 0) return false;
    }
    return true;
  }

  private drawFramesToCanvas(): void {
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
      const webrtcFrame = { width: this.canvas.width, height: this.canvas.height, data: new Uint8ClampedArray(this.canvas.width * this.canvas.height * 1.5)};
      rgbaToI420(canvasFrame, webrtcFrame);
      this.videoSource.onFrame(webrtcFrame);
    }

    setTimeout(this.drawFramesToCanvas.bind(this), this.frameInterval);
  }

  private drawImage(frame: VideoFrame, idx: number): void {
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
    const imageData = new ImageData(new Uint8ClampedArray(canvasFrame.data), canvasFrame.width, canvasFrame.height);
    const frameCanvas = createCanvas(frame.width, frame.height);
    const frameCtx = frameCanvas.getContext('2d');
    frameCtx.putImageData(imageData, 0, 0);

    this.context.drawImage(frameCanvas, x, y, this.width, this.height);
  }

  getMixedStream(): MediaStream {
    const mixedAudioStream = this.getMixedAudioStream();
    const mixedVideoStream = this.isAudioOnly() ? undefined : this.getMixedVideoStream();
    if (mixedVideoStream == undefined){
      return mixedAudioStream;
    } else {
      if (mixedAudioStream) {
        mixedAudioStream.getTracks().filter(function(t) {
                return t.kind === 'audio';
            }).forEach(track => {
          mixedVideoStream.addTrack(track);
        });
      }
      return mixedVideoStream;
    }
  }

  private getMixedVideoStream(): MediaStream {
    this.resetVideoStreams();
    const imagesTrack = this.videoSource.createTrack();
    const capturedStream = new MediaStream([imagesTrack]);
    const videoStream = new MediaStream({ id: 'nodejs_video_stream' });
    capturedStream.getTracks().filter(function(t) {
                return t.kind === 'video';
            }).forEach(track => {
      videoStream.addTrack(track);
    });
    return videoStream;
  }

  private getMixedAudioStream(): MediaStream {
    const audioTrack = this.audioSource.createTrack();
    const capturedStream = new MediaStream([audioTrack]);
    const audioStream = new MediaStream({ id: 'nodejs_audio_stream' });
    capturedStream.getTracks().filter(function(t) {
                return t.kind === 'audio';
            }).forEach(track => {
              audioStream.addTrack(track);
    });
    return audioStream;
  }

  appendStreams(streams: Array<MediaStream>): void {
    if (!streams) {
      throw 'First parameter is required.';
    }

    if (!(streams instanceof Array)) {
      streams = [streams];
    }

    this.streams.concat(streams);
    streams.forEach(stream => {
      if (stream.getTracks().filter(function(t) {
                return t.kind === 'video';
            }).length) {
              stream.getVideoTracks().forEach((videoTrack: MediaStreamTrack) => {
                const sinkBundle = new VideoSinkBundle();
                sinkBundle.videoSink = new RTCVideoSink(videoTrack);
                sinkBundle.videoSink.onframe = (frameObject: VideoFrameObject) => {
                  if (frameObject?.frame) {
                    sinkBundle.lastFrame = frameObject.frame;
                  }
                };
                this.videoSinkBundles.push(sinkBundle);
              });
      }

      if (stream.getTracks().filter(function(t) {
                return t.kind === 'audio';
            }).length) {
              stream.getAudioTracks().forEach((audioTrack: MediaStreamTrack) => {
                const audioSink = new RTCAudioSink(audioTrack);
                audioSink.ondata = (data: AudioData) => {
                  if (data) {
                    this.audioSource.onData(data);
                  }
                };
                this.audioSinks.push(audioSink);
              });
      }
    });
  }

  private releaseStreams(): void {
    this.videoSinkBundles.forEach(videoSinkSet => {
      videoSinkSet.videoSink.stop();
    });

    this.audioSinks.forEach(audioSink => {
      audioSink.stop();
    });

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private resetVideoStreams(streams?: Array<MediaStream>): void {
    if (streams && !(streams instanceof Array)) {
      streams = [streams];
    }

    this._resetVideoStreams(streams);
  }

  private _resetVideoStreams(streams: Array<MediaStream>): void {
    streams = streams || this.streams;

    streams.forEach(stream => {
      if (!stream.getTracks().filter(function(t) {
                return t.kind === 'video';
            }).length) {
        return;
      }
    });
  }
}

import { MediaStream } from 'wrtc';
import { Canvas, createCanvas, CanvasRenderingContext2D, ImageData } from 'canvas';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RTCVideoSource, RTCVideoSink, rgbaToI420, i420ToRgba, RTCAudioSink, RTCAudioSource } = require('wrtc').nonstandard;

export class VideoSinkSet {
  videoSink: any;
  frameCanvas: Canvas;
}

export class MultiStreamsMixer {

  videoSinkSets = new Array<VideoSinkSet>();
  audioSinks = new Array<any>();
  isStopDrawingFrames: boolean;
  canvas : Canvas;
  context : CanvasRenderingContext2D;
  disableLogs: boolean;
  frameInterval: number;
  width : number;
  height: number;
  useGainNode : boolean;
  arrayOfMediaStreams: Array<MediaStream>;
  videoSource: any;
  audioSource: any;

  constructor (_arrayOfMediaStreams) {
    this.arrayOfMediaStreams = _arrayOfMediaStreams;
    this.isStopDrawingFrames = false;
    this.canvas = createCanvas(640, 480);
    this.context = this.canvas.getContext('2d');
    this.disableLogs = false;
    this.frameInterval = 10;
    this.width = 640;
    this.height = 480;
    this.useGainNode = false;
    this.videoSource = new RTCVideoSource();
    this.audioSource = new RTCAudioSource();
  }

  private isPureAudio(){
    for (let i = 0; i < this.arrayOfMediaStreams.length;i++){
      if (this.arrayOfMediaStreams[i].getTracks().filter(function(t) {
                return t.kind === 'video';
            }).length > 0) return false;
    }
    return true;
  }

  public startDrawingFrames() {
    this.drawVideosToCanvas();
  }

  private drawVideosToCanvas() {
    if (this.isStopDrawingFrames) {
      return;
    }
    const videosLength = this.videoSinkSets.length;
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

    this.videoSinkSets.forEach((videoSink, idx) => {
      if (videoSink.frameCanvas) {
        this.drawImage(videoSink.frameCanvas, idx);
      }
    });

    const canvasFrame = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const webrtcFrame = { width: this.canvas.width, height: this.canvas.height, data: new Uint8ClampedArray(this.canvas.width * this.canvas.height * 1.5)};
    rgbaToI420(canvasFrame, webrtcFrame);
    this.videoSource.onFrame(webrtcFrame);

    setTimeout(this.drawVideosToCanvas.bind(this), this.frameInterval);
  }

  private drawImage(frameCanvas: Canvas, idx: number) {
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
    const mixedAudioStream = this.getMixedAudioStream();
    const mixedVideoStream = (this.isPureAudio()) ? undefined: this.getMixedVideoStream();
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

  private getMixedVideoStream() {
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

  private getMixedAudioStream() {
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

  appendStreams(streams) {
    if (!streams) {
      throw 'First parameter is required.';
    }

    if (!(streams instanceof Array)) {
      streams = [streams];
    }

    this.arrayOfMediaStreams.concat(streams);
    streams.forEach(stream => {
      if (stream.getTracks().filter(function(t) {
                return t.kind === 'video';
            }).length) {
              stream.getVideoTracks().forEach(videoTrack => {
                const sinkSet = new VideoSinkSet();
                sinkSet.videoSink = new RTCVideoSink(videoTrack);
                sinkSet.videoSink.onframe = ({ frame }) => {
                  if (frame) {
                    const canvasFrame = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.width * frame.height * 4) };
                    i420ToRgba(frame, canvasFrame);
                    const imageData = new ImageData(new Uint8ClampedArray(canvasFrame.data), canvasFrame.width, canvasFrame.height);
                    const frameCanvas = createCanvas(frame.width, frame.height);
                    const frameCtx = frameCanvas.getContext('2d');
                    frameCtx.putImageData(imageData, 0, 0);
                    sinkSet.frameCanvas = frameCanvas;
                  }
                };
                this.videoSinkSets.push(sinkSet);
              });
      }

      if (stream.getTracks().filter(function(t) {
                return t.kind === 'audio';
            }).length) {
              stream.getAudioTracks().forEach(audioTrack => {
                const audioSink = new RTCAudioSink(audioTrack);
                audioSink.ondata = data => {
                  if (data) {
                    this.audioSource.onData(data);
                  }
                };
                this.audioSinks.push(audioSink);
              });
      }
    });
  }

  private releaseStreams() {
    this.isStopDrawingFrames = true;

    this.videoSinkSets.forEach(videoSinkSet => {
      videoSinkSet.videoSink.stop();
    });

    this.audioSinks.forEach(audioSink => {
      audioSink.stop();
    });

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private resetVideoStreams(streams?) {
    if (streams && !(streams instanceof Array)) {
      streams = [streams];
    }

    this._resetVideoStreams(streams);
  }

  private _resetVideoStreams(streams) {
    streams = streams || this.arrayOfMediaStreams;

    streams.forEach(stream => {
      if (!stream.getTracks().filter(function(t) {
                return t.kind === 'video';
            }).length) {
        return;
      }
    });
  }
}

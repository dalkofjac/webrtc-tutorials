package com.example.webrtcandroidapp;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.WindowManager;

import com.google.gson.JsonIOException;
import com.google.gson.internal.LinkedTreeMap;

import org.json.JSONException;
import org.json.JSONObject;
import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.DataChannel;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.MediaStreamTrack;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpReceiver;
import org.webrtc.RtpTransceiver;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class SessionCallActivity extends AppCompatActivity {

    private static final String TAG = "SessionCallActivity";

    private String mRoomName;
    private SignalrService mSignalrService;
    private EglBase mRootEglBase;
    private SurfaceViewRenderer mLocalVideoView;
    private SurfaceViewRenderer mRemoteVideoView;
    private PeerConnectionFactory mPeerConnectionFactory;
    private PeerConnection mPeerConnection;
    private AudioTrack mLocalAudioTrack;
    private VideoTrack mLocalVideoTrack;
    private AndroidCameraCapturer mCameraCapturer;

    private boolean mIsInitiator = false;
    private boolean mIsChannelReady = false;
    private boolean mIsStarted = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_session_call);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        mRoomName = getIntent().getExtras().getString("ROOM_NAME");
        if (mRoomName == null) {
            this.finish();
        }

        mSignalrService = new SignalrService(BuildConfig.SIGNALING_HUB_URL);
        initViews();
    }

    @Override
    protected void onStart() {
        super.onStart();
        start();
    }

    @Override
    protected void onDestroy() {
        hangup();
        mRootEglBase.release();
        mCameraCapturer.dispose();
        mSignalrService.dispose();
        PeerConnectionFactory.shutdownInternalTracer();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        hangup();
        super.onBackPressed();
    }

    private void initViews() {
        mRootEglBase = EglBase.create();
        mLocalVideoView = findViewById(R.id.local_gl_surface_view);
        mLocalVideoView.init(mRootEglBase.getEglBaseContext(), null);
        mLocalVideoView.setZOrderMediaOverlay(true);
        mLocalVideoView.setMirror(false);
        mRemoteVideoView = findViewById(R.id.remote_gl_surface_view);
        mRemoteVideoView.init(mRootEglBase.getEglBaseContext(), null);
        mRemoteVideoView.setZOrderMediaOverlay(true);
        mRemoteVideoView.setMirror(false);
    }

    private void start() {
        // #1 connect to signaling server
        mSignalrService.connect(() -> {
            if (mSignalrService.isConnected()) {
                mSignalrService.invoke("CreateOrJoinRoom", mRoomName);
            }
        });

        // #2 define signaling communication
        defineSignaling();

        // #3 get media from current client
        getUserMedia();
    }

    private void defineSignaling() {
        mSignalrService.define("log", log -> {
            Log.i(TAG, "log [" + log + "]");
        }, String.class);

        mSignalrService.define("created", () -> {
            mIsInitiator = true;
        });

        mSignalrService.define("joined", () -> {
            mIsChannelReady = true;
        });

        mSignalrService.define("message", message -> {
            Log.i(TAG, "message [" + message + "]");

            if (message instanceof String) {
                String data = (String) message;
                if (data.equalsIgnoreCase("got user media")) {
                    initiateCall();
                }
            } else if (message instanceof LinkedTreeMap) {
                Object type = ((LinkedTreeMap) message).get("type");
                if(type != null) {
                    if (type.toString().equalsIgnoreCase("offer")) {
                        if(!mIsStarted) {
                            initiateCall();
                        }
                        mPeerConnection.setRemoteDescription(null,
                                new SessionDescription(SessionDescription.Type.OFFER, ((LinkedTreeMap) message).get("sdp").toString()));
                        sendAnswer();
                    } else if (type.toString().equalsIgnoreCase("answer") && mIsStarted) {
                        mPeerConnection.setRemoteDescription(null,
                                new SessionDescription(SessionDescription.Type.ANSWER, ((LinkedTreeMap) message).get("sdp").toString()));
                    } else if (type.toString().equalsIgnoreCase("candidate") && mIsStarted) {
                        addIceCandidate((LinkedTreeMap) message);
                    } else if (type.toString().equalsIgnoreCase("bye") && mIsStarted) {
                        handleRemoteHangup();
                    }
                }
            }
        }, Object.class);
    }

    private void getUserMedia() {
        Log.d(TAG, "getUserMedia");

        // Initialize the PeerConnectionFactory globals
        PeerConnectionFactory.InitializationOptions initializationOptions = PeerConnectionFactory.InitializationOptions
                .builder(this)
                .setEnableInternalTracer(true)
                .createInitializationOptions();
        PeerConnectionFactory.initialize(initializationOptions);

        // Create a new PeerConnectionFactory instance
        PeerConnectionFactory.Options options = new PeerConnectionFactory.Options();
        options.networkIgnoreMask = 16; // ADAPTER_TYPE_LOOPBACK
        options.disableNetworkMonitor = true;
        mPeerConnectionFactory = PeerConnectionFactory.builder()
                .setOptions(options)
                .setVideoEncoderFactory(new DefaultVideoEncoderFactory(mRootEglBase.getEglBaseContext(), false, false))
                .setVideoDecoderFactory(new DefaultVideoDecoderFactory(mRootEglBase.getEglBaseContext()))
                .createPeerConnectionFactory();

        // Create VideoSource and VideoTrack instances
        VideoSource videoSource = mPeerConnectionFactory.createVideoSource(false);
        mLocalVideoTrack = mPeerConnectionFactory.createVideoTrack("WebRTC_track_v1", videoSource);
        mLocalVideoTrack.setEnabled(true);

        // Create AudioSource and AudioTrack instances
        AudioSource audioSource = mPeerConnectionFactory.createAudioSource(new MediaConstraints());
        mLocalAudioTrack = mPeerConnectionFactory.createAudioTrack("WebRTC_track_a1", audioSource);
        mLocalAudioTrack.setEnabled(true);

        // Initialize the VideoCapturer
        SurfaceTextureHelper surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThreadOne", mRootEglBase.getEglBaseContext());
        mCameraCapturer = AndroidCameraCapturer.create(true, true);
        mCameraCapturer.initialize(surfaceTextureHelper, this, null);

        // Start recording
        mCameraCapturer.startCapture(640, 480, 30);
        mLocalVideoTrack.addSink(mLocalVideoView);

        // Try to initiate a call
        mSignalrService.invoke("got user media", mRoomName);
        if(mIsInitiator) {
            initiateCall();
        }
    }

    private void initiateCall() {
        Log.d(TAG, "initiateCall");

        if(!mIsStarted && mIsChannelReady && mLocalVideoView != null) {
            createPeerConnection();

            if(mPeerConnection != null && mLocalAudioTrack != null && mLocalVideoTrack != null) {
                mPeerConnection.addTrack(mLocalAudioTrack, Arrays.asList("WebRTC-stream"));
                mPeerConnection.addTrack(mLocalVideoTrack, Arrays.asList("WebRTC-stream"));
            }

            mIsStarted = true;
            if(mIsInitiator) {
                sendOffer();
            }
        }
    }

    private void createPeerConnection() {
        Log.d(TAG, "createPeerConnection");

        PeerConnection.RTCConfiguration config = new PeerConnection.RTCConfiguration(IceServerService.getIceServers());
        config.tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.DISABLED;
        config.bundlePolicy = PeerConnection.BundlePolicy.BALANCED;
        config.rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE;
        config.continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY;
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        config.iceTransportsType = PeerConnection.IceTransportsType.ALL;
        config.keyType = PeerConnection.KeyType.ECDSA;

        mPeerConnection = mPeerConnectionFactory.createPeerConnection(config, new PeerConnection.Observer() {
            @Override
            public void onIceCandidate(IceCandidate iceCandidate) {
                Log.d(TAG, "mPeerConnection::onIceCandidate");
                sendIceCandidate(iceCandidate);
            }

            @Override
            public void onAddTrack(RtpReceiver rtpReceiver, MediaStream[] mediaStreams) {
                Log.d(TAG, "mPeerConnection::onAddTrack");
                if(rtpReceiver.track() != null && rtpReceiver.track().kind() != null && rtpReceiver.track().kind().equals("video")) {
                    VideoTrack track = (VideoTrack) rtpReceiver.track();
                    if(track != null) {
                        track.addSink(mRemoteVideoView);
                    }
                }
            }

            @Override
            public void onSignalingChange(PeerConnection.SignalingState signalingState) { }

            @Override
            public void onIceConnectionChange(PeerConnection.IceConnectionState iceConnectionState) { }

            @Override
            public void onIceConnectionReceivingChange(boolean b) { }

            @Override
            public void onIceGatheringChange(PeerConnection.IceGatheringState iceGatheringState) { }

            @Override
            public void onIceCandidatesRemoved(IceCandidate[] iceCandidates) { }

            @Override
            public void onAddStream(MediaStream mediaStream) { }

            @Override
            public void onRemoveStream(MediaStream mediaStream) { }

            @Override
            public void onDataChannel(DataChannel dataChannel) { }

            @Override
            public void onRenegotiationNeeded() { }
        });
    }

    private void sendOffer() {
        Log.d(TAG, "sendOffer");

        addTransceivers();
        mPeerConnection.createOffer(new SdpObserver() {
            @Override
            public void onCreateSuccess(SessionDescription sessionDescription) {
                mPeerConnection.setLocalDescription(null, sessionDescription);
                try {
                    JSONObject offer = new JSONObject();
                    offer.put("type", sessionDescription.type.canonicalForm());
                    offer.put("sdp", sessionDescription.description);
                    sendMessage(offer);
                } catch (Exception e) {
                    Log.e(TAG, "sendOffer failed.", e);
                }
            }

            @Override
            public void onSetSuccess() { }

            @Override
            public void onCreateFailure(String s) { }

            @Override
            public void onSetFailure(String s) { }

        }, new MediaConstraints());
    }

    private void sendAnswer() {
        Log.d(TAG, "sendAnswer");

        addTransceivers();
        mPeerConnection.createAnswer(new SdpObserver() {
            @Override
            public void onCreateSuccess(SessionDescription sessionDescription) {
                mPeerConnection.setLocalDescription(null, sessionDescription);
                try {
                    JSONObject answer = new JSONObject();
                    answer.put("type", sessionDescription.type.canonicalForm());
                    answer.put("sdp", sessionDescription.description);
                    sendMessage(answer);
                } catch (Exception e) {
                    Log.e(TAG, "sendAnswer failed.", e);
                }
            }

            @Override
            public void onSetSuccess() { }

            @Override
            public void onCreateFailure(String s) { }

            @Override
            public void onSetFailure(String s) { }
        }, new MediaConstraints());
    }

    private void addIceCandidate(LinkedTreeMap data) {
        Log.d(TAG, "addIceCandidate");

        mPeerConnection.addIceCandidate(new IceCandidate(data.get("id").toString(),
                (int)Double.parseDouble(data.get("label").toString()), data.get("candidate").toString()));
    }

    private void sendIceCandidate(IceCandidate iceCandidate) {
        Log.d(TAG, "sendIceCandidate");

        try {
            JSONObject candidate = new JSONObject();
            candidate.put("type", "candidate");
            candidate.put("label", iceCandidate.sdpMLineIndex);
            candidate.put("id", iceCandidate.sdpMid);
            candidate.put("candidate", iceCandidate.sdp);
            sendMessage(candidate);
        } catch (Exception e) {
            Log.e(TAG, "sendOffer failed.", e);
        }
    }

    private void sendMessage(Object message) {
        Log.d(TAG, "sendMessage");

        if(mSignalrService != null) {
            mSignalrService.invoke("message", message, mRoomName);
        }
    }

    private void addTransceivers() {
        Log.d(TAG, "addTransceivers");

        RtpTransceiver.RtpTransceiverInit audioConstraint = new RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.RECV_ONLY);
        mPeerConnection.addTransceiver(MediaStreamTrack.MediaType.MEDIA_TYPE_AUDIO, audioConstraint);
        RtpTransceiver.RtpTransceiverInit videoConstraint = new RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.RECV_ONLY);
        mPeerConnection.addTransceiver(MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO, videoConstraint);
    }

    private void hangup() {
        Log.d(TAG, "hangup");

        stopPeerConnection();
        sendMessage("bye");
        mSignalrService.invoke("LeaveRoom", mRoomName);
        new Handler().postDelayed(() -> mSignalrService.disconnect(), 1000);
    }

    private void handleRemoteHangup() {
        Log.d(TAG, "handleRemoteHangup");

        stopPeerConnection();
        mIsInitiator = true;
    }

    private void stopPeerConnection() {
        Log.d(TAG, "stopPeerConnection");

        mIsStarted = false;
        mIsChannelReady = false;
        if(mPeerConnection != null) {
            mPeerConnection.close();
            mPeerConnection = null;
        }
    }
}
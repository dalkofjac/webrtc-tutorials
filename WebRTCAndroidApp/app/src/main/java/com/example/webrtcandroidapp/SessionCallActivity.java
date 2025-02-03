package com.example.webrtcandroidapp;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Toast;

import com.example.webrtcandroidapp.capturers.AndroidCameraCapturer;
import com.example.webrtcandroidapp.observers.CustomPeerConnectionObserver;
import com.example.webrtcandroidapp.observers.CustomSdpObserver;
import com.example.webrtcandroidapp.services.IceServerService;
import com.example.webrtcandroidapp.services.SignalrService;
import com.google.gson.internal.LinkedTreeMap;

import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
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
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.SurfaceViewRenderer;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

import java.util.Arrays;

public class SessionCallActivity extends AppCompatActivity {

    private static final String TAG = "SessionCallActivity";

    private String mRoomName;
    private SignalrService mSignalrService;
    private PeerConnectionFactory mPeerConnectionFactory;
    private PeerConnection mPeerConnection;
    private EglBase mRootEglBase;
    private SurfaceViewRenderer mLocalVideoView;
    private SurfaceViewRenderer mRemoteVideoView;
    private AudioTrack mLocalAudioTrack;
    private VideoTrack mLocalVideoTrack;
    private AndroidCameraCapturer mCameraCapturer;

    private boolean mIsInitiator = false;
    private boolean mIsChannelReady = false;
    private boolean mIsStarted = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(WebRTCAndroidApp.USE_SMARTGLASS_OPTIMIZATION
                ? R.layout.activity_session_call_smartglass : R.layout.activity_session_call );
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        mRoomName = getIntent().getExtras().getString("ROOM_NAME");
        if (mRoomName == null) {
            this.finish();
        }

        mSignalrService = new SignalrService( "/signaling", true);
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
        PeerConnectionFactory.shutdownInternalTracer();
        new Handler().postDelayed(() -> mSignalrService.dispose(), 1000);
        super.onDestroy();
    }

    private void initViews() {
        mRootEglBase = EglBase.create();
        mLocalVideoView = findViewById(R.id.local_gl_surface_view);
        mLocalVideoView.init(mRootEglBase.getEglBaseContext(), null);
        mLocalVideoView.setZOrderMediaOverlay(true);
        mLocalVideoView.setMirror(false);
        mRemoteVideoView = findViewById(R.id.remote_gl_surface_view);
        mRemoteVideoView.init(mRootEglBase.getEglBaseContext(), null);
        mRemoteVideoView.setZOrderMediaOverlay(false);
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
                } else if(data.equalsIgnoreCase("bye")) {
                    handleRemoteHangup();
                }
            } else if (message instanceof LinkedTreeMap) {
                Object type = ((LinkedTreeMap) message).get("type");
                if(type != null) {
                    if (type.toString().equalsIgnoreCase("offer")) {
                        if(!mIsStarted) {
                            initiateCall();
                        }
                        mPeerConnection.setRemoteDescription(new CustomSdpObserver(),
                                new SessionDescription(SessionDescription.Type.OFFER, ((LinkedTreeMap) message).get("sdp").toString()));
                        sendAnswer();
                    } else if (type.toString().equalsIgnoreCase("answer") && mIsStarted) {
                        mPeerConnection.setRemoteDescription(new CustomSdpObserver(),
                                new SessionDescription(SessionDescription.Type.fromCanonicalForm(((LinkedTreeMap) message).get("type").toString()),
                                        ((LinkedTreeMap) message).get("sdp").toString()));
                    } else if (type.toString().equalsIgnoreCase("candidate") && mIsStarted) {
                        addIceCandidate((LinkedTreeMap) message);
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
        mCameraCapturer.initialize(surfaceTextureHelper, this, videoSource.getCapturerObserver());

        // Start recording
        mCameraCapturer.startCapture(640, 480, 30);
        mLocalVideoTrack.addSink(mLocalVideoView);

        // Try to initiate a call
        sendMessage("got user media");
        if(mIsInitiator) {
            initiateCall();
        }
    }

    private void initiateCall() {
        Log.d(TAG, "initiateCall");

        if (!mIsStarted && mIsChannelReady && mLocalVideoView != null) {
            createPeerConnection();

            if (mPeerConnection != null && mLocalAudioTrack != null && mLocalVideoTrack != null) {
                mPeerConnection.addTrack(mLocalAudioTrack, Arrays.asList("WebRTC-stream"));
                mPeerConnection.addTrack(mLocalVideoTrack, Arrays.asList("WebRTC-stream"));
            }

            mIsStarted = true;
            if (mIsInitiator) {
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

        mPeerConnection = mPeerConnectionFactory.createPeerConnection(config, new CustomPeerConnectionObserver() {
            @Override
            public void onIceCandidate(IceCandidate iceCandidate) {
                Log.d(TAG, "mPeerConnection::onIceCandidate");
                sendIceCandidate(iceCandidate);
            }

            @Override
            public void onAddTrack(RtpReceiver rtpReceiver, MediaStream[] mediaStreams) {
                Log.d(TAG, "mPeerConnection::onAddTrack");
                if (rtpReceiver.track() != null && rtpReceiver.track().kind() != null && rtpReceiver.track().kind().equals("video")) {
                    VideoTrack track = (VideoTrack) rtpReceiver.track();
                    if (track != null) {
                        track.addSink(mRemoteVideoView);
                    }
                }
            }
        });
    }

    private void sendOffer() {
        Log.d(TAG, "sendOffer");

        addTransceivers();
        mPeerConnection.createOffer(new CustomSdpObserver() {
            @Override
            public void onCreateSuccess(SessionDescription sessionDescription) {
                mPeerConnection.setLocalDescription(new CustomSdpObserver(), sessionDescription);
                try {
                    LinkedTreeMap<String, Object> offer = new LinkedTreeMap<String, Object>();
                    offer.put("type", sessionDescription.type.canonicalForm());
                    offer.put("sdp", sessionDescription.description);
                    sendMessage(offer);
                } catch (Exception e) {
                    Log.e(TAG, "sendOffer failed.", e);
                }
            }
        }, new MediaConstraints());
    }

    private void sendAnswer() {
        Log.d(TAG, "sendAnswer");

        addTransceivers();
        mPeerConnection.createAnswer(new CustomSdpObserver() {
            @Override
            public void onCreateSuccess(SessionDescription sessionDescription) {
                mPeerConnection.setLocalDescription(new CustomSdpObserver(), sessionDescription);
                try {
                    LinkedTreeMap<String, Object> answer = new LinkedTreeMap<String, Object>();
                    answer.put("type", sessionDescription.type.canonicalForm());
                    answer.put("sdp", sessionDescription.description);
                    sendMessage(answer);
                } catch (Exception e) {
                    Log.e(TAG, "sendAnswer failed.", e);
                }
            }
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
            LinkedTreeMap<String, Object> candidate = new LinkedTreeMap<String, Object>();
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

        if (mSignalrService != null) {
            mSignalrService.invoke("SendMessage", message, mRoomName);
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
    }

    private void handleRemoteHangup() {
        Log.d(TAG, "handleRemoteHangup");

        stopPeerConnection();
        mIsInitiator = true;
        runOnUiThread(() -> Toast.makeText(this, getString(R.string.session_call_remote_client_left), Toast.LENGTH_LONG).show());
    }

    private void stopPeerConnection() {
        Log.d(TAG, "stopPeerConnection");

        mIsStarted = false;
        mIsChannelReady = false;
        if (mPeerConnection != null) {
            mPeerConnection.close();
            mPeerConnection = null;
        }
    }
}
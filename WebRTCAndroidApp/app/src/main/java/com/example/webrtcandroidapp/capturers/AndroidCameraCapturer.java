package com.example.webrtcandroidapp.capturers;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.ImageFormat;
import android.hardware.Camera;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CameraMetadata;
import android.hardware.camera2.CaptureRequest;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.SystemClock;
import android.util.Log;
import android.util.Size;
import android.view.Surface;

import androidx.annotation.NonNull;

import com.example.webrtcandroidapp.ai.FaceAnonymizer;

import org.webrtc.Camera1Capturer;
import org.webrtc.Camera1Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.CapturerObserver;
import org.webrtc.NV21Buffer;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoCapturer;
import org.webrtc.VideoFrame;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

public class AndroidCameraCapturer extends Camera1Capturer implements VideoCapturer {

    private static final String TAG = "AndroidCameraCapturer";

    private static final boolean USE_FACE_ANONYMIZATION = false;

    private AndroidCameraCapturer(String deviceName, boolean captureToTexture) {
        super(deviceName, null, captureToTexture);
    }

    public static AndroidCameraCapturer create(boolean captureToTexture, boolean isCameraFront) {
        return new AndroidCameraCapturer(getDeviceName(captureToTexture, isCameraFront), captureToTexture);
    }

    private static String getDeviceName(boolean captureToTexture, boolean isCameraFront) {
        CameraEnumerator enumerator = new Camera1Enumerator(captureToTexture);

        String deviceName = null;
        for (String device : enumerator.getDeviceNames()) {
            if (enumerator.isFrontFacing(device) && isCameraFront) {
                deviceName = device;
                break;
            }
            if (enumerator.isBackFacing(device) && !isCameraFront) {
                deviceName = device;
                break;
            }
        }

        return deviceName == null ? enumerator.getDeviceNames()[0] : deviceName;
    }

    //region Properties and methods needed for Face Anonymization

    private final Object mStateLock = new Object();

    private FaceAnonymizer mFaceAnonymizer;
    private Handler mCameraThreadHandler;
    private CapturerObserver mObserver;
    private ImageReader mImageReader;
    private Surface mImageSurface;
    private Context mContext;
    private CameraDevice mCameraDevice;
    private CameraCaptureSession mCaptureSession;
    private Surface mSurface;
    private SurfaceTextureHelper mSurfaceHelper;

    private int mWidth;
    private int mHeight;
    private int mFrameRate;
    private long mLastProcessingTime = 0;

    @Override
    public void initialize(SurfaceTextureHelper surfaceTextureHelper, Context applicationContext, CapturerObserver capturerObserver) {
        if (USE_FACE_ANONYMIZATION) {
            mFaceAnonymizer = new FaceAnonymizer(applicationContext);
            mSurfaceHelper = surfaceTextureHelper;
            mCameraThreadHandler = surfaceTextureHelper.getHandler();
            mContext = applicationContext;
            mObserver = capturerObserver;
        }
        super.initialize(surfaceTextureHelper, applicationContext, capturerObserver);
    }

    @Override
    public void dispose() {
        if (mFaceAnonymizer != null) {
            mFaceAnonymizer.dispose();
        }
        super.dispose();
    }

    @Override
    public void startCapture(int width, int height, int frameRate) {
        if (USE_FACE_ANONYMIZATION) {
            mWidth = width;
            mHeight = height;
            mFrameRate = frameRate;

            if (mFaceAnonymizer != null) {
                mFaceAnonymizer.setupBitmapUtils(width, height);
            }

            if (mContext.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                mCameraThreadHandler.post(() -> {
                    synchronized (mStateLock) {
                        try {
                            CameraManager cameraManager = (CameraManager) mContext.getSystemService(Context.CAMERA_SERVICE);
                            String cameraId = getFrontCameraId(cameraManager);
                            setUpCameraOutputs(width, height);
                            cameraManager.openCamera(cameraId, mCameraListener, mCameraThreadHandler);
                        } catch (Exception e) {
                            Log.e(TAG, "startCapture: Failed.", e);
                        }
                    }
                });
            } else {
                Log.e(TAG, "startCapture: Failed - CAMERA permission missing.");
            }
        } else {
            super.startCapture(width, height, frameRate);
        }
    }

    private String getFrontCameraId(CameraManager cameraManager) {
        String cameraId = "";
        try {
            for (String camera : cameraManager.getCameraIdList()) {
                CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(camera);
                if (characteristics.get(CameraCharacteristics.LENS_FACING) == CameraMetadata.LENS_FACING_FRONT) {
                    cameraId = camera;
                    break;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return cameraId;
    }

    private void setUpCameraOutputs(int width, int height) {
        try {
            Size previewSize = new Size(width, height);
            mImageReader = ImageReader.newInstance(previewSize.getWidth(), previewSize.getHeight(), ImageFormat.YUV_420_888, 2);
            mImageReader.setOnImageAvailableListener(mOnImageAvailableListener, mCameraThreadHandler);
        } catch (Exception e) {
            Log.e(TAG, "setUpCameraOutputs: Failed.", e);
        }
    }

    private void processImage(Image img) {
        try {
            int width = img.getWidth();
            int height = img.getHeight();

            byte[] nv21;

            ByteBuffer yBuffer = img.getPlanes()[0].getBuffer();
            ByteBuffer uBuffer = img.getPlanes()[1].getBuffer();
            ByteBuffer vBuffer = img.getPlanes()[2].getBuffer();

            int ySize = yBuffer.remaining();
            int uSize = uBuffer.remaining();
            int vSize = vBuffer.remaining();

            nv21 = new byte[ySize * 2];

            yBuffer.get(nv21, 0, ySize);
            vBuffer.get(nv21, ySize, vSize);
            uBuffer.get(nv21, (int) (ySize * 1.5), uSize);

            byte[] nv21Original = Arrays.copyOf(nv21, nv21.length);
            mFaceAnonymizer.removeFacesFromNV21(nv21, ySize);
            boolean hasUnconfirmedDetections = mFaceAnonymizer.hasUnconfirmedDetections();
            if (hasUnconfirmedDetections || (System.currentTimeMillis() - mLastProcessingTime) > 200) {
                mFaceAnonymizer.analyzeImage(nv21Original);
                mLastProcessingTime = System.currentTimeMillis();
            }

            long timestampNS = TimeUnit.MILLISECONDS.toNanos(SystemClock.elapsedRealtime());
            NV21Buffer buffer = new NV21Buffer(nv21, width, height, null);
            final int FACE_ANONYMIZATION_ROTATION = 180;
            VideoFrame videoFrame = new VideoFrame(buffer, FACE_ANONYMIZATION_ROTATION + 90, timestampNS);
            mObserver.onFrameCaptured(videoFrame);
            videoFrame.release();
        } catch (Exception e) {
            Log.e(TAG, "processImage: Failed.", e);
        }
    }

    private void applyParametersInternal() {
        Log.d(TAG, "applyParametersInternal");

        synchronized (mStateLock) {
            if (mCaptureSession == null || mCameraDevice == null) {
                Log.w(TAG, "applyParametersInternal: Not allowed in this state.");
                return;
            }

            try {
                CaptureRequest.Builder builder = mCameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                builder.addTarget(mSurface);
                if (mImageSurface != null && mImageSurface.isValid()) {
                    builder.addTarget(mImageSurface);
                }
                builder.set(CaptureRequest.SENSOR_FRAME_DURATION, 1000000000L / mFrameRate);
                mCaptureSession.setRepeatingRequest(builder.build(), null, null);
            } catch (Exception e) {
                Log.e(TAG, "applyParametersInternal: Failed.", e);
            }
        }
    }

    private final CameraDevice.StateCallback mCameraListener = new CameraDevice.StateCallback() {
        @Override
        public void onOpened(@NonNull CameraDevice cameraDevice) {
            Log.d(TAG, "mCameraListener::onOpened");
            mCameraDevice = cameraDevice;
            synchronized (mStateLock) {
                try {
                    List<Surface> surfaceList = new ArrayList<>();

                    mSurfaceHelper.setTextureSize(mWidth, mHeight);
                    mSurface = new Surface(mSurfaceHelper.getSurfaceTexture());
                    surfaceList.add(mSurface);

                    if (mFaceAnonymizer != null) {
                        mImageSurface = mImageReader != null ? mImageReader.getSurface() : null;
                        if (mImageSurface == null) {
                            return;
                        }
                        surfaceList.add(mImageSurface);
                    }

                    cameraDevice.createCaptureSession(surfaceList, mCaptureSessionListener, mCameraThreadHandler);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }

        @Override
        public void onDisconnected(@NonNull CameraDevice cameraDevice) {
            Log.w(TAG, "mCameraListener::onDisconnected");
        }

        @Override
        public void onError(@NonNull CameraDevice cameraDevice, int error) {
            Log.e(TAG, "mCameraListener::onError");
        }
    };

    private final CameraCaptureSession.StateCallback mCaptureSessionListener = new CameraCaptureSession.StateCallback() {
        @Override
        public void onConfigured(@NonNull CameraCaptureSession cameraCaptureSession) {
            Log.d(TAG, "mCaptureSessionListener::onConfigured");
            if (mObserver != null) {
                mObserver.onCapturerStarted(true);
            }
            mCaptureSession = cameraCaptureSession;
            applyParametersInternal();
        }

        @Override
        public void onConfigureFailed(@NonNull CameraCaptureSession cameraCaptureSession) {
            Log.e(TAG, "mCaptureSessionListener::onConfigureFailed");
        }
    };

    private final ImageReader.OnImageAvailableListener mOnImageAvailableListener =
        reader -> {
            try (Image img = reader.acquireLatestImage()) {
                if (img != null) {
                    processImage(img);
                }
            } catch (Exception e) {
                Log.e(TAG, "onImageAvailable: Failed.", e);
            }
        };

    //endregion
}

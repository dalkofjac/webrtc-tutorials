package com.example.webrtcandroidapp;

import android.util.Log;

import org.webrtc.Camera1Capturer;
import org.webrtc.Camera1Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.VideoCapturer;

public class AndroidCameraCapturer extends Camera1Capturer implements VideoCapturer {

    private AndroidCameraCapturer(String deviceName, boolean captureToTexture) {
        super(deviceName, null, captureToTexture);
    }

    public static AndroidCameraCapturer create(boolean captureToTexture, boolean isCameraFront) {
        return new AndroidCameraCapturer(getDeviceName(captureToTexture, isCameraFront), captureToTexture);
    }

    public void switchCamera() {
        super.switchCamera(null);
    }

    public void dispose() {
        super.dispose();
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
}

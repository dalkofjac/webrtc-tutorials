package com.example.webrtcandroidapp.observers;

import android.util.Log;

import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;

public class CustomSdpObserver implements SdpObserver {

    private static final String TAG = "SdpObserver";

    @Override
    public void onCreateSuccess(SessionDescription sessionDescription) {
        Log.d(TAG, "onCreateSuccess");
    }

    @Override
    public void onSetSuccess() {
        Log.d(TAG, "onSetSuccess");
    }

    @Override
    public void onCreateFailure(String s) {
        Log.d(TAG, "onCreateFailure");
    }

    @Override
    public void onSetFailure(String s) {
        Log.d(TAG, "onSetFailure");
    }
}

package com.example.webrtcandroidapp;

import android.app.Application;

public class WebRTCAndroidApp extends Application {

    public static WebRTCAndroidApp mInstance;

    @Override
    public void onCreate() {
        super.onCreate();
        mInstance = this;
    }

    public static WebRTCAndroidApp get() { return mInstance; }
}

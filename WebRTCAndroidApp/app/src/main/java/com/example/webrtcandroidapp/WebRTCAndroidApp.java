package com.example.webrtcandroidapp;

import android.app.Application;

public class WebRTCAndroidApp extends Application {

    // Set this variable to "true" in case smart glasses' display optimization is needed
    public static final boolean USE_SMARTGLASS_OPTIMIZATION = false;

    public static WebRTCAndroidApp mInstance;

    @Override
    public void onCreate() {
        super.onCreate();
        mInstance = this;
    }

    public static WebRTCAndroidApp get() { return mInstance; }
}

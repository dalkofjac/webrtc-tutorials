package com.example.webrtcandroidapp;

import android.util.Log;

import com.microsoft.signalr.Action;
import com.microsoft.signalr.Action1;
import com.microsoft.signalr.HubConnection;
import com.microsoft.signalr.HubConnectionBuilder;
import com.microsoft.signalr.HubConnectionState;

import static io.reactivex.internal.functions.Functions.emptyConsumer;

public class SignalrService {

    public interface SignalrConnectionListener {
        void onConnected();
    }

    private static final String TAG = "SignalrService";

    private HubConnection mHubConnection;

    public SignalrService(String hubUrl) {
        Log.d(TAG, "SignalrService; hubUrl: " + hubUrl);

        try {
            mHubConnection = HubConnectionBuilder.create(hubUrl).build();
        } catch (Exception e) {
            Log.e(TAG, "SignalrService: Failed. [Error]: ", e);
        }
    }

    public void connect(SignalrConnectionListener listener) {
        Log.d(TAG, "connect");

        try {
            mHubConnection.start().doOnComplete(() -> {
                if(listener != null) {
                    listener.onConnected();
                }
            }).doOnError(emptyConsumer()).blockingAwait();
        } catch (Exception e) {
            Log.e(TAG, "connect: Failed. [Error]: ", e);
        }
    }

    public void define(String methodName, Action callback) {
        Log.d(TAG, "define; methodName: " + methodName);

        if (mHubConnection != null) {
            try {
                mHubConnection.on(methodName, callback);
            } catch (Exception e) {
                Log.e(TAG, "define: Failed. [Connection]: " + (mHubConnection != null ? mHubConnection.getConnectionState() : null));
            }
        } else {
            Log.e(TAG, "define: Failed. - mHubConnection is null.");
        }
    }

    public <T> void define(String methodName, Action1<T> callback, Class<T> param) {
        Log.d(TAG, "define; methodName: " + methodName);

        if (mHubConnection != null) {
            try {
                mHubConnection.on(methodName, callback, param);
            } catch (Exception e) {
                Log.e(TAG, "define: Failed. [Connection]: " + (mHubConnection != null ? mHubConnection.getConnectionState() : null));
            }
        } else {
            Log.e(TAG, "define: Failed. - mHubConnection is null.");
        }
    }

    public void invoke(String methodName, Object... args) {
        Log.d(TAG, "invoke; methodName: " + methodName);

        if (isConnected()) {
            try {
                mHubConnection.send(methodName, args);
            } catch (Exception e) {
                Log.e(TAG, "invoke: Failed. [Error]: ", e);
            }
        } else {
            Log.e(TAG, "invoke: Failed. [Connection]: " + (mHubConnection != null ? mHubConnection.getConnectionState() : null));
        }
    }

    public void disconnect() {
        Log.d(TAG, "disconnect");

        try {
            mHubConnection.stop();
        } catch (Exception e) {
            Log.e(TAG, "disconnect: Failed. [Connection]: " + (mHubConnection != null ? mHubConnection.getConnectionState() : null));
        }
    }

    public void dispose() {
        Log.d(TAG, "dispose");

        disconnect();
        mHubConnection = null;
    }

    public boolean isConnected() {
        return mHubConnection != null && mHubConnection.getConnectionState() == HubConnectionState.CONNECTED;
    }
}

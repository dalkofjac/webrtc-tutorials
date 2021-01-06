package com.example.webrtcandroidapp;

import org.webrtc.PeerConnection;

import java.util.ArrayList;
import java.util.List;

public class IceServerService {

    private static final String[] ICE_SERVERS = new String[] { BuildConfig.STUN_SERVER_1, BuildConfig.STUN_SERVER_2};

    public static List<PeerConnection.IceServer> getIceServers() {
        List<PeerConnection.IceServer> iceServers = new ArrayList<>();

        for (String iceServer : ICE_SERVERS) {
            PeerConnection.IceServer peerIceServer = PeerConnection.IceServer.builder(iceServer).createIceServer();
            iceServers.add(peerIceServer);
        }

        return iceServers;
    }
}

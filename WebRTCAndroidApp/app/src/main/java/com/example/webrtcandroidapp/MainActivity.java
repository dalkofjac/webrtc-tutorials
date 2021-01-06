package com.example.webrtcandroidapp;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

public class MainActivity extends AppCompatActivity implements View.OnClickListener {

    private final String[] mPermissions = {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        findViewById(R.id.btn_start).setOnClickListener(this);

        if(!hasPermissions(this, mPermissions)) {
            requestPermissions();
        }
    }

    @Override
    public void onClick(View v) {
        if(v.getId() == R.id.btn_start) {
            String roomName = ((EditText) findViewById(R.id.et_room)).getText().toString();

            if(roomName.length() < 2) {
                Toast.makeText(MainActivity.this, getString(R.string.error_room_name_length), Toast.LENGTH_SHORT).show();
                return;
            }

            Intent intent = new Intent(this, SessionCallActivity.class);
            Bundle dataBundle = new Bundle();
            dataBundle.putString("ROOM_NAME", roomName);
            intent.putExtras(dataBundle);
            startActivity(intent);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String permissions[], int[] grantResults) {
        if(!hasPermissions(this, mPermissions)){
            this.finish();
        }
    }

    private void requestPermissions(){
        int PERMISSION_ALL = 1;

        if(!hasPermissions(this, mPermissions)){
            ActivityCompat.requestPermissions(this, mPermissions, PERMISSION_ALL);
        }
    }

    private static boolean hasPermissions(Context context, String... permissions) {
        if (context != null && permissions != null) {
            for (String permission : permissions) {
                if (ActivityCompat.checkSelfPermission(context, permission) != PackageManager.PERMISSION_GRANTED) {
                    return false;
                }
            }
        }
        return true;
    }
}
package com.apkbilling.tv.services;

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.IBinder;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import com.apkbilling.tv.R;

public class HDMIBlockOverlayService extends Service {
    
    private static final String TAG = "HDMIBlockOverlayService";
    
    private WindowManager windowManager;
    private View overlayView;
    private boolean isOverlayVisible = false;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "HDMI Block Overlay Service created");
        
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createOverlayView();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            
            if ("SHOW_HDMI_BLOCK".equals(action)) {
                showBlockOverlay();
            } else if ("HIDE_HDMI_BLOCK".equals(action)) {
                hideBlockOverlay();
            }
        }
        
        return START_STICKY;
    }
    
    private void createOverlayView() {
        try {
            LayoutInflater inflater = LayoutInflater.from(this);
            overlayView = inflater.inflate(R.layout.overlay_hdmi_block, null);
            
            // Configure overlay to block entire screen
            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                PixelFormat.TRANSLUCENT
            );
            
            params.gravity = Gravity.CENTER;
            overlayView.setLayoutParams(params);
            
            // Make overlay completely opaque to block HDMI content
            overlayView.setBackgroundColor(Color.BLACK);
            
        } catch (Exception e) {
            Log.e(TAG, "Error creating overlay view", e);
        }
    }
    
    private void showBlockOverlay() {
        if (!isOverlayVisible && overlayView != null) {
            try {
                windowManager.addView(overlayView, (WindowManager.LayoutParams) overlayView.getLayoutParams());
                isOverlayVisible = true;
                Log.d(TAG, "HDMI block overlay shown");
            } catch (Exception e) {
                Log.e(TAG, "Error showing overlay", e);
            }
        }
    }
    
    private void hideBlockOverlay() {
        if (isOverlayVisible && overlayView != null) {
            try {
                windowManager.removeView(overlayView);
                isOverlayVisible = false;
                Log.d(TAG, "HDMI block overlay hidden");
            } catch (Exception e) {
                Log.e(TAG, "Error hiding overlay", e);
            }
        }
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "HDMI Block Overlay Service destroyed");
        
        hideBlockOverlay();
    }
}
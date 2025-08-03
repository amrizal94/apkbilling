package com.apkbilling.tv.services;

import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.display.DisplayManager;
import android.media.tv.TvInputManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Display;

import com.apkbilling.tv.MainActivity;

public class HDMIBlockService extends Service {
    
    private static final String TAG = "HDMIBlockService";
    private static final int MONITOR_INTERVAL = 3000; // Check every 3 seconds
    
    private Handler handler;
    private Runnable hdmiMonitorRunnable;
    private boolean isHDMIBlockingActive = true;
    private boolean isBillingSessionActive = false;
    private boolean isTemporarilyDisabled = false;
    
    private BroadcastReceiver hdmiReceiver;
    private DisplayManager displayManager;
    private TvInputManager tvInputManager;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "HDMI Block Service created");
        
        handler = new Handler(Looper.getMainLooper());
        displayManager = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
        tvInputManager = (TvInputManager) getSystemService(Context.TV_INPUT_SERVICE);
        
        setupHDMIReceiver();
        startHDMIMonitoring();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            
            if ("ENABLE_HDMI_BLOCK".equals(action)) {
                isHDMIBlockingActive = true;
                isBillingSessionActive = false;
                isTemporarilyDisabled = false;
                Log.d(TAG, "HDMI blocking enabled - monitoring started");
                
            } else if ("DISABLE_HDMI_BLOCK".equals(action)) {
                isHDMIBlockingActive = false;
                isBillingSessionActive = true;
                isTemporarilyDisabled = false;
                Log.d(TAG, "HDMI blocking disabled - session active");
                
            } else if ("TEMPORARY_DISABLE".equals(action)) {
                isHDMIBlockingActive = false;
                isBillingSessionActive = false; // Different from session-based disable
                isTemporarilyDisabled = true;
                Log.d(TAG, "HDMI blocking temporarily disabled for operator setup");
                
            } else if ("SESSION_STARTED".equals(action)) {
                isBillingSessionActive = true;
                isHDMIBlockingActive = false;
                isTemporarilyDisabled = false;
                Log.d(TAG, "Session started - HDMI access allowed");
                
            } else if ("SESSION_ENDED".equals(action)) {
                isBillingSessionActive = false;
                isHDMIBlockingActive = true;
                isTemporarilyDisabled = false;
                Log.d(TAG, "Session ended - HDMI blocking resumed");
                blockHDMIAccess();
            }
        }
        
        return START_STICKY;
    }
    
    private void setupHDMIReceiver() {
        hdmiReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                
                if ("android.intent.action.HDMI_AUDIO_PLUG".equals(action) ||
                    "android.intent.action.HDMI_PLUGGED".equals(action)) {
                    
                    boolean isConnected = intent.getBooleanExtra("state", false);
                    Log.d(TAG, "HDMI connection state changed: " + isConnected);
                    
                    if (isConnected && isHDMIBlockingActive && !isBillingSessionActive && !isTemporarilyDisabled) {
                        Log.d(TAG, "HDMI device connected but session not active - blocking access");
                        blockHDMIAccess();
                    }
                }
            }
        };
        
        IntentFilter filter = new IntentFilter();
        filter.addAction("android.intent.action.HDMI_AUDIO_PLUG");
        filter.addAction("android.intent.action.HDMI_PLUGGED");
        
        // Register receiver with proper flags for Android 13+
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(hdmiReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(hdmiReceiver, filter);
        }
    }
    
    private void startHDMIMonitoring() {
        hdmiMonitorRunnable = new Runnable() {
            @Override
            public void run() {
                if (isHDMIBlockingActive && !isBillingSessionActive && !isTemporarilyDisabled) {
                    checkCurrentInputSource();
                }
                handler.postDelayed(this, MONITOR_INTERVAL);
            }
        };
        
        handler.post(hdmiMonitorRunnable);
    }
    
    private void checkCurrentInputSource() {
        try {
            // Check if current input is HDMI
            if (isCurrentInputHDMI()) {
                Log.d(TAG, "HDMI input detected without active session - blocking access");
                blockHDMIAccess();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking input source", e);
        }
    }
    
    private boolean isCurrentInputHDMI() {
        try {
            // Method 1: Check display state
            Display[] displays = displayManager.getDisplays();
            for (Display display : displays) {
                if (display.getDisplayId() != Display.DEFAULT_DISPLAY) {
                    // External display detected (likely HDMI)
                    Log.d(TAG, "External display detected: " + display.getName());
                    return true;
                }
            }
            
            // Method 2: Check system properties for current input
            String currentInput = Settings.Global.getString(getContentResolver(), "tv_input_source");
            if (currentInput != null && currentInput.toLowerCase().contains("hdmi")) {
                Log.d(TAG, "Current input source is HDMI: " + currentInput);
                return true;
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking HDMI input", e);
        }
        
        return false;
    }
    
    private void blockHDMIAccess() {
        Log.d(TAG, "Blocking HDMI access - showing block overlay and returning to billing app");
        
        // Show HDMI block overlay to cover any HDMI content
        Intent overlayIntent = new Intent(this, HDMIBlockOverlayService.class);
        overlayIntent.setAction("SHOW_HDMI_BLOCK");
        startService(overlayIntent);
        
        // Force return to billing app
        Intent billingIntent = new Intent(this, MainActivity.class);
        billingIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                              Intent.FLAG_ACTIVITY_CLEAR_TOP |
                              Intent.FLAG_ACTIVITY_SINGLE_TOP |
                              Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT);
        billingIntent.putExtra("hdmi_blocked", true);
        
        startActivity(billingIntent);
        
        // Try to force TV back to Android TV input
        try {
            forceAndroidTVInput();
        } catch (Exception e) {
            Log.e(TAG, "Failed to force Android TV input", e);
        }
        
        // Hide overlay after a delay to allow billing app to come to front
        new Handler().postDelayed(() -> {
            Intent hideOverlayIntent = new Intent(this, HDMIBlockOverlayService.class);
            hideOverlayIntent.setAction("HIDE_HDMI_BLOCK");
            startService(hideOverlayIntent);
        }, 3000);
    }
    
    private void forceAndroidTVInput() {
        try {
            // Method 1: Try to switch to Android TV input via system settings
            Intent inputIntent = new Intent("android.intent.action.INPUT_METHOD_CHANGED");
            inputIntent.putExtra("input_source", "android_tv");
            sendBroadcast(inputIntent);
            
            // Method 2: Try to bring our app to absolute front
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(homeIntent);
            
            // Then immediately bring billing app back
            new Handler().postDelayed(() -> {
                Intent billingIntent = new Intent(this, MainActivity.class);
                billingIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                                      Intent.FLAG_ACTIVITY_CLEAR_TASK |
                                      Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(billingIntent);
            }, 500);
            
        } catch (Exception e) {
            Log.e(TAG, "Error forcing Android TV input", e);
        }
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "HDMI Block Service destroyed");
        
        if (handler != null && hdmiMonitorRunnable != null) {
            handler.removeCallbacks(hdmiMonitorRunnable);
        }
        
        if (hdmiReceiver != null) {
            try {
                unregisterReceiver(hdmiReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering HDMI receiver", e);
            }
        }
    }
}
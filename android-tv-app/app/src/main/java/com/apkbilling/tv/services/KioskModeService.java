package com.apkbilling.tv.services;

import android.app.ActivityManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import com.apkbilling.tv.MainActivity;
import com.apkbilling.tv.SettingsActivity;

import java.util.List;
import java.util.Arrays;

public class KioskModeService extends Service {
    
    private static final String TAG = "KioskModeService";
    private static final int CHECK_INTERVAL = 2000; // Check every 2 seconds
    
    // Whitelist of allowed activities when session is not active
    private static final List<String> ALLOWED_ACTIVITIES = Arrays.asList(
        "com.apkbilling.tv.MainActivity",
        "com.apkbilling.tv.SettingsActivity",
        "com.android.settings.wifi.WifiSettings",
        "com.android.settings.DisplaySettings",
        "com.android.settings.SoundSettings"
    );
    
    private Handler handler;
    private Runnable kioskRunnable;
    private boolean isKioskModeActive = true;
    private boolean isBillingSessionActive = false;
    private boolean isTemporarilyDisabled = false;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Kiosk Mode Service created");
        
        handler = new Handler(Looper.getMainLooper());
        startKioskMonitoring();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            
            if ("ENABLE_KIOSK".equals(action)) {
                isKioskModeActive = true;
                isBillingSessionActive = false;
                isTemporarilyDisabled = false;
                Log.d(TAG, "Kiosk mode enabled - monitoring started");
                
            } else if ("DISABLE_KIOSK".equals(action)) {
                isKioskModeActive = false;
                isBillingSessionActive = true;
                isTemporarilyDisabled = false;
                Log.d(TAG, "Kiosk mode disabled - session active");
                
            } else if ("TEMPORARY_DISABLE".equals(action)) {
                isKioskModeActive = false;
                isBillingSessionActive = false; // Different from session-based disable
                isTemporarilyDisabled = true;
                Log.d(TAG, "Kiosk mode temporarily disabled for operator setup");
                
            } else if ("SESSION_STARTED".equals(action)) {
                isBillingSessionActive = true;
                isKioskModeActive = false;
                isTemporarilyDisabled = false;
                Log.d(TAG, "Session started - kiosk monitoring paused");
                
            } else if ("SESSION_ENDED".equals(action)) {
                isBillingSessionActive = false;
                isKioskModeActive = true;
                isTemporarilyDisabled = false;
                Log.d(TAG, "Session ended - kiosk monitoring resumed");
            }
        }
        
        return START_STICKY; // Restart if killed
    }
    
    private void startKioskMonitoring() {
        kioskRunnable = new Runnable() {
            @Override
            public void run() {
                if (isKioskModeActive && !isBillingSessionActive && !isTemporarilyDisabled) {
                    checkForegroundApp();
                }
                handler.postDelayed(this, CHECK_INTERVAL);
            }
        };
        
        handler.post(kioskRunnable);
    }
    
    private void checkForegroundApp() {
        try {
            ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            List<ActivityManager.RunningTaskInfo> tasks = activityManager.getRunningTasks(1);
            
            if (tasks != null && !tasks.isEmpty()) {
                ActivityManager.RunningTaskInfo currentTask = tasks.get(0);
                String topPackageName = currentTask.topActivity.getPackageName();
                String topActivityName = currentTask.topActivity.getClassName();
                String billingPackageName = getPackageName();
                
                // Check if current activity is allowed
                boolean isAllowed = billingPackageName.equals(topPackageName) || 
                                  ALLOWED_ACTIVITIES.contains(topActivityName);
                
                if (!isAllowed) {
                    Log.d(TAG, "Unauthorized app detected: " + topPackageName + "/" + topActivityName + " - returning to billing");
                    returnToBillingApp();
                } else if (!billingPackageName.equals(topPackageName)) {
                    Log.d(TAG, "Allowed external activity: " + topActivityName);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking foreground app", e);
            // Fallback: always return to billing app if there's an error
            returnToBillingApp();
        }
    }
    
    private void returnToBillingApp() {
        Intent billingIntent = new Intent(this, MainActivity.class);
        billingIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                              Intent.FLAG_ACTIVITY_CLEAR_TOP |
                              Intent.FLAG_ACTIVITY_SINGLE_TOP |
                              Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT);
        billingIntent.putExtra("kiosk_forced_return", true);
        
        startActivity(billingIntent);
        Log.d(TAG, "Forced return to billing app");
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Kiosk Mode Service destroyed");
        
        if (handler != null && kioskRunnable != null) {
            handler.removeCallbacks(kioskRunnable);
        }
    }
}
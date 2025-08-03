package com.apkbilling.tv.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.apkbilling.tv.services.NetworkMonitorService;
import com.apkbilling.tv.utils.SettingsManager;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Received action: " + action);
        
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            Intent.ACTION_PACKAGE_REPLACED.equals(action)) {
            
            SettingsManager settingsManager = new SettingsManager(context);
            
            // Check if auto-start is enabled
            if (settingsManager.isAutoStartEnabled()) {
                Log.d(TAG, "Auto-start is enabled, starting services");
                startServices(context);
            } else {
                Log.d(TAG, "Auto-start is disabled");
            }
        }
    }
    
    private void startServices(Context context) {
        try {
            // Start network monitor service
            Intent networkIntent = new Intent(context, NetworkMonitorService.class);
            context.startService(networkIntent);
            
            Log.d(TAG, "Services started successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start services", e);
        }
    }
}
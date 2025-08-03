package com.apkbilling.tv.utils;

import android.content.Context;
import android.content.Intent;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import com.apkbilling.tv.admin.DeviceAdminReceiver;

public class PowerManager {
    
    public static void powerOffDevice(Context context) {
        try {
            DevicePolicyManager devicePolicyManager = 
                (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName adminReceiver = new ComponentName(context, DeviceAdminReceiver.class);
            
            if (devicePolicyManager != null && devicePolicyManager.isAdminActive(adminReceiver)) {
                devicePolicyManager.lockNow();
                
                Intent intent = new Intent("android.intent.action.ACTION_REQUEST_SHUTDOWN");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
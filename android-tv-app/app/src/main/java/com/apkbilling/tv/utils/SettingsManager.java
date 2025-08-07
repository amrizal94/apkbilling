package com.apkbilling.tv.utils;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

public class SettingsManager {
    private static final String PREFS_NAME = "APKBillingSettings";
    
    // Keys
    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_DEVICE_NAME = "device_name";
    private static final String KEY_DEVICE_LOCATION = "device_location";  
    private static final String KEY_WARNING_TIME = "warning_time_minutes";
    private static final String KEY_AUTO_START = "auto_start_on_boot";
    private static final String KEY_OVERLAY_POSITION = "overlay_position";
    private static final String KEY_FIRST_RUN = "first_run";
    private static final String KEY_KIOSK_MODE = "kiosk_mode_enabled";
    
    // Default values
    public static final String DEFAULT_SERVER_URL = "http://192.168.1.2:3000";
    public static final int DEFAULT_WARNING_TIME_MINUTES = 5;
    public static final boolean DEFAULT_AUTO_START = false;
    public static final String DEFAULT_OVERLAY_POSITION = "top_right";
    public static final boolean DEFAULT_KIOSK_MODE = true; // Enable by default for security
    
    private SharedPreferences prefs;
    private Context context;
    
    public SettingsManager(Context context) {
        this.context = context;
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        // Set defaults on first run
        if (isFirstRun()) {
            setDefaults();
            setFirstRun(false);
        }
    }
    
    private void setDefaults() {
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(KEY_SERVER_URL, DEFAULT_SERVER_URL);
        editor.putString(KEY_DEVICE_NAME, getDefaultDeviceName());
        editor.putInt(KEY_WARNING_TIME, DEFAULT_WARNING_TIME_MINUTES);
        editor.putBoolean(KEY_AUTO_START, DEFAULT_AUTO_START);
        editor.putString(KEY_OVERLAY_POSITION, DEFAULT_OVERLAY_POSITION);
        editor.putBoolean(KEY_KIOSK_MODE, DEFAULT_KIOSK_MODE);
        editor.apply();
    }
    
    // Server URL
    public String getServerUrl() {
        return prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL);
    }
    
    public void setServerUrl(String url) {
        prefs.edit().putString(KEY_SERVER_URL, url).apply();
    }
    
    public String getApiUrl() {
        return getServerUrl() + "/api";
    }
    
    // Device Name
    public String getDeviceName() {
        return prefs.getString(KEY_DEVICE_NAME, getDefaultDeviceName());
    }
    
    public void setDeviceName(String name) {
        prefs.edit().putString(KEY_DEVICE_NAME, name).apply();
    }
    
    // Device Location
    public String getDeviceLocation() {
        return prefs.getString(KEY_DEVICE_LOCATION, "");
    }
    
    public void setDeviceLocation(String location) {
        prefs.edit().putString(KEY_DEVICE_LOCATION, location).apply();
    }
    
    public static String getDefaultDeviceName() {
        return "AndroidTV-" + Build.MODEL.replaceAll("\\s+", "");
    }
    
    // Warning Time
    public int getWarningTimeMinutes() {
        return prefs.getInt(KEY_WARNING_TIME, DEFAULT_WARNING_TIME_MINUTES);
    }
    
    public void setWarningTimeMinutes(int minutes) {
        prefs.edit().putInt(KEY_WARNING_TIME, minutes).apply();
    }
    
    public long getWarningTimeMillis() {
        return getWarningTimeMinutes() * 60 * 1000L;
    }
    
    // Auto Start
    public boolean isAutoStartEnabled() {
        return prefs.getBoolean(KEY_AUTO_START, DEFAULT_AUTO_START);
    }
    
    public void setAutoStartEnabled(boolean enabled) {
        prefs.edit().putBoolean(KEY_AUTO_START, enabled).apply();
    }
    
    // Overlay Position
    public String getOverlayPosition() {
        return prefs.getString(KEY_OVERLAY_POSITION, DEFAULT_OVERLAY_POSITION);
    }
    
    public void setOverlayPosition(String position) {
        prefs.edit().putString(KEY_OVERLAY_POSITION, position).apply();
    }
    
    // Kiosk Mode
    public boolean isKioskModeEnabled() {
        return prefs.getBoolean(KEY_KIOSK_MODE, DEFAULT_KIOSK_MODE);
    }
    
    public void setKioskModeEnabled(boolean enabled) {
        prefs.edit().putBoolean(KEY_KIOSK_MODE, enabled).apply();
    }
    
    // First Run
    private boolean isFirstRun() {
        return prefs.getBoolean(KEY_FIRST_RUN, true);
    }
    
    private void setFirstRun(boolean firstRun) {
        prefs.edit().putBoolean(KEY_FIRST_RUN, firstRun).apply();
    }
    
    // Device ID (generated once and stored)
    public String getDeviceId() {
        String deviceId = prefs.getString("device_id", null);
        if (deviceId == null) {
            deviceId = generateDeviceId();
            prefs.edit().putString("device_id", deviceId).apply();
        }
        return deviceId;
    }
    
    private String generateDeviceId() {
        // Use Android ID if available
        String androidId = android.provider.Settings.Secure.getString(
            context.getContentResolver(), 
            android.provider.Settings.Secure.ANDROID_ID
        );
        
        if (androidId != null && !androidId.equals("9774d56d682e549c")) {
            return "ATV_" + androidId;
        }
        
        // Fallback to random ID
        return "ATV_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000);
    }
    
    // Validation helpers
    public boolean isValidConfiguration() {
        String serverUrl = getServerUrl();
        String deviceName = getDeviceName();
        
        return !serverUrl.isEmpty() && 
               !deviceName.isEmpty() && 
               serverUrl.startsWith("http") &&
               getWarningTimeMinutes() > 0;
    }
    
    // Export/Import settings (for backup)
    public String exportSettings() {
        StringBuilder sb = new StringBuilder();
        sb.append("server_url=").append(getServerUrl()).append("\n");
        sb.append("device_name=").append(getDeviceName()).append("\n");
        sb.append("warning_time=").append(getWarningTimeMinutes()).append("\n");
        sb.append("auto_start=").append(isAutoStartEnabled()).append("\n");
        sb.append("overlay_position=").append(getOverlayPosition()).append("\n");
        return sb.toString();
    }
    
    public void importSettings(String settingsData) {
        if (settingsData == null || settingsData.trim().isEmpty()) {
            return;
        }
        
        SharedPreferences.Editor editor = prefs.edit();
        String[] lines = settingsData.split("\n");
        
        for (String line : lines) {
            if (line.contains("=")) {
                String[] parts = line.split("=", 2);
                if (parts.length == 2) {
                    String key = parts[0].trim();
                    String value = parts[1].trim();
                    
                    switch (key) {
                        case "server_url":
                            editor.putString(KEY_SERVER_URL, value);
                            break;
                        case "device_name":
                            editor.putString(KEY_DEVICE_NAME, value);
                            break;
                        case "warning_time":
                            try {
                                editor.putInt(KEY_WARNING_TIME, Integer.parseInt(value));
                            } catch (NumberFormatException ignored) {}
                            break;
                        case "auto_start":
                            editor.putBoolean(KEY_AUTO_START, Boolean.parseBoolean(value));
                            break;
                        case "overlay_position":
                            editor.putString(KEY_OVERLAY_POSITION, value);
                            break;
                    }
                }
            }
        }
        
        editor.apply();
    }
    
    // Clear all settings
    public void clearAllSettings() {
        prefs.edit().clear().apply();
        setDefaults();
    }
    
    // Debug info
    public String getDebugInfo() {
        StringBuilder sb = new StringBuilder();
        sb.append("=== APK Billing Settings Debug ===\n");
        sb.append("Server URL: ").append(getServerUrl()).append("\n");
        sb.append("API URL: ").append(getApiUrl()).append("\n");
        sb.append("Device Name: ").append(getDeviceName()).append("\n");
        sb.append("Device ID: ").append(getDeviceId()).append("\n");
        sb.append("Warning Time: ").append(getWarningTimeMinutes()).append(" min\n");
        sb.append("Auto Start: ").append(isAutoStartEnabled()).append("\n");
        sb.append("Overlay Position: ").append(getOverlayPosition()).append("\n");
        sb.append("Valid Config: ").append(isValidConfiguration()).append("\n");
        sb.append("Device Model: ").append(Build.MODEL).append("\n");
        sb.append("Android Version: ").append(Build.VERSION.RELEASE).append("\n");
        return sb.toString();
    }
}
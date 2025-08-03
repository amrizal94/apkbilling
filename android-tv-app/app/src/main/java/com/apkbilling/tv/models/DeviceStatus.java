package com.apkbilling.tv.models;

public class DeviceStatus {
    public static final String STATUS_IDLE = "idle";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_PAUSED = "paused";
    public static final String STATUS_ERROR = "error";
    public static final String STATUS_MAINTENANCE = "maintenance";
    
    private String deviceId;
    private String deviceName;
    private String status;
    private String currentSessionId;
    private String customerName;
    private String packageName;
    private long sessionStartTime;
    private long sessionDuration;
    private double sessionAmount;
    private boolean isConnectedToServer;
    private String lastError;
    
    public DeviceStatus() {
        this.status = STATUS_IDLE;
        this.isConnectedToServer = false;
    }
    
    // Getters and Setters
    public String getDeviceId() {
        return deviceId;
    }
    
    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }
    
    public String getDeviceName() {
        return deviceName;
    }
    
    public void setDeviceName(String deviceName) {
        this.deviceName = deviceName;
    }
    
    public String getStatus() {
        return status;
    }
    
    public void setStatus(String status) {
        this.status = status;
    }
    
    public String getCurrentSessionId() {
        return currentSessionId;
    }
    
    public void setCurrentSessionId(String currentSessionId) {
        this.currentSessionId = currentSessionId;
    }
    
    public String getCustomerName() {
        return customerName;
    }
    
    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }
    
    public String getPackageName() {
        return packageName;
    }
    
    public void setPackageName(String packageName) {
        this.packageName = packageName;
    }
    
    public long getSessionStartTime() {
        return sessionStartTime;
    }
    
    public void setSessionStartTime(long sessionStartTime) {
        this.sessionStartTime = sessionStartTime;
    }
    
    public long getSessionDuration() {
        return sessionDuration;
    }
    
    public void setSessionDuration(long sessionDuration) {
        this.sessionDuration = sessionDuration;
    }
    
    public double getSessionAmount() {
        return sessionAmount;
    }
    
    public void setSessionAmount(double sessionAmount) {
        this.sessionAmount = sessionAmount;
    }
    
    public boolean isConnectedToServer() {
        return isConnectedToServer;
    }
    
    public void setConnectedToServer(boolean connectedToServer) {
        isConnectedToServer = connectedToServer;
    }
    
    public String getLastError() {
        return lastError;
    }
    
    public void setLastError(String lastError) {
        this.lastError = lastError;
    }
    
    // Helper methods
    public boolean isSessionActive() {
        return STATUS_ACTIVE.equals(status) && currentSessionId != null;
    }
    
    public boolean isIdle() {
        return STATUS_IDLE.equals(status);
    }
    
    public boolean hasError() {
        return STATUS_ERROR.equals(status) || lastError != null;
    }
    
    public long getSessionElapsedTime() {
        if (sessionStartTime > 0) {
            return System.currentTimeMillis() - sessionStartTime;
        }
        return 0;
    }
    
    public long getSessionRemainingTime() {
        if (sessionDuration > 0 && sessionStartTime > 0) {
            long elapsed = getSessionElapsedTime();
            long remaining = (sessionDuration * 60 * 1000) - elapsed; // convert minutes to milliseconds
            return Math.max(0, remaining);
        }
        return 0;
    }
    
    public boolean isSessionExpired() {
        return getSessionRemainingTime() == 0 && sessionDuration > 0;
    }
    
    public int getSessionProgressPercent() {
        if (sessionDuration > 0 && sessionStartTime > 0) {
            long elapsed = getSessionElapsedTime();
            long total = sessionDuration * 60 * 1000; // convert to milliseconds
            return (int) ((elapsed * 100) / total);
        }
        return 0;
    }
    
    public void startSession(String sessionId, String customerName, String packageName, long durationMinutes, double amount) {
        this.currentSessionId = sessionId;
        this.customerName = customerName;
        this.packageName = packageName;
        this.sessionDuration = durationMinutes;
        this.sessionAmount = amount;
        this.sessionStartTime = System.currentTimeMillis();
        this.status = STATUS_ACTIVE;
        this.lastError = null;
    }
    
    public void stopSession() {
        this.currentSessionId = null;
        this.customerName = null;
        this.packageName = null;
        this.sessionDuration = 0;
        this.sessionAmount = 0;
        this.sessionStartTime = 0;
        this.status = STATUS_IDLE;
        this.lastError = null;
    }
    
    public void pauseSession() {
        if (isSessionActive()) {
            this.status = STATUS_PAUSED;
        }
    }
    
    public void resumeSession() {
        if (STATUS_PAUSED.equals(status) && currentSessionId != null) {
            this.status = STATUS_ACTIVE;
        }
    }
    
    public void setError(String error) {
        this.lastError = error;
        this.status = STATUS_ERROR;
    }
    
    public void clearError() {
        this.lastError = null;
        if (STATUS_ERROR.equals(status)) {
            this.status = currentSessionId != null ? STATUS_ACTIVE : STATUS_IDLE;
        }
    }
}
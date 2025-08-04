package com.apkbilling.tv.services;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;
import androidx.annotation.Nullable;

import com.apkbilling.tv.utils.SettingsManager;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;

import org.json.JSONException;
import org.json.JSONObject;

import java.net.URISyntaxException;

public class WebSocketService extends Service {
    private static final String TAG = "WebSocketService";
    private Socket socket;
    private SettingsManager settingsManager;
    private String deviceId;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "WebSocket service created");
        
        settingsManager = new SettingsManager(this);
        deviceId = settingsManager.getDeviceId();
        
        initializeSocket();
    }

    private void initializeSocket() {
        try {
            String serverUrl = settingsManager.getServerUrl();
            if (serverUrl == null || serverUrl.isEmpty()) {
                Log.w(TAG, "Server URL not set, using default");
                serverUrl = "http://192.168.1.10:3000";
            }

            Log.d(TAG, "Connecting to WebSocket server: " + serverUrl);
            socket = IO.socket(serverUrl);

            setupEventListeners();
            connect();

        } catch (URISyntaxException e) {
            Log.e(TAG, "Invalid server URL", e);
        }
    }

    private void setupEventListeners() {
        // Connection events
        socket.on(Socket.EVENT_CONNECT, new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.d(TAG, "✅ Connected to WebSocket server");
                authenticateDevice();
            }
        });

        socket.on(Socket.EVENT_DISCONNECT, new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.d(TAG, "❌ Disconnected from WebSocket server");
            }
        });

        socket.on(Socket.EVENT_CONNECT_ERROR, new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.e(TAG, "❌ WebSocket connection error: " + args[0]);
            }
        });

        // Authentication events
        socket.on("authenticated", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.d(TAG, "🔐 Device authenticated with server");
            }
        });

        socket.on("auth_error", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.e(TAG, "🔐 Authentication error: " + args[0]);
            }
        });

        // Session events
        socket.on("session_started", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    Log.d(TAG, "🎯 Session started: " + data.toString());
                    
                    // Check if this event is for our device
                    String eventDeviceId = data.optString("device_id", "");
                    String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
                    
                    if (eventDeviceId.equals(rawDeviceId) || eventDeviceId.equals(deviceId)) {
                        Log.i(TAG, "✅ Session started for our device: " + data.optString("customer_name", ""));
                        
                        // Broadcast to MainActivity
                        Intent intent = new Intent("com.apkbilling.tv.SESSION_STARTED");
                        intent.putExtra("session_data", data.toString());
                        sendBroadcast(intent);
                    } else {
                        Log.d(TAG, "📱 Session started for different device: " + eventDeviceId + " (ours: " + rawDeviceId + ")");
                    }
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error handling session_started", e);
                }
            }
        });

        socket.on("session_ended", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    Log.d(TAG, "🛑 Session ended: " + data.toString());
                    
                    // Broadcast to MainActivity
                    Intent intent = new Intent("com.apkbilling.tv.SESSION_ENDED");
                    intent.putExtra("session_data", data.toString());
                    sendBroadcast(intent);
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error handling session_ended", e);
                }
            }
        });

        socket.on("time_added", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    Log.d(TAG, "⏰ Time added: " + data.toString());
                    
                    // Check if this event is for our device
                    String eventDeviceId = data.optString("device_id", "");
                    String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
                    
                    if (eventDeviceId.equals(rawDeviceId)) {
                        Log.i(TAG, "✅ Time added for our device: +" + data.optInt("additional_minutes", 0) + " minutes");
                        
                        // Broadcast to MainActivity and Background Service
                        Intent intent = new Intent("com.apkbilling.tv.TIME_ADDED");
                        intent.putExtra("additional_minutes", data.optInt("additional_minutes", 0));
                        intent.putExtra("new_duration", data.optInt("new_duration", 0));
                        intent.putExtra("device_name", data.optString("device_name", ""));
                        sendBroadcast(intent);
                        
                        // Also show toast
                        Intent toastIntent = new Intent("com.apkbilling.tv.SHOW_TOAST");
                        toastIntent.putExtra("message", "⏰ Time added: +" + data.optInt("additional_minutes", 0) + " minutes");
                        sendBroadcast(toastIntent);
                    }
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error handling time_added", e);
                }
            }
        });

        // New server timer events
        socket.on("timer_update", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    Log.d(TAG, "⏰ Timer update: " + data.toString());
                    
                    // Check if this event is for our device
                    String eventDeviceId = data.optString("device_id", "");
                    String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
                    
                    if (eventDeviceId.equals(rawDeviceId)) {
                        Log.i(TAG, "✅ Timer update for our device: " + data.optInt("remaining_minutes", 0) + " minutes");
                        
                        // Broadcast timer update
                        Intent intent = new Intent("com.apkbilling.tv.TIMER_UPDATE");
                        intent.putExtra("remaining_minutes", data.optInt("remaining_minutes", 0));
                        intent.putExtra("time_display", data.optString("time_display", ""));
                        sendBroadcast(intent);
                    }
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error handling timer_update", e);
                }
            }
        });

        socket.on("session_warning", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    Log.d(TAG, "⚠️ Session warning: " + data.toString());
                    
                    // Check if this event is for our device
                    String eventDeviceId = data.optString("device_id", "");
                    String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
                    
                    if (eventDeviceId.equals(rawDeviceId)) {
                        String message = data.optString("message", "Session warning");
                        Log.w(TAG, "⚠️ Warning for our device: " + message);
                        
                        // Broadcast warning
                        Intent intent = new Intent("com.apkbilling.tv.SESSION_WARNING");
                        intent.putExtra("message", message);
                        intent.putExtra("remaining_minutes", data.optInt("remaining_minutes", 0));
                        sendBroadcast(intent);
                    }
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error handling session_warning", e);
                }
            }
        });

        socket.on("sessionExpired", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    Log.d(TAG, "⏰ Session expired: " + data.toString());
                    
                    // Check if this event is for our device
                    String eventDeviceId = data.optString("deviceId", "");
                    String rawDeviceId = deviceId.startsWith("ATV_") ? deviceId.substring(4) : deviceId;
                    
                    if (eventDeviceId.equals(rawDeviceId)) {
                        Log.w(TAG, "⚠️ Our session expired remotely");
                        
                        // Broadcast to MainActivity
                        Intent intent = new Intent("com.apkbilling.tv.SESSION_EXPIRED");
                        intent.putExtra("session_data", data.toString());
                        sendBroadcast(intent);
                    }
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error handling sessionExpired", e);
                }
            }
        });

        // Device events
        socket.on("device_updated", new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                try {
                    JSONObject data = (JSONObject) args[0];
                    Log.d(TAG, "📱 Device updated: " + data.toString());
                } catch (Exception e) {
                    Log.e(TAG, "Error handling device_updated", e);
                }
            }
        });
    }

    private void authenticateDevice() {
        try {
            // Use the same authentication format as admin panel
            JSONObject user = new JSONObject();
            user.put("id", deviceId);
            user.put("username", "android_tv_" + deviceId);
            user.put("role", "device");
            user.put("device_id", deviceId);
            user.put("device_type", "android_tv");
            user.put("app_version", "1.0.0");
            
            JSONObject authData = new JSONObject();
            authData.put("user", user);
            
            Log.d(TAG, "Authenticating device: " + deviceId + " as user: android_tv_" + deviceId);
            socket.emit("authenticate", authData);
            
        } catch (JSONException e) {
            Log.e(TAG, "Error creating auth data", e);
        }
    }

    private void connect() {
        if (socket != null && !socket.connected()) {
            Log.d(TAG, "Connecting to WebSocket...");
            socket.connect();
        }
    }

    private void disconnect() {
        if (socket != null && socket.connected()) {
            Log.d(TAG, "Disconnecting from WebSocket...");
            socket.disconnect();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "WebSocket service started");
        
        if (socket != null && !socket.connected()) {
            connect();
        }
        
        return START_STICKY; // Restart service if killed
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "WebSocket service destroyed");
        disconnect();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null; // We don't need binding for this service
    }

    // Public methods for external communication
    public void emitHeartbeat() {
        if (socket != null && socket.connected()) {
            try {
                JSONObject heartbeatData = new JSONObject();
                heartbeatData.put("device_id", deviceId);
                heartbeatData.put("timestamp", System.currentTimeMillis());
                
                socket.emit("heartbeat", heartbeatData);
                Log.v(TAG, "💓 Heartbeat sent");
            } catch (JSONException e) {
                Log.e(TAG, "Error sending heartbeat", e);
            }
        }
    }

    public void emitSessionUpdate(String action, JSONObject sessionData) {
        if (socket != null && socket.connected()) {
            try {
                JSONObject updateData = new JSONObject();
                updateData.put("action", action);
                updateData.put("device_id", deviceId);
                updateData.put("session", sessionData);
                
                socket.emit("session_update", updateData);
                Log.d(TAG, "📡 Session update sent: " + action);
            } catch (JSONException e) {
                Log.e(TAG, "Error sending session update", e);
            }
        }
    }
}
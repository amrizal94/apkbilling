package com.apkbilling.tv.network;

import android.content.Context;
import android.util.Log;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import java.lang.reflect.Type;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class ApiClient {
    private static final String TAG = "ApiClient";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    
    private Context context;
    private OkHttpClient client;
    private Gson gson;
    private String baseUrl = "http://192.168.1.10:3000/api";
    
    public ApiClient(Context context) {
        this.context = context;
        this.gson = new GsonBuilder().create();
        this.client = new OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .build();
    }
    
    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }
    
    public interface ConnectionCallback {
        void onSuccess();
        void onError(String error);
    }
    
    public interface ApiCallback<T> {
        void onSuccess(T data);
        void onError(String error);
    }
    
    public interface SessionCallback {
        void onSuccess(SessionResponse session);
        void onError(String error);
    }
    
    public void checkConnection(ConnectionCallback callback) {
        String url = baseUrl + "/health";
        Log.d(TAG, "Testing connection to: " + url);
        
        Request request = new Request.Builder()
                .url(url)
                .build();
        
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Connection failed to " + url, e);
                callback.onError("Connection Failed: " + e.getMessage());
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                Log.d(TAG, "Response received: " + response.code());
                if (response.isSuccessful()) {
                    Log.d(TAG, "Connection test successful");
                    callback.onSuccess();
                } else {
                    Log.w(TAG, "Server error: " + response.code());
                    callback.onError("Server Error: " + response.code());
                }
                response.close();
            }
        });
    }
    
    public void discoverDevice(String deviceId, String deviceName, String location, ApiCallback<DeviceResponse> callback) {
        String url = baseUrl + "/tv/discover";
        
        DeviceRequest request = new DeviceRequest();
        request.device_id = deviceId;
        request.device_name = deviceName;
        request.device_type = "android_tv";
        request.screen_resolution = "1920x1080";
        request.os_version = android.os.Build.VERSION.RELEASE;
        request.app_version = "1.0.0";
        request.location = location;
        
        String json = gson.toJson(request);
        RequestBody body = RequestBody.create(json, JSON);
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(body)
                .build();
        
        client.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Device discovery failed", e);
                callback.onError("Discovery failed: " + e.getMessage());
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String responseBody = response.body().string();
                response.close();
                
                if (response.isSuccessful()) {
                    try {
                        ApiResponse<DeviceResponse> apiResponse = gson.fromJson(responseBody, ApiResponse.class);
                        if (apiResponse.success) {
                            callback.onSuccess(apiResponse.data);
                        } else {
                            callback.onError(apiResponse.message);
                        }
                    } catch (Exception e) {
                        callback.onError("Invalid response format");
                    }
                } else {
                    callback.onError("Server error: " + response.code());
                }
            }
        });
    }
    
    public void registerDevice(String deviceId, String deviceName, ApiCallback<DeviceResponse> callback) {
        String url = baseUrl + "/tv/register";
        
        DeviceRequest request = new DeviceRequest();
        request.device_id = deviceId;
        request.device_name = deviceName;
        request.device_type = "android_tv";
        request.screen_resolution = "1920x1080";
        request.os_version = android.os.Build.VERSION.RELEASE;
        request.app_version = "1.0.0";
        
        String json = gson.toJson(request);
        RequestBody body = RequestBody.create(json, JSON);
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(body)
                .build();
        
        client.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Register device failed", e);
                callback.onError("Registration failed: " + e.getMessage());
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String responseBody = response.body().string();
                response.close();
                
                if (response.isSuccessful()) {
                    try {
                        ApiResponse<DeviceResponse> apiResponse = gson.fromJson(responseBody, ApiResponse.class);
                        if (apiResponse.success) {
                            callback.onSuccess(apiResponse.data);
                        } else {
                            callback.onError(apiResponse.message);
                        }
                    } catch (Exception e) {
                        callback.onError("Invalid response format");
                    }
                } else {
                    callback.onError("Server error: " + response.code());
                }
            }
        });
    }
    
    public void startSession(String deviceId, String packageId, String customerId, ApiCallback<SessionResponse> callback) {
        String url = baseUrl + "/tv/session/start";
        
        SessionStartRequest request = new SessionStartRequest();
        request.device_id = deviceId;
        request.package_id = packageId;
        request.customer_id = customerId;
        
        String json = gson.toJson(request);
        RequestBody body = RequestBody.create(json, JSON);
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(body)
                .build();
        
        client.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Start session failed", e);
                callback.onError("Failed to start session: " + e.getMessage());
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String responseBody = response.body().string();
                response.close();
                
                if (response.isSuccessful()) {
                    try {
                        ApiResponse<SessionResponse> apiResponse = gson.fromJson(responseBody, ApiResponse.class);
                        if (apiResponse.success) {
                            callback.onSuccess(apiResponse.data);
                        } else {
                            callback.onError(apiResponse.message);
                        }
                    } catch (Exception e) {
                        callback.onError("Invalid response format");
                    }
                } else {
                    callback.onError("Server error: " + response.code());
                }
            }
        });
    }
    
    public void stopSession(String sessionId, ApiCallback<SessionResponse> callback) {
        String url = baseUrl + "/tv/session/stop";
        
        SessionStopRequest request = new SessionStopRequest();
        request.session_id = sessionId;
        
        String json = gson.toJson(request);
        RequestBody body = RequestBody.create(json, JSON);
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(body)
                .build();
        
        client.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Stop session failed", e);
                callback.onError("Failed to stop session: " + e.getMessage());
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String responseBody = response.body().string();
                response.close();
                
                if (response.isSuccessful()) {
                    try {
                        ApiResponse<SessionResponse> apiResponse = gson.fromJson(responseBody, ApiResponse.class);
                        if (apiResponse.success) {
                            callback.onSuccess(apiResponse.data);
                        } else {
                            callback.onError(apiResponse.message);
                        }
                    } catch (Exception e) {
                        callback.onError("Invalid response format");
                    }
                } else {
                    callback.onError("Server error: " + response.code());
                }
            }
        });
    }
    
    // Static method for simple session end (used by overlay service)
    public static void endSession(String customerName) {
        Log.i(TAG, "Session ended for customer: " + customerName);
        // This is a simplified method for logging purposes
        // In production, this should make proper API calls
    }
    
    public void getActiveSession(String deviceId, SessionCallback callback) {
        String url = baseUrl + "/tv/active-session/" + deviceId;
        Log.d(TAG, "Getting active session for device: " + deviceId);
        
        Request request = new Request.Builder()
                .url(url)
                .build();
        
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Get active session failed", e);
                callback.onError("Failed to get session: " + e.getMessage());
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String responseBody = response.body().string();
                response.close();
                
                if (response.isSuccessful()) {
                    try {
                        Type responseType = new TypeToken<ApiResponse<SessionResponse>>(){}.getType();
                        ApiResponse<SessionResponse> apiResponse = gson.fromJson(responseBody, responseType);
                        if (apiResponse.success && apiResponse.data != null) {
                            callback.onSuccess(apiResponse.data);
                        } else {
                            callback.onError(apiResponse.message != null ? apiResponse.message : "No active session");
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to parse session response", e);
                        Log.e(TAG, "Response body: " + responseBody);
                        callback.onError("Invalid response format");
                    }
                } else {
                    callback.onError("Server error: " + response.code());
                }
            }
        });
    }
    
    public void sendHeartbeat(String deviceId, ApiCallback<HeartbeatResponse> callback) {
        String url = baseUrl + "/tv/heartbeat/" + deviceId;
        
        Request httpRequest = new Request.Builder()
                .url(url)
                .post(RequestBody.create("", JSON))
                .build();
        
        client.newCall(httpRequest).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Heartbeat failed", e);
                callback.onError("Failed to send heartbeat: " + e.getMessage());
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                String responseBody = response.body().string();
                response.close();
                
                if (response.isSuccessful()) {
                    try {
                        ApiResponse<HeartbeatResponse> apiResponse = gson.fromJson(responseBody, ApiResponse.class);
                        if (apiResponse.success) {
                            callback.onSuccess(apiResponse.data);
                        } else {
                            callback.onError(apiResponse.message);
                        }
                    } catch (Exception e) {
                        callback.onError("Invalid response format");
                    }
                } else {
                    callback.onError("Server error: " + response.code());
                }
            }
        });
    }
    
    // Data classes
    public static class ApiResponse<T> {
        public boolean success;
        public String message;
        public T data;
    }
    
    public static class DeviceRequest {
        public String device_id;
        public String device_name;
        public String device_type;
        public String screen_resolution;
        public String os_version;
        public String app_version;
        public String location;
    }
    
    public static class DeviceResponse {
        public int id;
        public String device_id;
        public String device_name;
        public String status;
        public String created_at;
    }
    
    public static class SessionStartRequest {
        public String device_id;
        public String package_id;
        public String customer_id;
    }
    
    public static class SessionStopRequest {
        public String session_id;
    }
    
    public static class SessionResponse {
        public int session_id;
        public int device_id;
        public String customer_name;
        public String package_name;
        public int duration_minutes;
        public int remaining_minutes;
        public int elapsed_minutes;
        public String amount;
        public String status;
        public String start_time;
        public String end_time;
    }
    
    public static class HeartbeatResponse {
        public boolean success;
        public String message;
        public String timestamp;
    }
}
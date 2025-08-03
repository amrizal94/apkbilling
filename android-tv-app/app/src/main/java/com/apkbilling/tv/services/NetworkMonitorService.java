package com.apkbilling.tv.services;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.IBinder;
import android.util.Log;

import com.apkbilling.tv.utils.NetworkUtils;

public class NetworkMonitorService extends Service {
    private static final String TAG = "NetworkMonitorService";
    
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean isNetworkAvailable = false;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Network Monitor Service created");
        
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        setupNetworkCallback();
        registerNetworkCallback();
        
        // Check initial network state
        checkInitialNetworkState();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Network Monitor Service started");
        return START_STICKY; // Restart if killed
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null; // This is a started service, not bound
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Network Monitor Service destroyed");
        
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception e) {
                Log.e(TAG, "Failed to unregister network callback", e);
            }
        }
    }
    
    private void setupNetworkCallback() {
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                super.onAvailable(network);
                Log.d(TAG, "Network available: " + network);
                isNetworkAvailable = true;
                onNetworkStateChanged(true);
            }
            
            @Override
            public void onLost(Network network) {
                super.onLost(network);
                Log.d(TAG, "Network lost: " + network);
                isNetworkAvailable = false;
                onNetworkStateChanged(false);
            }
            
            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities networkCapabilities) {
                super.onCapabilitiesChanged(network, networkCapabilities);
                boolean hasInternet = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                boolean hasValidated = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                
                Log.d(TAG, "Network capabilities changed - Internet: " + hasInternet + ", Validated: " + hasValidated);
                
                if (hasInternet && hasValidated) {
                    onInternetAvailable();
                } else {
                    onInternetUnavailable();
                }
            }
        };
    }
    
    private void registerNetworkCallback() {
        try {
            NetworkRequest.Builder builder = new NetworkRequest.Builder();
            builder.addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            NetworkRequest networkRequest = builder.build();
            
            connectivityManager.registerNetworkCallback(networkRequest, networkCallback);
            Log.d(TAG, "Network callback registered");
        } catch (Exception e) {
            Log.e(TAG, "Failed to register network callback", e);
        }
    }
    
    private void checkInitialNetworkState() {
        boolean networkAvailable = NetworkUtils.isNetworkAvailable(this);
        isNetworkAvailable = networkAvailable;
        
        Log.d(TAG, "Initial network state: " + networkAvailable);
        onNetworkStateChanged(networkAvailable);
        
        if (networkAvailable) {
            onInternetAvailable();
        }
    }
    
    private void onNetworkStateChanged(boolean isAvailable) {
        Log.d(TAG, "Network state changed: " + isAvailable);
        
        // Broadcast network state change to other components
        Intent broadcastIntent = new Intent("com.apkbilling.tv.NETWORK_STATE_CHANGED");
        broadcastIntent.putExtra("network_available", isAvailable);
        broadcastIntent.putExtra("device_ip", NetworkUtils.getDeviceIPAddress());
        
        if (isAvailable) {
            broadcastIntent.putExtra("wifi_ssid", NetworkUtils.getWifiSSID(this));
        }
        
        sendBroadcast(broadcastIntent);
    }
    
    private void onInternetAvailable() {
        Log.d(TAG, "Internet connection available");
        
        // Notify that internet is available - can start API communications
        Intent broadcastIntent = new Intent("com.apkbilling.tv.INTERNET_AVAILABLE");
        broadcastIntent.putExtra("device_ip", NetworkUtils.getDeviceIPAddress());
        broadcastIntent.putExtra("network_info", NetworkUtils.getNetworkInfo(this));
        sendBroadcast(broadcastIntent);
    }
    
    private void onInternetUnavailable() {
        Log.d(TAG, "Internet connection unavailable");
        
        // Notify that internet is unavailable - should pause API communications
        Intent broadcastIntent = new Intent("com.apkbilling.tv.INTERNET_UNAVAILABLE");
        sendBroadcast(broadcastIntent);
    }
    
    public boolean isNetworkAvailable() {
        return isNetworkAvailable;
    }
}
package com.apkbilling.tv.utils;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class NetworkUtils {
    
    public static boolean isNetworkAvailable(Context context) {
        ConnectivityManager connectivityManager = 
            (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
        return activeNetworkInfo != null && activeNetworkInfo.isConnected();
    }
    
    public static boolean isWifiConnected(Context context) {
        ConnectivityManager connectivityManager = 
            (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo wifiInfo = connectivityManager.getNetworkInfo(ConnectivityManager.TYPE_WIFI);
        return wifiInfo != null && wifiInfo.isConnected();
    }
    
    public static String getWifiSSID(Context context) {
        WifiManager wifiManager = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        WifiInfo wifiInfo = wifiManager.getConnectionInfo();
        if (wifiInfo != null) {
            String ssid = wifiInfo.getSSID();
            if (ssid != null && ssid.startsWith("\"") && ssid.endsWith("\"")) {
                ssid = ssid.substring(1, ssid.length() - 1);
            }
            return ssid;
        }
        return "Unknown";
    }
    
    public static String getDeviceIPAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface intf : interfaces) {
                List<InetAddress> addrs = Collections.list(intf.getInetAddresses());
                for (InetAddress addr : addrs) {
                    if (!addr.isLoopbackAddress()) {
                        String sAddr = addr.getHostAddress();
                        boolean isIPv4 = sAddr.indexOf(':') < 0;
                        if (isIPv4) {
                            return sAddr;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "127.0.0.1";
    }
    
    public static List<String> getPossibleServerIPs() {
        List<String> serverIPs = new ArrayList<>();
        String deviceIP = getDeviceIPAddress();
        
        if (deviceIP != null && !deviceIP.equals("127.0.0.1")) {
            // Extract network prefix (e.g., 192.168.1.xxx)
            String[] parts = deviceIP.split("\\.");
            if (parts.length == 4) {
                String networkPrefix = parts[0] + "." + parts[1] + "." + parts[2] + ".";
                
                // Common server IPs in local network
                serverIPs.add(networkPrefix + "1");    // Router/Gateway
                serverIPs.add(networkPrefix + "10");   // Common server IP
                serverIPs.add(networkPrefix + "100");  // Common server IP
                serverIPs.add(networkPrefix + "200");  // Common server IP
                
                // Add current device IP subnet variations
                for (int i = 1; i <= 254; i++) {
                    String possibleIP = networkPrefix + i;
                    if (!possibleIP.equals(deviceIP) && !serverIPs.contains(possibleIP)) {
                        // Only add first few most likely candidates
                        if (serverIPs.size() < 10) {
                            if (i <= 20 || i >= 100) {
                                serverIPs.add(possibleIP);
                            }
                        }
                    }
                }
            }
        }
        
        // Add common development IPs
        serverIPs.add("192.168.1.2");
        serverIPs.add("192.168.0.10");
        serverIPs.add("10.0.0.10");
        serverIPs.add("172.16.0.10");
        
        // Remove duplicates while preserving order
        List<String> uniqueIPs = new ArrayList<>();
        for (String ip : serverIPs) {
            if (!uniqueIPs.contains(ip)) {
                uniqueIPs.add(ip);
            }
        }
        
        return uniqueIPs;
    }
    
    public static String getNetworkInfo(Context context) {
        StringBuilder info = new StringBuilder();
        
        info.append("Network Status:\n");
        info.append("- Connected: ").append(isNetworkAvailable(context)).append("\n");
        info.append("- WiFi: ").append(isWifiConnected(context)).append("\n");
        info.append("- SSID: ").append(getWifiSSID(context)).append("\n");
        info.append("- Device IP: ").append(getDeviceIPAddress()).append("\n");
        
        info.append("\nSuggested Server IPs:\n");
        List<String> serverIPs = getPossibleServerIPs();
        for (int i = 0; i < Math.min(serverIPs.size(), 5); i++) {
            info.append("- ").append(serverIPs.get(i)).append(":3000\n");
        }
        
        return info.toString();
    }
    
    public static boolean isValidIPAddress(String ip) {
        if (ip == null || ip.isEmpty()) {
            return false;
        }
        
        String[] parts = ip.split("\\.");
        if (parts.length != 4) {
            return false;
        }
        
        try {
            for (String part : parts) {
                int num = Integer.parseInt(part);
                if (num < 0 || num > 255) {
                    return false;
                }
            }
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }
    
    public static String formatServerUrl(String ip, int port) {
        if (isValidIPAddress(ip)) {
            return "http://" + ip + ":" + port;
        }
        return null;
    }
    
    public static String extractIPFromUrl(String url) {
        if (url != null && url.startsWith("http://")) {
            String withoutProtocol = url.substring(7); // Remove "http://"
            int colonIndex = withoutProtocol.indexOf(':');
            if (colonIndex > 0) {
                return withoutProtocol.substring(0, colonIndex);
            }
        }
        return null;
    }
    
    public static int extractPortFromUrl(String url) {
        if (url != null && url.startsWith("http://")) {
            String withoutProtocol = url.substring(7); // Remove "http://"
            int colonIndex = withoutProtocol.indexOf(':');
            if (colonIndex > 0 && colonIndex < withoutProtocol.length() - 1) {
                try {
                    String portStr = withoutProtocol.substring(colonIndex + 1);
                    return Integer.parseInt(portStr);
                } catch (NumberFormatException e) {
                    return 3000; // default port
                }
            }
        }
        return 3000; // default port
    }
}
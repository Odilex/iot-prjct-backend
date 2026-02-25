# 🌐 Smart Campus Hub - Connection Guide

This guide explains how to connect your different frontend portals and IoT devices to the backend server during the exhibition.

## 📡 1. Backend API Base URL
First, identify your server's IP address. Every frontend needs this.
*   **Base URL:** `http://[YOUR_IP]:3000/api`
*   **WebSocket URL:** `ws://[YOUR_IP]:3000`
*   **MQTT Broker:** `mqtt://[YOUR_IP]:1883` (If running locally)

---

## 👨‍👩‍👧‍👦 1. Parent Portal (Mobile/Web)
The Parent Portal is used by parents to check attendance and wallet balances.

**Connection Configuration:**
In your Frontend `.env` or Config file:
```javascript
const API_URL = "http://[YOUR_IP]:3000/api/parent";
```

**Key Endpoints:**
*   `GET /api/parent/students` - Get linked students
*   `GET /api/parent/attendance` - View attendance history
*   `GET /api/parent/assignments` - View student assignments
*   `GET /api/parent/transactions` - View wallet/fee history

**Authentication:** 
All requests require an `Authorization` header:
`Bearer [JWT_TOKEN]`

---

## 🖥️ 2. Admin/Staff Dashboard
Used by teachers and school administrators.

**Connection Configuration:**
```javascript
const STAFF_API = "http://[YOUR_IP]:3000/api/staff";
const ADMIN_API = "http://[YOUR_IP]:3000/api/admin";
```

**Key Endpoints:**
*   `POST /api/staff/assignments` - Create new assignments
*   `GET /api/staff/attendance` - Monitor school-wide attendance
*   `GET /api/admin/system/stats` - Overall school statistics

---

## 🤖 3. IoT & Hardware (ESP32 / Arduino)
Devices (Attenance Scanners, Canteen Terminals) connect via **MQTT**.

**MQTT Topics to Subscribe/Publish:**
1.  **Attendance Scanner:**
    *   **Publish to:** `iot/attendance/scan`
    *   **Payload:** `{"cardUid": "A1B2C3D4", "deviceId": "SCAN_01"}`
2.  **Canteen Terminal (Payment):**
    *   **Publish to:** `iot/canteen/transaction`
    *   **Payload:** `{"cardUid": "A1B2C3D4", "amount": 10.50}`

**WebSocket (Real-Time Updates):**
If the Dashboard needs to show scans instantly without refreshing:
*   Listen for events on: `ws://[YOUR_IP]:3000`
*   Event names: `attendance_update`, `low_balance_alert`

---

## ⚠️ Important Exhibition Settings

### 1. CORS Configuration
In your backend `.env`, ensure this is set so other PCs can connect:
```env
CORS_ORIGIN="*"
```

### 2. Network Connectivity
*   **On the Same Wi-Fi:** Use your local IP (e.g., `192.168.1.5`).
*   **On Different Networks:** Use **Ngrok** to get a public URL:
    ```bash
    ngrok http 3000
    ```
    (Then use the `https://d066-154-68-64-10.ngrok-free.app/api` URL in your frontends).

### 3. Database Sync
Ensure your database is reachable. If you get connection errors, switch your `DATABASE_URL` to use **Port 6543** (Supabase Connection Pooler).

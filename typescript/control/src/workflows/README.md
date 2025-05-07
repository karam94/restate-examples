# Workflow Services

This directory contains the workflow services that handle different device states and transitions.

## Import Workflow (Port 9080)

The Import Workflow handles the charging process for devices.

### Validate Import
Note: Your key has to match the import workflow key in the device object seen in the UI.
```bash
curl -X POST http://localhost:9080/import/{deviceId}/validate/send \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "device-123",
    "deviceType": "myenergi",
    "type": "CLOUD_DEVICE_SUCCESSFUL_START_CHARGE",
    "timestamp": "2024-04-29T20:01:00Z"
  }'
```

### Check Workflow Status
```bash
curl http://localhost:9080/restate/workflow/import/{deviceId}/attach
```

## Idle Workflow (Port 9082)

The Idle Workflow manages the idle state of devices.

### Start Idle Workflow
```bash
curl -X POST http://localhost:9082/idle/{deviceId}/run/send \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "vehicle-123",
    "deviceType": "myenergi",
    "type": "IDLE",
    "timestamp": "2024-04-29T20:31:00Z",
    "startTime": "2024-04-29T20:31:00Z"
  }'
```

## Workflow Behavior

### Import Workflow
1. Starts the charging process
2. Waits for validation of successful charge start
3. Automatically transitions to idle state after the specified end time
4. Handles validation events throughout the process

### Idle Workflow
1. Manages the device's idle state
2. Currently a placeholder for future idle state management features


# Device Object API

The Device Object service runs on port 9081 and provides endpoints for managing device states and handling power control events.

## API Endpoints

### Control Device State
Note: The key has to match the deviceId.
```bash
curl -X POST http://localhost:9081/device/{deviceId}/control/send \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "device-123",
    "deviceType": "myenergi",
    "type": "IMPORT",
    "timestamp": "2025-04-29T20:00:00Z",
    "startTime": "2025-04-29T20:00:00Z",
    "endTime": "2025-05-29T21:00:00Z"
  }'
```

### Get Device State
```bash
curl http://localhost:9081/device/{deviceId}/getState
```

## Device States

The device can be in one of three states:
- `IDLE`: Device is not actively charging or exporting
- `IMPORT`: Device is charging (importing power)
- `EXPORT`: Device is exporting power (not yet implemented)

## State Transitions

The device object automatically manages state transitions through workflows:
- When receiving a power event with `power: 0`, it triggers the IDLE Workflow
- When receiving a power event with `power: 1`, it triggers the IMPORT Workflow
- When receiving a power event with `power: -1`, it sets the state to EXPORT (workflow not yet implemented)
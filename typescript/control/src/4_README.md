# Charging Workflow Example

This example demonstrates a simple charging workflow that:
1. Consumes an event to start charging a vehicle (identified by a deviceId)
2. Raises an event to EventBridge (stubbed in this example)
3. Waits for a VALIDATED event to come in with the same deviceId
4. Completes the workflow

## Testing the Workflow

`npm install --global @restatedev/restate-server@latest @restatedev/restate@latest`
`restate-server`
`npm run example-4`
`restate deployments register http://localhost:9080`

### 1. Start the Workflow

Start the workflow by sending a POST request to initiate charging for a vehicle:

```bash
curl -X POST http://localhost:8080/charging/vehicle-123/run/send \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "vehicle-123",
    "timestamp": "2024-04-29T20:00:00Z"
  }'
```

### 2. Send a Validation Event

Send a validation event to complete the workflow:

```bash
curl -X POST http://localhost:8080/charging/vehicle-123/validate \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "vehicle-123",
    "status": "VALIDATED",
    "timestamp": "2024-04-29T20:01:00Z"
  }'
```

### 3. Check Workflow Status

Check the status of the workflow:

```bash
curl http://localhost:8080/restate/workflow/charging/vehicle-123/attach
```

## Expected Behavior

1. When you start the workflow:
   - The service will log "Starting charging workflow for device: vehicle-123"
   - It will publish a START_CHARGING event to EventBridge (stubbed)
   - The workflow will wait for validation

2. When you send the validation event:
   - The service will log "Received validation event for device: vehicle-123"
   - The workflow will complete with a success message

3. When you check the status:
   - You'll see the final result of the workflow
   - If validated, you'll see a success message
   - If failed, you'll see a failure message 
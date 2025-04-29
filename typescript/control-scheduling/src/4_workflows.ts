import * as restate from "@restatedev/restate-sdk";
import * as restateClients from "@restatedev/restate-sdk-clients";

// Define our types
interface StartChargingEvent {
  deviceId: string;
  timestamp: string;
}

interface ValidationEvent {
  deviceId: string;
  status: 'VALIDATED' | 'FAILED';
  timestamp: string;
}

// Stub for EventBridge event publishing
const publishToEventBridge = async (event: any) => {
  console.log('Publishing to EventBridge:', event);
  // In a real implementation, this would use AWS SDK to publish to EventBridge
  return { success: true };
};

// Define our workflow
const chargingWorkflow = restate.workflow({
  name: "charging",
  handlers: {
    // --- The workflow logic ---
    run: async (ctx: restate.WorkflowContext, event: StartChargingEvent) => {
      // workflow ID = device ID; workflow runs once per device
      const deviceId = ctx.key;
      console.log(`Starting charging workflow for device: ${deviceId}`);

      // Publish start charging event to EventBridge
      await ctx.run("publish-start-event", async () => {
        await publishToEventBridge({
          type: 'START_CHARGING',
          deviceId: event.deviceId,
          timestamp: event.timestamp
        });
      });

      // Wait for validation event
      const validationResult = await ctx.promise<ValidationEvent>("validation");
      
      if (validationResult.status === 'VALIDATED') {
        console.log(`Charging validated for device: ${deviceId}`);
        return { status: 'success', message: 'Charging workflow completed successfully' };
      } else {
        console.log(`Charging validation failed for device: ${deviceId}`);
        return { status: 'failed', message: 'Charging validation failed' };
      }
    },

    // --- Handler for validation events ---
    validate: async (ctx: restate.WorkflowSharedContext, event: ValidationEvent) => {
      console.log(`Received validation event for device: ${event.deviceId}`);
      
      // Resolve the promise for the workflow
      await ctx.promise<ValidationEvent>("validation").resolve(event);
      
      return { status: 'success', message: 'Validation event processed' };
    }
  }
});

export type ChargingApi = typeof chargingWorkflow;

// Create an HTTP endpoint to serve our workflow
restate.endpoint().bind(chargingWorkflow).listen(9080);

console.log('Charging workflow service started on port 8080');

/*
To test the workflow:

1. Start the workflow:
curl -X POST http://localhost:8080/charging/vehicle-123/run/send \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "vehicle-123",
    "timestamp": "2024-04-29T20:00:00Z"
  }'

2. Send a validation event:
curl -X POST http://localhost:8080/charging/vehicle-123/validate \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "vehicle-123",
    "status": "VALIDATED",
    "timestamp": "2024-04-29T20:01:00Z"
  }'

3. Check the workflow status:
curl http://localhost:8080/restate/workflow/charging/vehicle-123/attach
*/ 
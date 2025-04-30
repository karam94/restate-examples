import * as restate from "@restatedev/restate-sdk";
import * as restateClients from "@restatedev/restate-sdk-clients";

interface ImportEvent {
  deviceId: string;
  timestamp: string;
  endTime: string;
}

interface ValidationEvent {
  deviceId: string;
  status: 'VALIDATED' | 'FAILED';
  timestamp: string;
  type?: string;
}

// TODO: This should be a restate service that publishes to EventBridge
const publishToEventBridge = async (event: any) => {
  console.log('Publishing to EventBridge:', event);
  return { success: true };
};

const importWorkflow = restate.workflow({
  name: "import",
  handlers: {
    run: async (ctx: restate.WorkflowContext, event: ImportEvent) => {
      const deviceId = ctx.key;
      console.log(`Starting charging workflow for device: ${deviceId}`);

      await ctx.run("publish-start-event", async () => {
        await publishToEventBridge({
          type: 'START_CHARGING',
          deviceId: event.deviceId,
          timestamp: event.timestamp,
          endTime: event.endTime
        });
      });

      console.log(`Charging workflow started for device: ${deviceId}`);

      const validationResult = await ctx.promise<ValidationEvent>("validation");
      console.log(`Validation result: ${JSON.stringify(validationResult)}`);

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
      console.log(`Received import validation event for device: ${event.deviceId}`);
      await ctx.promise<ValidationEvent>("validation").resolve(event);
      
      return { status: 'success', message: 'Validation event processed' };
    },
  }
});

export type ImportApi = typeof importWorkflow;

// Create an HTTP endpoint to serve our workflow
restate.endpoint().bind(importWorkflow).listen(9080);

console.log('Charging workflow service started on port 9080');

/*
To test the workflow:

1. Start the workflow:
curl -X POST http://localhost:8080/charging/vehicle-123/run/send \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "device-123",
    "timestamp": "2024-04-29T20:00:00Z",
    "endTime": "2024-04-29T21:00:00Z"
  }'

2. Send a validation event:
curl -X POST http://localhost:8080/charging/vehicle-123/validate \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "device-123",
    "status": "VALIDATED",
    "timestamp": "2024-04-29T20:01:00Z"
  }'

3. Wait for end time to be reached (or manually stop charging):
curl -X POST http://localhost:8080/charging/vehicle-123/stop \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "vehicle-123",
    "timestamp": "2024-04-29T20:30:00Z",
    "reason": "User requested stop"
  }'

  // TODO: Idle should be a separate workflow (/idle/vehicle-123/run/send)
4. Send idle validation event:
curl -X POST http://localhost:8080/charging/vehicle-123/validate \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "vehicle-123",
    "status": "VALIDATED",
    "timestamp": "2024-04-29T20:31:00Z",
    "type": "IDLE"
  }'

5. Check the workflow status:
curl http://localhost:8080/restate/workflow/charging/vehicle-123/attach
*/ 

//  -H 'idempotency-key: ad5472esg4dsg525dssdfa5loi' \ 
// Could be added to the request to make it idempotent (prevents duplicate runs)
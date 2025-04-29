import * as restate from "@restatedev/restate-sdk";
import * as restateClients from "@restatedev/restate-sdk-clients";

// Define our types
interface StartChargingEvent {
  deviceId: string;
  timestamp: string;
  endTime: string;  // When charging should automatically stop
}

interface StopChargingEvent {
  deviceId: string;
  timestamp: string;
  reason?: string;
}

interface ValidationEvent {
  deviceId: string;
  status: 'VALIDATED' | 'FAILED';
  timestamp: string;
  type?: string;
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
          timestamp: event.timestamp,
          endTime: event.endTime
        });
      });

      // Wait for validation event
      const validationResult = await ctx.promise<ValidationEvent>("validation");
      console.log(`Validation result: ${JSON.stringify(validationResult)}`);
      if (validationResult.status === 'VALIDATED') {
        console.log(`Charging validated for device: ${deviceId}`);
        
        // Calculate time until end
        const endTime = new Date(event.endTime);
        const now = new Date();
        const timeUntilEnd = now.getTime() - endTime.getTime();
        
        if (timeUntilEnd > 0) {
          console.log(`Waiting ${timeUntilEnd}ms until end time for device: ${deviceId}`);
          
          // Create a promise that will be resolved when either:
          // 1. The end time is reached
          // 2. A manual stop is requested
          const stopPromise = ctx.promise<void>("stop");
          
          // Wait for either end time or manual stop
          await Promise.race([
            ctx.sleep(timeUntilEnd).then(() => {
              console.log(`End time reached for device: ${deviceId}`);
              return stopPromise.resolve();
            }),
            stopPromise
          ]);
          
          // At this point, either end time was reached or manual stop was requested
          // The stop handler will handle the actual stopping and validation
          
          // Wait for the workflow to complete (which happens in the stop handler)
          await ctx.promise<void>("workflow-complete");
          
          return { 
            status: 'success', 
            message: 'Charging workflow completed successfully'
          };
        } else {
          console.log(`End time already passed for device: ${deviceId}`);
          return { 
            status: 'failed', 
            message: 'End time already passed'
          };
        }
      } else {
        console.log(`Charging validation failed for device: ${deviceId}`);
        return { status: 'failed', message: 'Charging validation failed' };
      }
    },

    // --- Handler for validation events ---
    validate: async (ctx: restate.WorkflowSharedContext, event: ValidationEvent) => {
      console.log(`Received validation event for device: ${event.deviceId}`);
      
      // Check if this is a charging or idle validation
      const isIdleValidation = event.type === 'IDLE';
      
      // Resolve the appropriate promise for the workflow
      if (isIdleValidation) {
        await ctx.promise<ValidationEvent>("idle-validation").resolve(event);
      } else {
        await ctx.promise<ValidationEvent>("validation").resolve(event);
      }
    },

    // TODO: Idle should be a separate workflow
    // --- Handler for stop charging events ---
    stop: async (ctx: restate.WorkflowSharedContext, event: StopChargingEvent) => {
      console.log(`Received stop charging event for device: ${event.deviceId}`);
      
      // Publish stop charging event to EventBridge
      await ctx.run("publish-stop-event", async () => {
        await publishToEventBridge({
          type: 'STOP_CHARGING',
          deviceId: event.deviceId,
          timestamp: event.timestamp,
          reason: event.reason
        });
      });

      // Resolve the stop promise to signal the run handler
      await ctx.promise<void>("stop").resolve();

      // Wait for idle validation
      const validationResult = await ctx.promise<ValidationEvent>("idle-validation");
      console.log(`Idle validation result: ${JSON.stringify(validationResult)}`);

      if (validationResult.status === 'VALIDATED') {
        console.log(`Idle state validated for device: ${event.deviceId}`);
        // Signal that the workflow is complete
        await ctx.promise<void>("workflow-complete").resolve();
        return { 
          status: 'success', 
          message: 'Charging stopped and validated successfully',
          reason: event.reason || 'No reason provided'
        };
      } else {
        console.log(`Idle validation failed for device: ${event.deviceId}`);
        // Signal that the workflow is complete
        await ctx.promise<void>("workflow-complete").resolve();
        return { 
          status: 'failed', 
          message: 'Idle validation failed',
          reason: event.reason || 'No reason provided'
        };
      }
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
    "timestamp": "2024-04-29T20:00:00Z",
    "endTime": "2024-04-29T21:00:00Z"
  }'

2. Send a validation event:
curl -X POST http://localhost:8080/charging/vehicle-123/validate \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "vehicle-123",
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
import * as restate from "@restatedev/restate-sdk";
import * as restateClients from "@restatedev/restate-sdk-clients";
import { ImportApi } from "./import_workflow";

const ImportWorkflowObject: ImportApi = { name: "import" };

interface DeviceState {
  status: 'IDLE' | 'IMPORT' | 'ERROR';
  lastChargingStart?: string;
  lastChargingEnd?: string;
  currentWorkflowId?: string;
}

const deviceObject = restate.object({
  name: "device",
  handlers: {
    import: async (ctx: restate.ObjectContext, event: { timestamp: string; endTime: string }) => {
      const deviceId = ctx.key;
      const state = await ctx.get<DeviceState>("state") ?? { status: 'IDLE' }; 
      console.log(`Starting charging workflow for device: ${deviceId}`);

      const response = await
      ctx.workflowClient(ImportWorkflowObject, `${deviceId}-${event.timestamp}`)
      .run({ deviceId, timestamp: event.timestamp, endTime: event.endTime });

      console.log(`Charging workflow submitted for device: ${deviceId}`);
      console.log(response);

      state.status = 'IMPORT';
      state.lastChargingStart = event.timestamp;
      state.currentWorkflowId = deviceId;
      await ctx.set("state", state);

      //return { status: 'success', message: 'Charging started' };
    },

    // Get current device state
    getState: async (ctx: restate.ObjectContext) => {
      return await ctx.get<DeviceState>("state") ?? { status: 'IDLE' };
    }
  }
});

export type DeviceApi = typeof deviceObject;

// Create an HTTP endpoint to serve our device object
restate.endpoint().bind(deviceObject).listen(9081);

console.log('Device object service started on port 9081'); 

// # Start charging
// curl -X POST http://localhost:9081/device/vehicle-123/startCharging \
//   -H 'Content-Type: application/json' \
//   -d '{
//     "timestamp": "2024-04-29T20:00:00Z",
//     "endTime": "2024-04-29T21:00:00Z"
//   }'

// # Check device state
// curl http://localhost:9081/device/vehicle-123/getState

/*
# Handle validation
curl -X POST http://localhost:9081/device/vehicle-123/handleValidation \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "VALIDATED",
    "timestamp": "2024-04-29T20:01:00Z",
    "type": "IDLE"
  }'
  */
import * as restate from "@restatedev/restate-sdk";
import { AmiEvent, AmiEventType, ControlEventType, DeviceState, IdleDeviceEvent, ImportDeviceEvent, PowerEventFromEventbridge } from "../types";
import { ParentDeviceStateMachineObject } from "./parent_device_state_machine";

const parentDeviceStateMachineObject: ParentDeviceStateMachineObject = { name: "parent-device-state-machine" };


const publishToEventBridge = async (event: any) => {
  console.log('Publishing to EventBridge:', event);
  return { success: true };
};

const deviceStateMachineObject = restate.object({
  name: "device-state-machine",
  handlers: {
    idle: async (ctx: restate.ObjectContext, event: IdleDeviceEvent) => {    
      const deviceId = ctx.key;  
      console.log(`IDLE: ${event.deviceId}`);
      ctx.set("currentEventExecuting", event);

      const status = await ctx.get<ControlEventType>("status");
      if (status === ControlEventType.IDLE) {
        return `Device ${deviceId} is already IDLE`;
      }

      await publishToEventBridge(event);
      ctx.set("status", ControlEventType.AWAITING_IDLE);
      const { id, promise }  = ctx.awakeable<AmiEvent>();
      ctx.set("validationId", id);
      const validationResult = await promise;

      if(validationResult.type === AmiEventType.CLOUD_DEVICE_SUCCESSFUL_STOP_CHARGE) {
        ctx.set("status", ControlEventType.IDLE);
        console.log(`Device ${deviceId} is now IDLE`);
        const { id: cancellationAwakeable } = ctx.awakeable<string>();
        ctx.set("cancellationAwakeable", cancellationAwakeable);
        return cancellationAwakeable;
      } else {
        throw new Error(`Device ${deviceId} failed to IDLE... retrying...`);
      }
    },

    // TODO: If another event comes in, how do we stop the sleep & change state?
    import: async (ctx: restate.ObjectContext, event: ImportDeviceEvent) => {      
      const deviceId = ctx.key;  
      const { id: validationId, promise: validationPromise } = ctx.awakeable<AmiEvent>();
      const { id: cancellationAwakeable, promise: cancellationPromise } = ctx.awakeable<string>();
      ctx.set("cancellationAwakeable", cancellationAwakeable);
      console.log(`IMPORT: ${event.deviceId}`);
      ctx.set("currentEventExecuting", event);

      const status = await ctx.get<ControlEventType>("status");
      if (status === ControlEventType.IMPORT) {
        return `Device ${deviceId} is already IMPORT`;
      }

      await publishToEventBridge(event);
      ctx.set("status", ControlEventType.AWAITING_IMPORT);

      console.log(`Validation awakeable id: ${validationId}`);
      ctx.set("validationId", validationId);
      const validationResult = await restate.CombineablePromise.race([validationPromise, cancellationPromise]);

      if(validationResult === AmiEventType.CLOUD_DEVICE_SUCCESSFUL_START_CHARGE) {
        console.log(`Device ${deviceId} is now IMPORTING`);
        ctx.set("status", ControlEventType.IMPORT);

        const endTimeMs = new Date(event.endTime).getTime();
        const currentTimeMs = new Date().getTime();
        const delaySeconds = Math.max(0, Math.floor((endTimeMs - currentTimeMs) / 1000));

        console.log(`Device ${deviceId} waiting for ${delaySeconds} seconds before stopping charging...`);
        
        await ctx.sleep(delaySeconds * 1000);

        console.log(`Device ${deviceId} IDLE instruction completed...stopping charging...`);
        
        ctx.objectSendClient(deviceStateMachineObject, deviceId).idle({
          deviceId: event.deviceId,
          deviceType: event.deviceType,
          type: ControlEventType.IDLE,
          timestamp: new Date().toISOString(),
          startTime: new Date().toISOString()
        });

        await cancellationPromise;
      } else if(validationResult !== undefined) { 
        console.log('cancelled');
      } else {
        throw new Error(`Device ${deviceId} failed to IMPORT... retrying...`);
      }
    },

    export: async (ctx: restate.ObjectContext, event: PowerEventFromEventbridge) => {      
      console.log(`Export: ${event.deviceId}`);
    },

    validate: async (ctx: restate.ObjectContext, event: AmiEvent) => {
      // Note: ctx.key is the awakeable id
      console.log(`Received validation event for device: ${event.deviceId}`);
      ctx.resolveAwakeable<AmiEvent>(ctx.key, event);
    }
  }
});

export type DeviceStateMachineObject = typeof deviceStateMachineObject;

restate.endpoint().bind(deviceStateMachineObject).listen(9084);
console.log('Device state machine object service started on port 9081'); 
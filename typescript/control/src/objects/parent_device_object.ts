import * as restate from "@restatedev/restate-sdk";
import { PowerEventFromEventbridge, DeviceState, ControlEventType } from "../types";
import { DeviceObject } from "./device_object";
import { ImportWorkflow } from "../workflows/import_workflow";

const deviceObject: DeviceObject = { name: "device" };
const importWorkflow: ImportWorkflow = { name: "import" };

const parentDeviceObject = restate.object({
  name: "parent-device",
  handlers: {
    control: async (ctx: restate.ObjectContext, event: PowerEventFromEventbridge) => {
      console.log('parent device control - ctx.key: ', ctx.key);
      console.log(`Parent device handling control for device: ${event.deviceId}`);

      const deviceState = await ctx.objectClient(deviceObject, ctx.key).getState();
      console.log(`Device state: ${JSON.stringify(deviceState)}`);

      if (deviceState.currentWorkflowId && deviceState.status !== ControlEventType.IDLE) {
        //ctx.cancel(deviceState.currentWorkflowId as restate.InvocationId);
        console.log("cancelling workflow: ", deviceState.currentWorkflowId);
        await ctx.workflowClient(importWorkflow, ctx.key).cancel();
      } else {
        console.log("starting workflow");
        const result = await ctx.objectClient(deviceObject, ctx.key).control(event);
        return result;
      }
    },

    getState: async (ctx: restate.ObjectContext) => {
      const deviceId = ctx.key;
      return await ctx.objectClient(deviceObject, deviceId).getState();
    }
  }
});

export type ParentDeviceObject = typeof parentDeviceObject; 
restate.endpoint().bind(parentDeviceObject).listen(9083);
console.log('Parent device object service started on port 9083'); 
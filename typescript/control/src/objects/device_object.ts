import * as restate from "@restatedev/restate-sdk";
import { ImportWorkflow } from "../workflows/import_workflow";
import { IdleWorkflow } from "../workflows/idle_workflow";
import { ControlEventType, DeviceState, IdleDeviceEvent, ImportDeviceEvent, PowerEventFromEventbridge } from "../types";

const idleWorkflow: IdleWorkflow = { name: "idle" };
const importWorkflow: ImportWorkflow = { name: "import" };
// const exportWorkflow: ExportWorkflow = { name: "export" };

const deviceObject = restate.object({
  name: "device",
  handlers: {
    control: async (ctx: restate.ObjectContext, event: PowerEventFromEventbridge) => {      
      console.log(`Starting control for device: ${event.deviceId}`);

      switch (event.power) {
        case 0:
          const idleControlEvent: IdleDeviceEvent = {
            deviceId: event.deviceId,
            deviceType: event.deviceType,
            type: ControlEventType.IDLE,
            timestamp: event.timestamp,
            startTime: event.start // TODO: How do we handle when its in the future? 
          };

          ctx.set('status', ControlEventType.IDLE);
          break;
        case 1:
          const importControlEvent: ImportDeviceEvent = {
            deviceId: event.deviceId,
            deviceType: event.deviceType,
            type: ControlEventType.IMPORT,
            timestamp: event.timestamp,
            startTime: event.start,  // TODO: How do we handle when its in the future? 
            endTime: event.end
          };

          ctx.set('status', ControlEventType.IMPORT);
          console.log(`device_object ctx.key: ${ctx.key}`);
          const handle = ctx.workflowClient(importWorkflow, ctx.key).run(importControlEvent);
          const importWorkflowId = await handle.invocationId;
          console.log(`Import workflow ID: ${importWorkflowId}`);
          ctx.set('currentWorkflowId', importWorkflowId);
          break;
        case -1:
          ctx.set('status', ControlEventType.EXPORT);
          console.log('EXPORT workflow still not implemented!');
          break;
      }

      return { status: 'success', message: 'Power event consumed for device: ' + event.deviceId };
    },

    getState: async (ctx: restate.ObjectContext) => {
      const status = await ctx.get<ControlEventType>("status") ?? ControlEventType.IDLE;
      const currentWorkflowId = await ctx.get<string>("currentWorkflowId");
      return { status, currentWorkflowId };
    },

    setStatus: async (ctx: restate.ObjectContext, status: ControlEventType) => {
      ctx.set('status', status);
      return { status: 'success', message: 'Status set to ' + status };
    },

    clearWorkflowId: async (ctx: restate.ObjectContext) => {
      ctx.set('currentWorkflowId', undefined);
      return { status: 'success', message: 'Workflow ID cleared' };
    },
  }
});

export type DeviceObject = typeof deviceObject;

restate.endpoint().bind(deviceObject).listen(9081);
console.log('Device object service started on port 9081'); 
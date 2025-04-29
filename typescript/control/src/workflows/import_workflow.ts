import * as restate from "@restatedev/restate-sdk";
import { IdleWorkflow } from "./idle_workflow";
import { AmiEvent, ImportDeviceEvent, AmiEventType, ControlEventType, IdleDeviceEvent } from "../types";
import { DeviceObject } from "../objects/device_object";

const IdleWorkflowObject: IdleWorkflow = { name: "idle" };
const deviceObject: DeviceObject = { name: "device" };

// TODO: This should be a restate service that publishes to EventBridge
const publishToEventBridge = async (event: any) => {
  console.log('Publishing to EventBridge:', event);
  return { success: true };
};

const importWorkflow = restate.workflow({
  name: "import",
  handlers: {
    run: async (ctx: restate.WorkflowContext, event: ImportDeviceEvent) => {
      console.log(`Starting charging workflow for device: ${event.deviceId}...`);

      const cancelled = ctx.promise<boolean>("cancelled");
      const validation = ctx.promise<AmiEvent>("validation");

      await ctx.run(async () => {
        console.log(`Tell integration to IMPORT...`);
        await publishToEventBridge(event);
      });

      console.log(`Wait to receive validation event for device: ${event.deviceId}...`);

      const result = await restate.CombineablePromise.race([
        validation.get(),
        cancelled.get()
      ]);

      if (result === true) {
        console.log(`Workflow cancelled before validation for device: ${event.deviceId}`);
        return { status: 'cancelled', message: 'Charging workflow was cancelled before validation' };
      }

      const integrationValidationResult = result as AmiEvent;
      console.log(`Integration Validation result: ${JSON.stringify(integrationValidationResult)}`);

      if (integrationValidationResult.type === AmiEventType.CLOUD_DEVICE_SUCCESSFUL_START_CHARGE) {
        console.log(`IMPORT validation received for device: ${event.deviceId}...`);

        const endTimeMs = new Date(event.endTime).getTime();
        const currentTimeMs = new Date().getTime();
        const delaySeconds = Math.max(0, Math.floor((endTimeMs - currentTimeMs) / 1000));

        console.log(`Waiting for ${delaySeconds} seconds before stopping charging...`);
        
        // Race between the delay and cancellation
        const sleep = ctx.sleep(delaySeconds * 1000);
        const finalResult = await restate.CombineablePromise.race([sleep, cancelled.get()]);
        
        if (finalResult === true) {
          console.log(`Workflow cancelled during charging for device: ${event.deviceId}`);
          return { status: 'cancelled', message: 'Charging workflow was cancelled during charging' };
        }

        ctx.workflowSendClient(IdleWorkflowObject, event.deviceId)
          .run({
            ...event,
            type: ControlEventType.IDLE,
          } as IdleDeviceEvent);

        return { status: 'success', message: 'Charging workflow completed successfully' };
      } else {
        console.log(`Failed to validate IMPORT for device: ${event.deviceId}`);
        return { status: 'failed', message: 'Charging validation failed' };
      }
    },

    validate: async (ctx: restate.WorkflowSharedContext, event: AmiEvent) => {
      console.log(`Received validation event for device: ${event.deviceId}`);
      ctx.promise("validation").resolve(event);
      return { status: 'success', message: 'Validation event processed' };
    },

    cancel: async (ctx: restate.WorkflowSharedContext) => {
      console.log(`Cancelling IMPORT workflow: ${ctx.key}`);
      ctx.promise<boolean>("cancelled").resolve(true);
      await ctx.objectClient(deviceObject, ctx.key).clearWorkflowId();
      return { status: 'success', message: 'IMPORT workflow cancelled' };
    }
  }
});

export type ImportWorkflow = typeof importWorkflow;

restate.endpoint().bind(importWorkflow).listen(9080);
console.log('Charging workflow service started on port 9080');

//  -H 'idempotency-key: ad5472esg4dsg525dssdfa5loi' \ 
// Could be added to the request to make it idempotent (prevents duplicate runs)
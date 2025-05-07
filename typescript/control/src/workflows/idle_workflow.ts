import * as restate from "@restatedev/restate-sdk";
import { IdleDeviceEvent } from "../types";

const idleWorkflow = restate.workflow({
  name: "idle",
  handlers: {
    run: async (ctx: restate.WorkflowContext, event: IdleDeviceEvent) => {
      const deviceId = ctx.key;
      console.log(`Starting idle workflow for device: ${deviceId}`);
      
      // TODO: Implement idle state logic here
      return { status: 'success', message: 'Device is now idle' };
    }
  }
});

export type IdleWorkflow = typeof idleWorkflow;

restate.endpoint().bind(idleWorkflow).listen(9082);
console.log('Idle workflow service started on port 9082'); 
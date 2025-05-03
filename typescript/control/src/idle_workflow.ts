import * as restate from "@restatedev/restate-sdk";

interface IdleEvent {
  deviceId: string;
  timestamp: string;
}

const idleWorkflow = restate.workflow({
  name: "idle",
  handlers: {
    run: async (ctx: restate.WorkflowContext, event: IdleEvent) => {
      const deviceId = ctx.key;
      console.log(`Starting idle workflow for device: ${deviceId}`);
      
      // TODO: Implement idle state logic here
      return { status: 'success', message: 'Device is now idle' };
    }
  }
});

export type IdleApi = typeof idleWorkflow;

restate.endpoint().bind(idleWorkflow).listen(9082);
console.log('Idle workflow service started on port 9082'); 
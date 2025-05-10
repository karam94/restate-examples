/*
* All requests are handled by the parent device state machine.
*
* Maintains a state of all device executions with a cancellation awakeable.
* 
* If a request comes in for a device that is already executing, & we need to cancel an existing thing, 
* we will resolve the cancellation awakeable before starting the new thing.
* 
*/

import * as restate from "@restatedev/restate-sdk";
import { AmiEvent, AmiEventType, ControlEventType, DeviceState, IdleDeviceEvent, ImportDeviceEvent, PowerEventFromEventbridge } from "../types";
import { ObjectContext } from "@restatedev/restate-sdk";
import { DeviceStateMachineObject } from "./device_state_machine";

type Devices = {
    devices: DeviceItem[];
  };
  
  type DeviceItem = {
    deviceId: string;
    cancellationAwakeable: string | undefined;
    lastUpdated: string;
  };

  const deviceStateMachineObject: DeviceStateMachineObject = { name: "device-state-machine" };

const parentDeviceStateMachineObject = restate.object({
  name: "parent-device-state-machine",
  handlers: {
    idle: async (ctx: ObjectContext<Devices>, event: IdleDeviceEvent) => {    
        const deviceId = ctx.key;
        const state = await getState(ctx);
        const deviceFound = state.devices.find(d => d.deviceId === deviceId);

        if(deviceFound && deviceFound.cancellationAwakeable) {
            // cancel the existing device run
            ctx.resolveAwakeable(deviceFound.cancellationAwakeable);
            // Remove the deviceFound from state
            state.devices = state.devices.filter(d => d.deviceId !== deviceId);
            console.log('Setting state to: ', state);
            setState(ctx, state);
            ctx.objectSendClient(deviceStateMachineObject, deviceId).idle(event);
        } else {
            const cancellationAwakeable = await ctx.objectClient(deviceStateMachineObject, deviceId).idle(event);
            state.devices.push({ deviceId, cancellationAwakeable, lastUpdated: new Date().toISOString() });
            console.log('Setting state to: ', state);
            setState(ctx, state);
        }
    },

    import: async (ctx: ObjectContext<Devices>, event: ImportDeviceEvent) => {      
        const deviceId = event.deviceId;
        const state = await getState(ctx);
        const deviceFound = state.devices.find(d => d.deviceId === deviceId);

        if(deviceFound && deviceFound.cancellationAwakeable) {
            console.log('Device found, cancelling existing device run');
            // cancel the existing device run
            ctx.resolveAwakeable(deviceFound.cancellationAwakeable);
            // Remove the deviceFound from state
            state.devices = state.devices.filter(d => d.deviceId !== deviceId);
            console.log('Setting state to: ', state);
            setState(ctx, state);
            ctx.objectSendClient(deviceStateMachineObject, deviceId).import(event);
        } else {
            console.log('Device not found, adding to state');
            // we need to add the device to the state
            ctx.objectSendClient(deviceStateMachineObject, deviceId).import(event);
            // How on earth do we get the cancellationAwakeable?
            state.devices.push({ deviceId, cancellationAwakeable: undefined, lastUpdated: new Date().toISOString() });
            console.log('Setting state to: ', state);
            setState(ctx, state);
        }
    }
  }
});

async function getState(ctx: ObjectContext<Devices>): Promise<Devices> {
    return {
      devices: (await ctx.get("devices")) ?? []
    };
  }
  
  function setState(ctx: ObjectContext<Devices>, state: Devices) {
    ctx.set("devices", state.devices);
  }

export type ParentDeviceStateMachineObject = typeof parentDeviceStateMachineObject;

restate.endpoint().bind(parentDeviceStateMachineObject).listen(9085);
console.log('Parent device state machine object service started on port 9085'); 
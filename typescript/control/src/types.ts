// External Events
export type PowerEventFromEventbridge = {
  deviceId: string;
  deviceType: string;
  power: number; // 0 = IDLE, 1 = IMPORT, -1 = EXPORT
  timestamp: string;
  start: string;
  end: string;
}

export type AmiEvent = {
  deviceId: string;
  deviceType: string;
  type: AmiEventType;
  timestamp: string;
}

export enum AmiEventType {
  CLOUD_DEVICE_SUCCESSFUL_START_CHARGE = 'CLOUD_DEVICE_SUCCESSFUL_START_CHARGE',
  CLOUD_DEVICE_SUCCESSFUL_STOP_CHARGE = 'CLOUD_DEVICE_SUCCESSFUL_STOP_CHARGE',
  CLOUD_DEVICE_FAILED_TO_CONTROL = 'CLOUD_DEVICE_FAILED_TO_CONTROL'
}

// Internal Events
type ControlEvent = {
  deviceId: string;
  deviceType: string;
  type: ControlEventType;
  timestamp: string;
  startTime: string;
}

export enum ControlEventType {
  IDLE = 'IDLE',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT'
}

export type IdleDeviceEvent = ControlEvent & {
  type: ControlEventType.IDLE;
}

export type ImportDeviceEvent = ControlEvent & {
  type: ControlEventType.IMPORT;
  endTime: string;
}

export type ExportDeviceEvent = ControlEvent & {
  type: ControlEventType.EXPORT;
  endTime: string;
}

export interface DeviceState {
  status: ControlEventType; // reevaulatee
  lastChargingStart?: string; // reevaulatee
  lastChargingEnd?: string; // reevaulatee
  currentWorkflowId?: string;
}
